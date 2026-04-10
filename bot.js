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

// Working RSS feeds with Israel/Middle East coverage
const newsSources = [
  {
    name: '🌍 BBC World',
    url: 'http://feeds.bbc.co.uk/news/world/rss.xml'
  },
  {
    name: '🌐 Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml'
  },
  {
    name: '📺 CNN World',
    url: 'http://rss.cnn.com/rss/cnn_world.rss'
  },
  {
    name: '🗞️ The Guardian',
    url: 'https://www.theguardian.com/international/rss'
  },
  {
    name: '📰 Reuters World',
    url: 'http://feeds.reuters.com/reuters/worldNews'
  },
  {
    name: '🔔 Middle East Eye',
    url: 'https://www.middleeasteye.net/feed'
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
  'beirut', 'בירות',
  'lebanon', 'לבנון',
  'iran', 'איראן',
  'saudi', 'סעודיה'
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

    if (articles.length > 0) {
      log(`✅ Found ${articles.length} articles from ${source.name}`);
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
    log(`📊 Found ${news.length} articles about Israel`);

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
  const chatId = msg.chat.id;
  const welcomeMessage = `
🤖 <b>ברוכים הבאים ל-Talzantbot!</b>

אני בוט החדשות שלך שמביא עדכוני חדשות על ישראל כל 2 דקות.

<b>פקודות זמינות:</b>
/news - קבל חדשות עכשיו
/help - עזרה
  `;

  await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
  log(`✅ /start command from ${msg.from.id}`);
});

bot.onText(/\/news/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, '⏳ טוען חדשות...');
  await checkNews();
  await bot.sendMessage(chatId, '✅ בדיקה הושלמה!');
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
<b>📖 עזרה</b>

<b>פקודות:</b>
/start - התחלה
/news - חדשות עכשיו
/help - עזרה זו

<b>מידע:</b>
הבוט בודק חדשות על ישראל כל 2 דקות.
כל חדשה מתורגמת ומסוכמת בעברית.
  `;

  await bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
});

bot.on('error', (error) => {
  log(`❌ Bot error: ${error.message}`);
});

bot.on('polling_error', (error) => {
  log(`❌ Polling error: ${error.message}`);
});

cron.schedule('*/2 * * * *', checkNews);

log('🚀 Talzantbot is running!');
log(`📍 Chat: ${chatId}`);
log('⏰ Every 2 minutes');
log('🤖 Ready!');
