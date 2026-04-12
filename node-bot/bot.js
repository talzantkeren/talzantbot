const axios = require('axios');
const crypto = require('crypto');
const { FinlightApi } = require('finlight-client');
const { Bot } = require('grammy');
const { autoRetry } = require('@grammyjs/auto-retry');
const Redis = require('ioredis');
require('dotenv').config();

// ===== CONFIG =====
const FINLIGHT_KEY = process.env.FINLIGHT_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const FINLIGHT_QUERY = 'israel attack missile iran hezbollah hamas gaza idf';
const DEDUP_WINDOW_SECONDS = 6 * 3600; // 6 hours

const bot = new Bot(TELEGRAM_TOKEN);
bot.api.config.use(autoRetry());

const redis = new Redis(REDIS_URL);

// ===== DEDUP MANAGEMENT (Redis) =====
function generateHash(title) {
  const normalized = title.toLowerCase().trim();
  return crypto.createHash('md5').update(normalized).digest('hex');
}

async function isDuplicate(title) {
  const hash = generateHash(title);
  const exists = await redis.zscore('dedup:hashes', hash);
  return exists !== null;
}

async function addToDedup(title) {
  const hash = generateHash(title);
  const now = Date.now() / 1000;
  await redis.zadd('dedup:hashes', now, hash);
  // Prune old entries
  await redis.zremrangebyscore('dedup:hashes', '-inf', now - DEDUP_WINDOW_SECONDS);
}

// ===== TRANSLATION (Gemini 2.5 Flash) =====
async function translateTitle(title) {
  try {
    const shortTitle = title.substring(0, 100);
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: shortTitle }] }],
        systemInstruction: { parts: [{ text: 'תרגם לעברית תקני בלבד. אל תערבב עם אנגלית. שמור קצר.' }] },
        generationConfig: { maxOutputTokens: 200, temperature: 0.2 }
      },
      { timeout: 10000 }
    );
    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    log(`⚠️ Translation error: ${error.message}`);
    return title;
  }
}

// ===== TELEGRAM MESSAGE =====
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendAlert(article) {
  try {
    const hebrewTitle = await translateTitle(article.title);
    await addToDedup(article.title);

    let msg = `🔴 <b>[${escapeHtml(article.source)}]</b> ${escapeHtml(hebrewTitle)}\n\n`;

    if (article.description) {
      const desc = article.description.substring(0, 150);
      msg += `📋 <i>${escapeHtml(desc)}</i>\n\n`;
    }

    msg += `🔗 <a href="${article.url}">קרא מלא</a>`;

    await bot.api.sendMessage(TELEGRAM_CHAT_ID, msg, {
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });

    log(`✅ Alert sent: ${hebrewTitle.substring(0, 40)}...`);
  } catch (error) {
    log(`❌ Send error: ${error.message}`);
  }
}

// ===== LOGGING =====
function log(message) {
  console.log(`[${new Date().toLocaleString('he-IL')}] ${message}`);
}

// ===== FINLIGHT CLIENT =====
let finlightClient = null;

async function connectFinlight() {
  try {
    log('🔌 Connecting to Finlight API...');

    finlightClient = new FinlightApi({
      apiKey: FINLIGHT_KEY
    });

    log('✅ Finlight client initialized');
    log(`📡 Listening to: ${FINLIGHT_QUERY}`);

    let articleCount = 0;

    await finlightClient.websocket.connect(
      { query: FINLIGHT_QUERY, language: 'en', extended: true },
      async (article) => {
        try {
          articleCount++;

          const title = article.title || article.headline || '';
          const url = article.url || article.link || '';
          const source = article.source || 'Finlight';
          const description = article.summary || article.description || '';

          log(`📨 Article #${articleCount} received from ${source}`);

          if (!title) {
            log(`⚠️ Skipping article: no title`);
            return;
          }

          // Filter out unwanted sources
          const ignoredSources = ['yahoo finance', 'yahoo', 'marketwatch', 'fox news', 'bbc weather'];
          if (ignoredSources.some(s => source?.toLowerCase().includes(s))) {
            log(`🚫 Filtered out: ${source}`);
            return;
          }

          // Filter out articles older than 3 hours
          const publishedAt = article.published_at ? new Date(article.published_at).getTime() : Date.now();
          const now = Date.now();
          const ageHours = (now - publishedAt) / (1000 * 60 * 60);
          if (ageHours > 3) {
            log(`⏰ Skipped old article (${ageHours.toFixed(1)}h old): ${title.substring(0, 40)}...`);
            return;
          }

          if (await isDuplicate(title)) {
            log(`🔄 Duplicate: ${title.substring(0, 40)}...`);
            return;
          }

          log(`📰 Processing article: ${title.substring(0, 50)}...`);

          await sendAlert({
            title,
            url,
            source,
            description
          });

        } catch (error) {
          log(`❌ Article processing error: ${error.message}`);
        }
      }
    );

  } catch (error) {
    log(`❌ Finlight error: ${error.message}`);
    log('⏰ Reconnecting in 5 seconds...');
    setTimeout(connectFinlight, 5000);
  }
}

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', async () => {
  log('🛑 SIGTERM received, shutting down...');
  if (finlightClient) {
    try { await finlightClient.websocket.disconnect(); } catch (e) {}
  }
  await redis.quit();
  process.exit(0);
});

// ===== STARTUP =====
log('🚀 Talzantbot Bot v2.0 starting...');
log(`📍 Chat ID: ${TELEGRAM_CHAT_ID}`);
log(`💬 Model: Gemini 2.5 Flash`);
log(`📡 Finlight API: wss://api.finlight.me/news/stream`);
log(`🔴 Redis: ${REDIS_URL}`);
connectFinlight();
log('✅ Ready!');
