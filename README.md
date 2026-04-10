# Talzantbot - בוט חדשות Telegram

בוט Telegram המביא עדכוני חדשות מ-6 מקורות שונים כל 2 דקות, עם תרגום אוטומטי לעברית באמצעות Claude AI.

## 🎯 תכונות

- ✅ Fetch חדשות מ-6 מקורות כל 2 דקות
- ✅ תרגום אוטומטי לעברית
- ✅ הימנעות מחדשות כפולות
- ✅ פקודות Telegram: /start, /news, /help
- ✅ טיפול בשגיאות ברשת
- ✅ Logging מלא
- ✅ Delay בין בקשות כדי לא להעמיס על השרתים

## 📋 דרישות מוקדמות

- Node.js 14+ 
- npm או yarn
- Telegram Bot Token (מ-BotFather)
- Anthropic API Key
- Chat ID להשלחת החדשות

## 🔧 התקנה מקומית (localhost)

### 1. Clone / Download הפרויקט

```bash
cd talzantbot
```

### 2. התקן dependencies

```bash
npm install
```

### 3. צור קובץ .env

העתק את `.env.example` ל-`.env` והוסף את הערכים שלך:

```bash
cp .env.example .env
```

עדכן את `.env`:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
NEWS_FETCH_INTERVAL=120000
DEBUG=false
```

### 4. הפעל את הבוט

```bash
npm start
```

או בפיתוח עם auto-reload:
```bash
npm run dev
```

### 5. בדוק בטלגרם

שלח `/start` לבוט שלך בטלגרם כדי לאשר שהוא עובד.

---

## 🚀 Deployment ל-Cloud

### Option 1: Heroku

1. **צור חשבון Heroku** (אם אין לך)
   ```bash
   npm install -g heroku
   heroku login
   ```

2. **צור אפליקציה חדשה**
   ```bash
   heroku create your-bot-name
   ```

3. **הוסף משתנים סביבה**
   ```bash
   heroku config:set TELEGRAM_BOT_TOKEN=your_token
   heroku config:set TELEGRAM_CHAT_ID=your_chat_id
   heroku config:set ANTHROPIC_API_KEY=your_api_key
   ```

4. **צור Procfile**
   ```
   worker: node bot.js
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

6. **הפעל את הbotworker**
   ```bash
   heroku ps:scale worker=1
   ```

### Option 2: Railway

1. **צור חשבון Railway** (https://railway.app)

2. **התחבר דרך CLI**
   ```bash
   npm i -g @railway/cli
   railway login
   ```

3. **Deploy**
   ```bash
   railway init
   railway link
   railway up
   ```

4. **הוסף משתנים סביבה בדשבורד Railway:**
   - TELEGRAM_BOT_TOKEN
   - TELEGRAM_CHAT_ID
   - ANTHROPIC_API_KEY

### Option 3: Render

1. **צור חשבון Render** (https://render.com)

2. **צור Service חדש:**
   - בחר "New +" → "Web Service"
   - בחר את ה-GitHub repo שלך
   - בחר "Node" environment
   - הוסף Build Command: `npm install`
   - הוסף Start Command: `node bot.js`

3. **הוסף Environment Variables:**
   - TELEGRAM_BOT_TOKEN
   - TELEGRAM_CHAT_ID
   - ANTHROPIC_API_KEY

4. **Deploy**
   - לחץ "Create Web Service"

---

## 📡 מקורות החדשות

1. **🌍 BBC World** - חדשות עולמיות
2. **📰 Reuters** - סוכנות רויטרס
3. **💼 TechCrunch** - טכנולוגיה וסטארטאפים
4. **🌐 Al Jazeera** - חדשות בינלאומיות
5. **📺 CNN** - חדשות עולם
6. **🗞️ The Guardian** - חדשות בינלאומיות

---

## 🛠️ פקודות Telegram

| פקודה | תיאור |
|--------|--------|
| `/start` | התחלה וברכה |
| `/news` | קבל חדשות עכשיו |
| `/help` | הצג עזרה |

---

## 📝 קובצים בפרויקט

- **bot.js** - קוד הבוט הראשי
- **package.json** - Dependencies
- **.env** - משתנים סביבה (לא להשתמש בגרסה גלויה)
- **.env.example** - תבנית לקובץ .env
- **README.md** - קובץ זה

---

## ⚠️ נקודות חשובות

1. **אל תחשוף את API Keys!**
   - שמור `.env` בסוד
   - אל תשתמש בקוד בגרסיה ציבורית

2. **Telegram Rate Limits:**
   - הבוט מוסיף delays בין בקשות
   - אם תקבל שגיאות rate limit, הגדל את ה-delays

3. **RSS Feeds:**
   - חלק מהמקורות חוסמים scraping
   - הבוט מנסה להשתמש ב-RSS feeds ראשית

4. **Costs:**
   - Heroku: משלם (אחרי פריי tier בינואר 2023)
   - Railway: Free tier זמין
   - Render: Free tier זמין
   - Anthropic API: בתשלום לפי שימוש

---

## 🐛 Troubleshooting

### "Cannot find module"
```bash
npm install
```

### בוט לא שולח חדשות
1. בדוק ש-`.env` מכיל את המפתחות הנכונים
2. בדוק את ה-logs כדי לראות שגיאות
3. נסה `/news` כדי לבדוק ידנית

### RSS Feeds לא עובדים
חלק מהאתרים חוסמים בקשות. עדכן את ה-User-Agent ב-axios:
```javascript
headers: { 'User-Agent': 'Mozilla/5.0...' }
```

### Translation לא עובד
בדוק ש-ANTHROPIC_API_KEY נכון ויש לך מספיק credits.

---

## 📚 References

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-python)
- [RSS Parser](https://www.npmjs.com/package/rss-parser)
- [node-cron](https://www.npmjs.com/package/node-cron)

---

## 📄 License

MIT

---

**יצור: Talzantbot Team**
