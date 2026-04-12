#!/usr/bin/env python3
"""
Telegram Channel Monitor - Real-Time News Alerts
Monitors 40+ channels for breaking news using Telethon + Redis dedup + Gemini translation

Setup (first run locally):
1. Run: python generate_session.py
2. Follow prompts for phone + OTP
3. Copy the session string to TELEGRAM_SESSION_STRING env var
4. Deploy to Railway with TELEGRAM_SESSION_STRING set
"""

import asyncio
import os
import hashlib
import signal
import aiohttp
from datetime import datetime
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from dotenv import load_dotenv
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import redis.asyncio as aioredis

# ===== CONFIG =====
load_dotenv()

API_ID = int(os.getenv('TELEGRAM_API_ID', '0'))
API_HASH = os.getenv('TELEGRAM_API_HASH', '')
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '')
SESSION_STRING = os.getenv('TELEGRAM_SESSION_STRING', '')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

BOT_API_URL = f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage'

# Keywords to filter news
KEYWORDS = {
    'israel', 'iran', 'missile', 'strike', 'attack', 'irgc',
    'hezbollah', 'hamas', 'gaza', 'nuclear', 'war', 'ceasefire',
    'idf', 'netanyahu', 'khamenei'
}

# Channels to monitor (without @)
MONITOR_CHANNELS = [
    'amitseg', 'barakravid1', 'ndvorii', 'orheller_il', 'idfofficial',
    'beholdisraelchannel', 'moriahdoron', 'barakbetesh', 'lieldaphna',
    'inon_yttach', 'amielyarchi', 'HallelBittonRosen',
    'sepah_ir', 'sepah_pasdaran', 'BisimchiMedia', 'IRIran_Military',
    'defapress_ir', 'Tasnimnews', 'Tasnim_Agency', 'farsna', 'Nournews_ir',
    'Irna_en', 'mehrnews', 'isna94', 'PressTV', 'IranintlTV', 'vahidonline',
    'almanarnews', 'almayadeen', 'mayadeenchannel', 'alakhbar_news',
    'aljazeera', 'Alarabiya', 'aawsatnews', 'wamnews_en', 'US2020US'
]

redis_client = None
DEDUP_WINDOW = 6 * 3600  # 6 hours

def log(message):
    """Log with timestamp"""
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f'[{ts}] {message}')

def compute_message_hash(text: str) -> str:
    """Compute hash of message content - normalize whitespace and lowercase"""
    normalized = ' '.join(text.lower().split())[:200]
    return hashlib.md5(normalized.encode()).hexdigest()

async def is_duplicate(text: str) -> bool:
    """Check if we've seen this exact message before (Redis-backed)"""
    global redis_client
    msg_hash = compute_message_hash(text)
    exists = await redis_client.zscore('dedup:hashes', msg_hash)
    if exists is not None:
        return True

    now = datetime.now().timestamp()
    await redis_client.zadd('dedup:hashes', {msg_hash: now})
    await redis_client.zremrangebyscore('dedup:hashes', '-inf', now - DEDUP_WINDOW)
    return False

def matches_keywords(text: str) -> bool:
    """Check if text contains any relevant keywords"""
    if not text:
        return False
    lower = text.lower()
    return any(kw in lower for kw in KEYWORDS)

async def translate_with_gemini(text: str) -> str:
    """Translate text to Hebrew using Gemini 2.5 Flash"""
    try:
        client = genai.Client()  # reads GEMINI_API_KEY from env automatically

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"תרגם את הטקסט הזה לעברית תקנית. רק התרגום, בלי הוספות:\n\n{text[:1000]}",
            config=types.GenerateContentConfig(
                max_output_tokens=500,
                temperature=0.2
            )
        )
        return response.text
    except Exception as error:
        log(f'⚠️ Translation error: {error}')
        return text

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=30),
    retry=retry_if_exception_type((aiohttp.ClientError, asyncio.TimeoutError))
)
async def send_to_telegram(source: str, text: str, translated: str = None):
    """Send message to Telegram chat via Bot API with auto-retry"""
    msg_text = (translated or text)[:1000]
    formatted = f"📡 <b>[{source}]</b>\n\n{msg_text}"

    async with aiohttp.ClientSession() as session:
        async with session.post(
            BOT_API_URL,
            json={'chat_id': CHAT_ID, 'text': formatted, 'parse_mode': 'HTML'},
            timeout=aiohttp.ClientTimeout(total=10)
        ) as resp:
            if resp.status == 429:
                data = await resp.json()
                retry_after = data.get('parameters', {}).get('retry_after', 5)
                log(f'⏳ Rate limited, waiting {retry_after}s')
                await asyncio.sleep(retry_after)
                raise aiohttp.ClientError('Rate limited')
            elif resp.status == 200:
                log(f'✅ Sent: {msg_text[:50]}...')
            else:
                log(f'❌ Telegram error: {resp.status}')

async def main():
    """Main client loop"""
    global redis_client

    # Validate config
    if not API_ID or API_ID == 0:
        log('❌ ERROR: TELEGRAM_API_ID not set in .env')
        return

    if not API_HASH:
        log('❌ ERROR: TELEGRAM_API_HASH not set in .env')
        return

    if not BOT_TOKEN or not CHAT_ID:
        log('❌ ERROR: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set')
        return

    if not SESSION_STRING:
        log('❌ ERROR: TELEGRAM_SESSION_STRING not set')
        log('Generate it locally with: python generate_session.py')
        return

    # Connect to Redis
    try:
        redis_client = await aioredis.from_url(REDIS_URL)
        log('✅ Connected to Redis')
    except Exception as e:
        log(f'❌ Redis connection error: {e}')
        return

    # Create client with StringSession
    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)

    async with client:
        log('🔐 Starting Telegram client...')

        try:
            await client.connect()
        except Exception as e:
            log(f'❌ Connection error: {e}')
            return

        if not await client.is_user_authorized():
            log('❌ Session string is invalid or expired')
            log('Regenerate locally with: python generate_session.py')
            return

        log('✅ Connected to Telegram')

        # Pre-resolve channel entities on startup
        resolved_channels = []
        for ch in MONITOR_CHANNELS:
            try:
                entity = await client.get_entity(ch)
                resolved_channels.append(entity)
                log(f'✅ Resolved: {ch}')
            except Exception as e:
                log(f'⚠️ Could not resolve {ch}: {e}')

        log(f'📡 Monitoring {len(resolved_channels)} channels')
        log('🔍 Keywords: ' + ', '.join(sorted(list(KEYWORDS)[:10])) + '...')

        # Handler for new messages in monitored channels
        @client.on(events.NewMessage(chats=resolved_channels))
        async def handle_message(event):
            """Handle new message from monitored channel"""
            try:
                msg_text = event.message.message or ''

                if not msg_text or len(msg_text) < 10:
                    return

                # Dedup - skip if we've seen similar content
                if await is_duplicate(msg_text):
                    log(f'🔄 Duplicate detected: {msg_text[:40]}...')
                    return

                # Filter by keywords
                if not matches_keywords(msg_text):
                    return

                # Get channel name
                channel_name = event.chat.title or 'Unknown'

                log(f'📰 Found relevant news from {channel_name}: {msg_text[:60]}...')

                # Translate to Hebrew (Gemini)
                translated = await translate_with_gemini(msg_text)

                # Send to Telegram (with automatic retry on rate limit)
                await send_to_telegram(channel_name, msg_text, translated)

                # Rate limit - 2 seconds between sends
                await asyncio.sleep(2)

            except Exception as error:
                log(f'⚠️ Handler error: {error}')

        log('🚀 Ready - monitoring for news...')

        # Run until disconnected
        await client.run_until_disconnected()

def handle_sigterm(sig, frame):
    """Handle SIGTERM gracefully"""
    log('🛑 SIGTERM received, shutting down...')
    raise SystemExit(0)

signal.signal(signal.SIGTERM, handle_sigterm)

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log('⏸️ Stopped by user')
    except Exception as e:
        log(f'❌ Fatal error: {e}')
