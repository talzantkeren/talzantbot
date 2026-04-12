# Talzantbot v2.0 Migration Guide

## Architecture Changes

The monolithic Honcho-based deployment has been split into two independent services:

### Service 1: `node-bot/` (Finlight WebSocket)
- **Technology**: Node.js + Finlight WebSocket
- **Translation**: Gemini 2.5 Flash (7x cheaper than Claude Haiku)
- **Telegram**: grammY + auto-retry middleware
- **Dedup**: Redis sorted set (`dedup:hashes`)
- **Start**: `node bot.js`

### Service 2: `python-monitor/` (Telegram Channels)
- **Technology**: Python + Telethon
- **Translation**: Gemini 2.5 Flash (google-genai SDK)
- **Telegram**: aiohttp + tenacity auto-retry
- **Auth**: StringSession (env variable, no TTY needed)
- **Dedup**: Redis sorted set (`dedup:hashes`)
- **Start**: `python monitor.py`

### Shared Infrastructure
- **Redis**: Shared deduplication across both services
- **Gemini API**: Single API key for both services
- **Telegram Bot API**: Single bot token for both services

## Initial Setup (Local)

### 1. Install Dependencies
```bash
# Node service
cd node-bot
npm install

# Python service
cd ../python-monitor
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

### 2. Generate Telegram Session String
```bash
cd python-monitor
python generate_session.py
```

Follow the prompts:
- Enter your phone number: `+972XXXXXXXXX`
- Enter OTP code from Telegram SMS
- Copy the printed session string

### 3. Configure `.env`
```bash
# Node bot
FINLIGHT_API_KEY=sk_...
GEMINI_API_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Python monitor (Telegram auth)
TELEGRAM_API_ID=...
TELEGRAM_API_HASH=...
TELEGRAM_SESSION_STRING=<session_from_step_2>

# Redis (for local testing, or Railway)
REDIS_URL=redis://localhost:6379
```

### 4. Run Locally
```bash
# Terminal 1: Node bot
cd node-bot
npm start

# Terminal 2: Python monitor
cd python-monitor
python monitor.py
```

## Deployment to Railway

### 1. Create Redis Add-on
- In Railway dashboard, add Redis add-on
- Copy `REDIS_URL` from the add-on variables

### 2. Create Two Services

Each service is auto-detected from its directory:

**Service 1 (bot):**
- Source: `node-bot/`
- Build: Dockerfile (node:20-alpine)
- Start: `node bot.js`
- Variables: `FINLIGHT_API_KEY`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `REDIS_URL`

**Service 2 (monitor):**
- Source: `python-monitor/`
- Build: Dockerfile (python:3.12-slim)
- Start: `python monitor.py`
- Variables: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION_STRING`, `GEMINI_API_KEY`, `REDIS_URL`

### 3. Configure Environment Variables
Copy from your local `.env`:
- `FINLIGHT_API_KEY`
- `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_SESSION_STRING` (from `generate_session.py`)
- `REDIS_URL` (from Redis add-on)

### 4. Deploy
```bash
git add -A
git commit -m "Refactor: Split into independent Railway services"
git push origin main
```

## Key Improvements

### 1. **Cost Reduction (7x)** 📉
- Switched from Claude Haiku to Gemini 2.5 Flash
- Haiku: ~$0.80 per 1M input tokens
- Gemini 2.5 Flash: ~$0.075 per 1M input tokens

### 2. **Reliability** 🔄
- **grammY auto-retry**: Handles Telegram rate limits automatically
- **tenacity**: Python service auto-retries on transient failures
- **Redis dedup**: Shared state prevents duplicate alerts

### 3. **Scalability** 📈
- Services are independent and can be scaled separately
- No shared local state (no more `dedup.json`)
- StringSession is stateless (no file I/O)

### 4. **Security** 🔐
- No session files in git (StringSession via env var)
- Redis with password (Railway provider)
- Cleaner separation of concerns

## Monitoring

### Bot Service Logs
```bash
railway logs --service bot
```

Expected output:
```
🚀 Talzantbot Bot v2.0 starting...
📍 Chat ID: 1691769494
💬 Model: Gemini 2.5 Flash
🔌 Connecting to Finlight API...
✅ Finlight client initialized
📡 Listening to: israel attack missile iran...
```

### Monitor Service Logs
```bash
railway logs --service monitor
```

Expected output:
```
🔐 Starting Telegram client...
✅ Connected to Redis
✅ Connected to Telegram
✅ Resolved: amitseg
✅ Resolved: barakravid1
...
🚀 Ready - monitoring for news...
```

## Troubleshooting

### Monitor says "Session string is invalid or expired"
```bash
# Regenerate locally
cd python-monitor
python generate_session.py
# Update TELEGRAM_SESSION_STRING in Railway
```

### Redis connection errors
- Verify `REDIS_URL` is set in both services
- Check Redis add-on status in Railway dashboard

### Gemini API errors
- Verify `GEMINI_API_KEY` is valid
- Check Google Cloud project quota

## Rollback

If needed, revert to the previous Honcho-based deployment:
```bash
git revert <commit-hash>
```

The old code is still in git history.
