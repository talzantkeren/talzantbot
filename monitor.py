#!/usr/bin/env python3
"""
Telegram Channel Monitor - Real-Time News Alerts
Monitors IRNA and PressTV channels for breaking news using Telethon

FIRST RUN - INTERACTIVE AUTHENTICATION REQUIRED:
===============================================
Run: python monitor.py

You will be prompted for:
  1. Your phone number (international format: +972XXXXXXXXX)
  2. OTP code sent to your Telegram account via SMS

After first run, session is saved to: telegram_session.session
Subsequent runs will NOT require authentication.

NOTE: This requires a personal Telegram account, NOT a bot token.
Get TELEGRAM_API_ID and TELEGRAM_API_HASH from: https://my.telegram.org/apps
"""

import asyncio
import os
import json
import requests
import hashlib
from datetime import datetime
from telethon import TelegramClient, events
from dotenv import load_dotenv

# ===== CONFIG =====
load_dotenv()

API_ID = int(os.getenv('TELEGRAM_API_ID', '0'))
API_HASH = os.getenv('TELEGRAM_API_HASH', '')
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '')
SESSION_FILE = 'telegram_session'

# Telegram API endpoint
BOT_API_URL = f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage'

# Keywords to filter news
KEYWORDS = {
    'israel', 'iran', 'missile', 'strike', 'attack', 'irgc',
    'hezbollah', 'hamas', 'gaza', 'nuclear', 'war', 'ceasefire',
    'idf', 'netanyahu', 'khamenei'
}

# Channels to monitor (without @)
MONITOR_CHANNELS = [
    # Israeli channels
    'amitseg', 'barakravid1', 'ndvorii', 'orheller_il', 'idfofficial',
    'beholdisraelchannel', 'moriahdoron', 'barakbetesh', 'lieldaphna',
    'inon_yttach', 'amielyarchi', 'HallelBittonRosen',
    # Iranian channels
    'sepah_ir', 'sepah_pasdaran', 'BisimchiMedia', 'IRIran_Military',
    'defapress_ir', 'Tasnimnews', 'Tasnim_Agency', 'farsna', 'Nournews_ir',
    'Irna_en', 'mehrnews', 'isna94', 'PressTV', 'IranintlTV', 'vahidonline',
    # Arab/International channels
    'almanarnews', 'almayadeen', 'mayadeenchannel', 'alakhbar_news',
    'aljazeera', 'Alarabiya', 'aawsatnews', 'wamnews_en',
    # Other
    'US2020US'
]

# Better dedup - track message content hash
SEEN_MESSAGES = {}  # {message_hash: timestamp}

def log(message):
    """Log with timestamp"""
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f'[{ts}] {message}')

def compute_message_hash(text: str) -> str:
    """Compute hash of message content - normalize whitespace and lowercase"""
    # Normalize: lowercase, remove extra whitespace, take first 200 chars
    normalized = ' '.join(text.lower().split())[:200]
    return hashlib.md5(normalized.encode()).hexdigest()

def is_duplicate(text: str) -> bool:
    """Check if we've seen this exact message before (dedup window: 2 hours)"""
    global SEEN_MESSAGES

    msg_hash = compute_message_hash(text)
    now = datetime.now().timestamp()

    # Clean old entries (older than 2 hours)
    cutoff = now - (2 * 3600)
    SEEN_MESSAGES = {k: v for k, v in SEEN_MESSAGES.items() if v > cutoff}

    if msg_hash in SEEN_MESSAGES:
        return True

    # Add to seen
    SEEN_MESSAGES[msg_hash] = now
    return False

def matches_keywords(text: str) -> bool:
    """Check if text contains any relevant keywords"""
    if not text:
        return False
    lower = text.lower()
    return any(kw in lower for kw in KEYWORDS)

async def translate_with_claude(text: str) -> str:
    """Translate text to Hebrew using Claude API"""
    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

        message = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=500,
            system='תרגם לעברית תקני בלבד. אל תערבב עם אנגלית. שמור מלא וברור.',
            messages=[
                {
                    'role': 'user',
                    'content': text
                }
            ]
        )
        return message.content[0].text
    except Exception as error:
        log(f'⚠️ Translation error: {error}')
        return text

def send_to_telegram(source: str, text: str, translated: str = None):
    """Send message to Telegram chat via Bot API"""
    try:
        # Use translation if available, else original
        msg_text = translated or text

        # Truncate to 1000 chars (מלא!)
        msg_text = msg_text[:1000]

        # Format message
        formatted = f"""📡 <b>[{source}]</b>

{msg_text}"""

        response = requests.post(
            BOT_API_URL,
            json={
                'chat_id': CHAT_ID,
                'text': formatted,
                'parse_mode': 'HTML'
            },
            timeout=10
        )

        if response.status_code == 200:
            log(f'✅ Sent to Telegram: {msg_text[:50]}...')
        else:
            log(f'❌ Telegram API error: {response.status_code}')

    except Exception as error:
        log(f'❌ Send error: {error}')

async def main():
    """Main client loop"""

    # Validate config
    if not API_ID or API_ID == 0:
        log('❌ ERROR: TELEGRAM_API_ID not set in .env')
        log('Get it from: https://my.telegram.org/apps')
        return

    if not API_HASH:
        log('❌ ERROR: TELEGRAM_API_HASH not set in .env')
        log('Get it from: https://my.telegram.org/apps')
        return

    if not BOT_TOKEN or not CHAT_ID:
        log('❌ ERROR: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set')
        return

    # Create client
    client = TelegramClient(SESSION_FILE, API_ID, API_HASH)

    async with client:
        log('🔐 Starting Telegram client...')

        # First connection will require authentication
        await client.connect()

        if not await client.is_user_authorized():
            log('📱 Phone authentication required')
            log('Enter your phone number (with country code): ')
            phone = input('> ')

            try:
                await client.send_code_request(phone)
                code = input('Enter the code from SMS: ')
                await client.sign_in(phone, code)
                log('✅ Authenticated successfully')
            except Exception as e:
                log(f'❌ Auth failed: {e}')
                return

        log('✅ Connected to Telegram')
        log(f'📡 Monitoring channels: {", ".join(MONITOR_CHANNELS)}')
        log('🔍 Keywords: ' + ', '.join(sorted(list(KEYWORDS)[:10])) + '...')

        # Handler for new messages in monitored channels
        @client.on(events.NewMessage(chats=MONITOR_CHANNELS))
        async def handle_message(event):
            """Handle new message from monitored channel"""
            try:
                msg_text = event.message.message or ''

                if not msg_text or len(msg_text) < 10:
                    return

                # Dedup - skip if we've seen similar content (within 2 hours)
                if is_duplicate(msg_text):
                    log(f'🔄 Duplicate detected: {msg_text[:40]}...')
                    return

                # Filter by keywords
                if not matches_keywords(msg_text):
                    return

                # Get channel name
                channel_name = event.chat.title or 'Unknown'

                log(f'📰 Found relevant news from {channel_name}: {msg_text[:60]}...')

                # Translate to Hebrew
                translated = await translate_with_claude(msg_text)

                # Send to Telegram (synchronous, in thread to avoid blocking)
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, send_to_telegram, channel_name, msg_text, translated)

                # Rate limit - 2 seconds between sends (translation takes time)
                await asyncio.sleep(2)

            except Exception as error:
                log(f'⚠️ Handler error: {error}')

        log('🚀 Ready - monitoring for news...')

        # Run until disconnected
        await client.run_until_disconnected()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log('⏸️ Stopped by user')
    except Exception as e:
        log(f'❌ Fatal error: {e}')
