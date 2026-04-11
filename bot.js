const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const { FinlightApi } = require('finlight-client');
require('dotenv').config();

// ===== CONFIG =====
const FINLIGHT_KEY = process.env.FINLIGHT_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const FINLIGHT_URL = 'wss://api.finlight.me/news/stream';
const FINLIGHT_QUERY = 'israel OR iran OR hezbollah OR gaza OR missile OR strike OR ceasefire OR idf OR irgc OR hamas OR netanyahu';
const POLYMARKET_API = 'https://gamma-api.polymarket.com/markets';
const DEDUP_FILE = 'dedup.json';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ===== DEDUP MANAGEMENT =====
function loadDedup() {
  try {
    const data = fs.readFileSync(DEDUP_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveDedup(hashes) {
  // Keep only last 500
  const trimmed = hashes.slice(-500);
  fs.writeFileSync(DEDUP_FILE, JSON.stringify(trimmed, null, 2));
}

function generateHash(title) {
  return title.toLowerCase().substring(0, 60);
}

function isDuplicate(title) {
  const hash = generateHash(title);
  const dedup = loadDedup();
  return dedup.includes(hash);
}

function addToDedup(title) {
  const hash = generateHash(title);
  const dedup = loadDedup();
  if (!dedup.includes(hash)) {
    dedup.push(hash);
    saveDedup(dedup);
  }
}

// ===== TRANSLATION (Claude Haiku - fastest) =====
async function translateTitle(title) {
  try {
    const shortTitle = title.substring(0, 100);
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: 'תרגם לעברית תקני בלבד. אל תערבב עם אנגלית. שמור קצר.',
      messages: [
        {
          role: 'user',
          content: shortTitle
        }
      ]
    });
    return message.content[0].text;
  } catch (error) {
    log(`❌ Translation error: ${error.message}`);
    return title;
  }
}

// Polymarket removed to save on API costs

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
    // Translate title
    const hebrewTitle = await translateTitle(article.title);
    addToDedup(article.title);

    // Build message
    let msg = `🔴 <b>[${article.source}]</b> ${escapeHtml(hebrewTitle)}\n\n`;

    if (article.description) {
      const desc = article.description.substring(0, 150);
      msg += `📋 <i>${escapeHtml(desc)}</i>\n\n`;
    }

    msg += `🔗 <a href="${article.url}">קרא מלא</a>`;

    await bot.sendMessage(TELEGRAM_CHAT_ID, msg, {
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
let finlightConnected = false;

async function connectFinlight() {
  try {
    log('🔌 Connecting to Finlight API...');

    finlightClient = new FinlightApi({
      apiKey: FINLIGHT_KEY
    });

    log('✅ Finlight client initialized');
    log(`📡 Listening to: ${FINLIGHT_QUERY}`);

    // Connect WebSocket with query
    await finlightClient.websocket.connect(
      { query: FINLIGHT_QUERY, language: 'en', extended: true },
      async (article) => {
        try {
          // Article object: { title, url, source, published_at, summary, etc }
          const title = article.title || article.headline || '';
          const url = article.url || article.link || '';
          const source = article.source || 'Finlight';
          const description = article.summary || article.description || '';

          if (!title) {
            log(`⚠️ Skipping article: no title`);
            return;
          }

          if (isDuplicate(title)) {
            log(`🔄 Duplicate: ${title.substring(0, 40)}...`);
            return;
          }

          log(`📰 New article: ${title.substring(0, 50)}...`);

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

    finlightConnected = true;
  } catch (error) {
    log(`❌ Finlight error: ${error.message}`);
    log('⏰ Reconnecting in 5 seconds...');
    setTimeout(connectFinlight, 5000);
  }
}

// ===== TELEGRAM COMMANDS =====
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const welcome = `
🤖 <b>Talzantbot v2.0 - Real-Time Alert Bot</b>

אני מנטר חדשות בזמן אמת דרך Finlight WebSocket.
כל חדשה רלוונטית מתורגמת לעברית וקושרת לשוקי Polymarket.

<b>פקודות:</b>
/status - בדוק סטטוס
/help - עזרה
  `;

  await bot.sendMessage(chatId, welcome, { parse_mode: 'HTML' });
  log(`✅ /start from ${msg.from.id}`);
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const status = ws && ws.readyState === WebSocket.OPEN ? '✅ פעיל' : '❌ לא מחובר';
  const dedup = loadDedup().length;

  const msg_text = `
📊 <b>סטטוס</b>

🔌 WebSocket: ${status}
📝 ברשומת Dedup: ${dedup} חדשות
🕐 זמן: ${new Date().toLocaleString('he-IL')}
  `;

  await bot.sendMessage(chatId, msg_text, { parse_mode: 'HTML' });
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const help = `
<b>📖 עזרה</b>

<b>מערכת זו:</b>
• מנטרת Finlight WebSocket בזמן אמת
• מתרגמת כותרות לעברית
• חוזרת שוקים רלוונטיים ב-Polymarket

<b>פקודות:</b>
/start - התחלה
/status - סטטוס חיבור
/help - עזרה

<b>הערות:</b>
עיכוב: <100ms מהפרסום
שפה: Hebrew + Polymarket links
  `;

  await bot.sendMessage(chatId, help, { parse_mode: 'HTML' });
});

bot.on('error', (error) => {
  log(`❌ Bot error: ${error.message}`);
});

bot.on('polling_error', (error) => {
  log(`❌ Polling error: ${error.message}`);
});

// ===== STARTUP =====
log('🚀 Talzantbot v2.0 starting...');
log(`📍 Chat ID: ${TELEGRAM_CHAT_ID}`);
log(`⚙️ Model: claude-haiku-4-5-20251001`);
log(`📡 Finlight API: ${FINLIGHT_URL}`);
connectFinlight();
log('✅ Ready!');
