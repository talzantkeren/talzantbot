# ✅ Railway Deployment Checklist

## Pre-Deployment (Local)

- [x] bot.js fixed for .env path resolution
- [x] monitor.py dependencies installed
- [x] Environment variables validated in code
- [x] TELEGRAM_SESSION_STRING generated
- [x] .gitignore created (prevents .env from being committed)
- [x] Procfile updated with correct commands
- [x] runtime.txt created (Python 3.11.9)
- [x] requirements.txt updated with all dependencies
- [x] Git repo made private (credentials secure)

## Ready to Deploy

### Local Git Setup

```bash
# 1. Stage all changes (except .env - it's ignored)
git add .

# 2. Commit
git commit -m "Railway deployment setup"

# 3. Push to GitHub
git push origin main
```

### Railway Setup

**Step 1: Create Project**
- Go to https://railway.app/new
- Click "Deploy from GitHub"
- Select `talzantbot` repo
- Click "Create"

**Step 2: Add Redis Service**
- Click "+ Add Service" → "Redis"
- Wait for deployment (green check)
- Copy `REDIS_URL` (auto-generated)

**Step 3: Set Environment Variables**

In Railway dashboard → Project Settings → Variables:

```
TELEGRAM_BOT_TOKEN = 8557763207:AAHT-8uWzAz...
TELEGRAM_CHAT_ID = 1691769494
TELEGRAM_API_ID = 26445837
TELEGRAM_API_HASH = 223575c96a5433a2d2b980ca996357c5
TELEGRAM_SESSION_STRING = 1BJWap1sBuwQYP7FhGhLn_UgrPTFbrmQTE...
FINLIGHT_API_KEY = sk_324f698bb5fdc82e044e67...
GEMINI_API_KEY = AIzaSyA3Ch-vVjxLLTA2TkEynkQbkzAO6jg...
ANTHROPIC_API_KEY = sk-ant-api03-Sj_MGanMdk1yuMh...
```

**Note**: REDIS_URL is auto-set by Railway Redis service

## Post-Deployment Verification

### Check Service Status
- [ ] Web service (bot.js) shows green/running
- [ ] Worker service (monitor.py) shows green/running  
- [ ] Redis service shows green/running

### Check Logs

**Web Service Logs** should contain:
```
✅ Finlight client initialized
✅ Ready!
✅ Connected.
```

**Worker Service Logs** should contain:
```
✅ Connected to Redis
✅ Connected to Telegram
📡 Monitoring 40+ channels
🚀 Ready - monitoring for news...
```

### Test Functionality

1. **Send test article to Finlight channels**
   - Bot should send alert to Telegram within seconds

2. **Check Telegram chat for alerts**
   - Articles should appear in Hebrew
   - Format: `🔴 [Source] Hebrew title`

3. **Check for duplicates**
   - Same article sent twice should only appear once (if Redis working)

## Troubleshooting

### Services won't start
- [ ] Check all environment variables are set
- [ ] Verify TELEGRAM_SESSION_STRING is complete (no truncation)
- [ ] Check Redis service is deployed

### Can't connect to Telegram
- [ ] Verify TELEGRAM_BOT_TOKEN is valid
- [ ] Verify TELEGRAM_CHAT_ID is correct
- [ ] Check TELEGRAM_SESSION_STRING hasn't expired (regenerate locally if needed)

### No alerts appearing
- [ ] Check Finlight API key is valid (Enhanced WebSocket tier)
- [ ] Check bot logs for errors
- [ ] Verify Telegram chat ID is correct

### Redis connection fails
- [ ] Confirm Redis service is green/deployed
- [ ] Check REDIS_URL format is correct
- [ ] Restart worker service

## Maintenance

### Updating Code
```bash
# Make changes locally
git add .
git commit -m "Update feature"
git push origin main
```
Railway auto-redeploys on push ✅

### Regenerating Telegram Session
If you get "Session expired" error:
1. Locally run: `python python-monitor/generate_session.py`
2. Copy new session string
3. Update Railway Variables with new string
4. Restart worker service

### Monitoring Uptime
- [ ] Set up Railway alerts (optional)
- [ ] Monitor Telegram for alerts (live indicator)
- [ ] Check Railway dashboard daily

## Cost & Billing

- Web tier: ~$5/month
- Worker tier: ~$5/month
- Redis: ~$7/month
- Free credits: $5/month
- **Expected total**: ~$12/month (after credits)

Use Railway **Insights** tab to monitor usage.

## Success Criteria

✅ Bot is live when:
1. All services showing green status
2. Articles appear in Telegram chat
3. Logs show "Connected" messages
4. No errors in service logs
5. Duplicate filtering works (Redis connected)

## Final Notes

- Keep `.env` locally, never commit to git
- TELEGRAM_SESSION_STRING expires after ~6 months, regenerate as needed
- Railway can scale workers if needed (currently single worker sufficient)
- Backup TELEGRAM_SESSION_STRING somewhere safe

---

**You're ready to deploy!** 🚀

Follow Railway Quick Start in 5 minutes: `RAILWAY_QUICK_START.md`
