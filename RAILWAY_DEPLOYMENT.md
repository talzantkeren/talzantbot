# Railway Deployment Guide for Talzantbot

## Prerequisites
- Railway account (https://railway.app)
- GitHub repository (make sure it's public or Railway has access)
- All API keys ready

## Step 1: Connect Your Repository to Railway

1. Go to https://railway.app
2. Click **New Project** → **Deploy from GitHub**
3. Select your `talzantbot` repository
4. Railway will auto-detect the Procfile and dependencies

## Step 2: Create and Configure Services

Railway will create services based on your Procfile. Configure them:

### Service 1: Web (bot.js)
```
Build Command: npm install --prefix node-bot
Start Command: cd node-bot && node bot.js
```

### Service 2: Worker (monitor.py)
```
Build Command: pip install -r requirements.txt
Start Command: python3 python-monitor/monitor.py
```

### Service 3: Redis (For Deduplication)
1. In Railway, click **+ Add Service** → Select **Redis**
2. Railway will auto-generate `REDIS_URL` environment variable

## Step 3: Set Environment Variables

Add these to Railway's **Variables** section:

```
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_SESSION_STRING=your_session_string
FINLIGHT_API_KEY=your_finlight_key
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key
REDIS_URL=redis://default:password@redis.railway.internal:6379
```

**Note**: 
- `REDIS_URL` is automatically set by Railway when you add Redis service
- Ensure `TELEGRAM_SESSION_STRING` is the complete string from generate_session.py

## Step 4: Deploy

1. Commit and push your code to GitHub:
```bash
git add .
git commit -m "Deploy to Railway"
git push origin main
```

2. Railway will auto-deploy when you push
3. Monitor logs in Railway dashboard: **Deployments** → **View Logs**

## Step 5: Verify Deployment

Check logs for these messages:

**bot.js** should show:
```
✅ Finlight client initialized
✅ Ready!
✅ Connected.
```

**monitor.py** should show:
```
✅ Connected to Redis
✅ Connected to Telegram
📡 Monitoring 40+ channels
🚀 Ready - monitoring for news...
```

## Troubleshooting

### "TELEGRAM_SESSION_STRING not set"
- Regenerate locally: `python python-monitor/generate_session.py`
- Copy full string to Railway Variables
- Restart deployment

### "Redis connection error"
- Confirm Redis service is created in Railway
- Check REDIS_URL variable is set
- Restart worker service

### "Missing environment variables"
- Go to Railway dashboard
- Check Variables section
- Ensure no typos in variable names
- Redeploy

### Build fails
1. Check Railway logs for specific error
2. Ensure `package.json` and `requirements.txt` are in root directory
3. Verify Procfile syntax

## Logs & Monitoring

**View logs in Railway**:
1. Go to your project
2. Click on service (web or worker)
3. Click **View Logs** tab

**Real-time monitoring**:
- Watch for article alerts in Telegram
- Check Railway logs for processing messages

## Updating Code

To update your bot after deployment:
```bash
git add .
git commit -m "Update feature"
git push origin main
```

Railway automatically redeploys on push.

## Important Notes

1. **Telegram Session**: Valid for ~6 months on Railway. Regenerate if you get "Session expired" errors
2. **Bot Token**: Keep private - don't commit to git
3. **Finlight API**: Ensure Enhanced WebSocket tier
4. **Scaling**: 
   - Worker size: `$5/month` is sufficient
   - Memory: 512MB default is enough

## Cost Estimate (as of 2026)

- Free tier: $5 credit/month
- Web service: ~$5/month
- Worker service: ~$5/month  
- Redis: ~$7/month
- **Total**: ~$12/month (after free credits)

## Support

Railway docs: https://docs.railway.app
Telegram Bot docs: https://core.telegram.org/bots
