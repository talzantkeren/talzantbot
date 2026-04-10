# 🚀 Quick Start Guide

## ⚡ 5 דקות עד בוט עובד

### שלב 1: הכנה מוקדמת (2 דקות)

**קבל את המפתחות שלך:**

1. **Telegram Bot Token:**
   - פתח Telegram
   - חפש `@BotFather`
   - שלח `/newbot`
   - בחר שם (למשל: `Talzantbot`)
   - קבל את ה-Token (יראה כך: `123456789:ABCdef...`)

2. **Chat ID שלך:**
   - פתח Telegram
   - חפש `@userinfobot`
   - הבוט יגיד לך את ה-ID שלך

3. **Anthropic API Key:**
   - כנס ל-https://console.anthropic.com/
   - צור API Key חדש
   - שמור אותו בבטחה

---

### שלב 2: התקנה (2 דקות)

**בחר את ההפעלה שלך:**

#### Windows:
```bash
setup.bat
```
ואז עדכן `.env` עם המפתחות שלך.

#### Mac / Linux:
```bash
chmod +x setup.sh
./setup.sh
```
ואז עדכן `.env` עם המפתחות שלך.

**או ידני:**
```bash
npm install
cp .env.example .env
# עדכן .env עם המפתחות
```

---

### שלב 3: הפעלה (1 דקה)

```bash
npm start
```

אתה אמור לראות:
```
🚀 Talzantbot is running!
📍 Sending news to chat: 1691769494
⏰ News check scheduled every 2 minutes
🤖 Listening for commands...
```

---

### שלב 4: בדיקה

פתח Telegram והשלח לבוט שלך:
```
/start
```

אתה אמור לקבל הודעת ברכה. ואז תנסה:
```
/news
```

אם מקבל חדשות - הצלחת! 🎉

---

## 🐛 Something Wrong?

### "Cannot find module 'node-telegram-bot-api'"
```bash
npm install
```

### "ENOENT: no such file or directory, open '.env'"
```bash
cp .env.example .env
# עדכן עם המפתחות שלך
```

### "401 Unauthorized" (API Key)
בדוק ש-ANTHROPIC_API_KEY נכון ב-.env

### בוט לא שולח חדשות
שלח `/news` כדי לבדוק את RSS feeds.

---

## 📱 הודעה בטלגרם

הודעה שתקבל תראה כך:

```
📰 חדשה חדשה

איראן מאיימת על רד בתגובה להתקפות ישראלית

מקור: 🇮🇷 TENS

קרא עוד
```

---

## ⏰ Cron Schedule

הבוט בודק חדשות כל 2 דקות באופן אוטומטי.

לשינוי המרווח, עדכן ב-bot.js:
```javascript
cron.schedule('*/2 * * * *', async () => { // כל 2 דקות
  // */5 = כל 5 דקות
  // */10 = כל 10 דקות
```

---

## 🌐 Deploy to Cloud

אחרי שהבוט עובד בעלי:

### Heroku:
```bash
heroku create your-bot-name
heroku config:set TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=xxx ANTHROPIC_API_KEY=xxx
git push heroku main
```

### Railway:
```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

### Render:
1. צור חשבון
2. ר Repository
3. הוסף משתנים
4. Deploy!

---

## 📖 עוד מידע

ראה `README.md` להוראות מפורטות.

---

**זהו! בהצלחה! 🚀**
