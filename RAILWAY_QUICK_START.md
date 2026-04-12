# 🚀 Railway Deployment - Quick Start (5 minutes)

## Step 1: Prepare Your Code (Local)

Make sure everything is committed except `.env`:

```bash
# Check what will be pushed (should NOT include .env)
git status

# Add all changes
git add .

# Commit
git commit -m "Prepare for Railway deployment"

# Push to GitHub
git push origin main
```

## Step 2: Create Railway Project

1. Go to https://railway.app/new
2. Click **Deploy from GitHub**
3. Select your `talzantbot` repository
4. Click **Create**

Railway will auto-detect:
- `package.json` → Node.js service
- `requirements.txt` → Python service
- `Procfile` → Service commands

## Step 3: Add Redis Service

1. In Railway dashboard, click **+ Add Service**
2. Select **Redis**
3. Wait for it to deploy (green checkmark)

Railway auto-creates `REDIS_URL` environment variable ✅

## Step 4: Set Environment Variables

In Railway dashboard:
1. Click **Project** → **Variables**
2. Add these variables:

```
TELEGRAM_BOT_TOKEN=8557763207:AAHT-8uWzAz...
TELEGRAM_CHAT_ID=1691769494
TELEGRAM_API_ID=26445837
TELEGRAM_API_HASH=223575c96a5433a2d2b980ca996357c5
TELEGRAM_SESSION_STRING=1BJWap1sBuwQYP7FhGhLn_UgrPTFbrmQTE...
FINLIGHT_API_KEY=sk_324f698bb5fdc82e044e67...
GEMINI_API_KEY=AIzaSyA3Ch-vVjxLLTA2TkEynkQbkzAO6jg...
ANTHROPIC_API_KEY=sk-ant-api03-Sj_MGanMdk1yuMh...
```

**Done!** ✅ Railway will automatically deploy on push

---

## Monitoring & Logs

### View Service Logs
1. Click **Services** → select **web** or **worker**
2. Click **View Logs**

### Expected Output

**Web (bot.js)**:
```
[12.4.2026, 13:39:40] 🚀 Talzantbot Bot v2.0 starting...
[12.4.2026, 13:39:40] ✅ Finlight client initialized
[12.4.2026, 13:39:40] ✅ Connected.
```

**Worker (monitor.py)**:
```
[2026-04-12 13:39:40] Connected to Redis
[2026-04-12 13:39:40] Connected to Telegram
[2026-04-12 13:39:40] Monitoring 40+ channels
```

---

## Updates

To update your bot after deploy:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Railway redeploys automatically! ✅

---

## ⚠️ Common Issues

| Issue | Fix |
|-------|-----|
| TELEGRAM_SESSION_STRING not set | Add complete string from `generate_session.py` to Railway Variables |
| Redis connection error | Check Redis service is deployed (green checkmark) |
| Python/Node dependencies fail | Check `requirements.txt` and `package.json` are in root directory |
| Services keep crashing | Check logs for specific error message |

---

## Verification Checklist

- [ ] GitHub repo is public (or Railway has access)
- [ ] All `.env` variables added to Railway Variables
- [ ] Redis service deployed
- [ ] Git push completed
- [ ] Services showing green/deployed status
- [ ] Logs show "Connected" messages

**That's it!** Your bot is live on Railway 🎉

See `RAILWAY_DEPLOYMENT.md` for detailed documentation.
