const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('node-cron');
const Anthropic = require('@anthropic-ai/sdk');
const Parser = require('rss-parser');
require('dotenv').config();

// Configuration
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

// Initialize clients
const bot = new TelegramBot(token, { polling: true });
const client = new Anthropic({ apiKey: anthropicKey });
const parser = new Parser();

// Store sent news
const sentNews = new Set();

// Arabic RSS feeds from Lebanon, Iran, and Saudi Arabia
const newsSources = [
  {
    name: '🇱🇧 אל גדיד (לבנון)',
    url: 'https://www.aljadeed.tv/rss/all'
  },
  {
    name: '🇱🇧 נשריה (לבנון)',
    url: 'https://www.naharnet.com/rss'
  },
  {
    name: '🇸🇦 אל חדת (סעודיה)',
    url: 'https://www.alhadath.net/rss'
  },
  {
    name: '🇸🇦 עכازה (סעודיה)',
    url: 'https://www.aksazaa.com/rss'
  },
  {
    name: '🇮🇷 תסנים (איראן)',
    url: 'https://www.tasnimnews.com/en/rss/feed/0/world'
  },
  {
    name: '🇮🇷 פרס (איראן)',
    url: 'https://www.presstv.ir/rss'
  },
  {
    name: '📰 Reuters',
    url: 'https://www.reuters.com/rssFeed/worldNews'
  },
  {
    name: '💼 Axios',
    url: 'https://feeds.axios.com/axios-world'
  },
  {
    name: '📺 NBC News',
    url: 'https://feeds.nbcnews.com/nbcnews/public/world'
  },
  {
    name: '📰 AP News',
    url: 'https://apnews.com/hub/world-news'
  }
];

// Keywords to filter news about Israel
const israelKeywords = [
  'israel', 'israeli', 'אישראל',
  'palestine', 'palestinian', 'פלשתינה',
  'gaza', 'עזה',
  'west bank', 'בנק מערבי',
  'tel aviv', 'תל אביב',
  'jerusalem', 'ירושלים',
  'hamas', 'חמאס',
  'hezbollah', 'חיזבאללה',
  'middle east', 'אמצע מזרח',
  'beirut', 'בירות'
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function generateNewsHash(title, source) {
  return `${title.toLowerCase().substring(0, 50)}_${source}`;
}

function isHebrew(text) {
  const hebrewRegex = /[\u0590-\u05FF]/g;
  const matches = text.match(hebrewRegex) || [];
  return matches.length > text.length * 0.2;
}

// Check if news is about Israel
function isAboutIsrael(title) {
  const lowerTitle = title.toLowerCase();
  return israelKeywords.some(keyword => lowerTitle.includes(keyword));
}

async function translateToHebrew(text) {
  if (isHebrew(text)) return text;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Translate to Hebrew. Only output the translation:\n\n${text.substring(0, 200)}`
        }
      ]
    });
    return message.content[0].text;
  } catch (error) {
    log(`Translation error: ${error.message}`);
    return text;
  }
}

// Summarize article
async function summarizeArticle(title, description) {
  try {
    const text = `${title}\n\n${description}`.substring(0, 500);

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `Summarize this news in 1-2 sentences in Hebrew:\n\n${text}`
        }
      ]
    });

    return message.content[0].text;
  } catch (error) {
    log(`Summary error: ${error.message}`);
    return '';
  }
}

async function fetchRSSNews(source) {
  try {
    log(`📡 Fetching ${source.name}...`);

    const feed = await parser.parseURL(source.url);

    if (!feed.items || feed.items.length === 0) {
      log(`⚠️ No items: ${source.name}`);
      return [];
    }

    const articles = [];
    for (const item of feed.items.slice(0, 5)) {
      const title = item.title || item.description || '';
      if (!title) continue;

      // Filter - only articles about Israel
      if (!isAboutIsrael(title)) {
        continue;
      }

      const hash = generateNewsHash(title, source.name);
      if (!sentNews.has(hash)) {
        articles.push({
          title: title.substring(0, 150),
          description: item.description || item.content || '',
          link: item.link || '',
          source: source.name,
          hash
        });
      }
    }

    return articles;
  } catch (error) {
    log(`Error ${source.name}: ${error.message}`);
    return [];
  }
}

async function fetchAllNews() {
  const allNews = [];

  for (const source of newsSources) {
    const articles = await fetchRSSNews(source);
    allNews.push(...articles);
    await sleep(1500);
  }

  return allNews;
}

async function sendNewsToTelegram(article) {
  try {
    const hebrewTitle = await translateToHebrew(article.title);
    sentNews.add(article.hash);

    // Get summary
    const summary = await summarizeArticle(article.title, article.description);

    let msg = `📰 <b>חדשה</b>\n\n<b>${hebrewTitle.substring(0, 100)}</b>\n\n`;

    if (summary) {
      msg += `📝 <i>${summary}</i>\n\n`;
    }

    msg += `<i>מקור: ${article.source}</i>\n\n<a href="${article.link}">קרא את המלא</a>`;

    await bot.sendMessage(chatId, msg, {
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });

    log(`✅ ${hebrewTitle.substring(0, 40)}... + סיכום`);
  } catch (error) {
    log(`Send error: ${error.message}`);
  }
}

function log(message) {
  console.log(`[${new Date().toLocaleString('he-IL')}] ${message}`);
}

async function checkNews() {
  log('🔄 Checking news...');
  try {
    const news = await fetchAllNews();
    log(`Found ${news.length} articles`);

    for (const article of news.slice(0, 3)) {
      await sendNewsToTelegram(article);
      await sleep(500);
    }
  } catch (error) {
    log(`Check error: ${error.message}`);
  }
}

// Telegram commands
bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `🤖 <b>Talzantbot</b>\n\nחדשות כל 2 דקות\n\n/news - חדשות עכשיו\n/help - עזרה`,
    { parse_mode: 'HTML' });
  log(`✅ /start from ${msg.from.id}`);
});

bot.onText(/\/news/, async (msg) => {
  await bot.sendMessage(msg.chat.id, '⏳ טוען...');
  await checkNews();
  await bot.sendMessage(msg.chat.id, '✅ בדוק!');
});

bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `📖 עזרה\n\n/start - התחלה\n/news - חדשות עכשיו`,
    { parse_mode: 'HTML' });
});

bot.on('error', (error) => log(`Bot error: ${error.message}`));
bot.on('polling_error', (error) => log(`Poll error: ${error.message}`));

// Schedule
cron.schedule('*/2 * * * *', checkNews);

log('🚀 Talzantbot started!');
log(`📍 Chat: ${chatId}`);
log('⏰ Every 2 minutes');
log('🤖 Ready!');
