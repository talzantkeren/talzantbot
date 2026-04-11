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
MONITOR_CHANNELS = ['Irna_en', 'presstv']

# In-memory dedup (acceptable for live stream monitoring)
SEEN_MESSAGES = set()

def log(message):
    """Log with timestamp"""
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f'[{ts}] {message}')

def matches_keywords(text: str) -> bool:
    """Check if text contains any relevant keywords"""
    if not text:
        return False
    lower = text.lower()
    return any(kw in lower for kw in KEYWORDS)

def send_to_telegram(source: str, text: str):
    """Send message to Telegram chat via Bot API"""
    try:
        # Truncate to 400 chars
        msg_text = text[:400]

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

                if not msg_text:
                    return

                # Dedup - skip if we've seen this exact message before
                dedup_key = msg_text[:60].lower().strip()
                if dedup_key in SEEN_MESSAGES:
                    return

                SEEN_MESSAGES.add(dedup_key)

                # Filter by keywords
                if not matches_keywords(msg_text):
                    return

                # Determine source
                if 'irna' in str(event.chat_id).lower():
                    source = 'IRNA'
                else:
                    source = 'PressTV'

                log(f'📰 Found relevant news from {source}: {msg_text[:60]}...')

                # Send to Telegram (synchronous, in thread to avoid blocking)
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, send_to_telegram, source, msg_text)

                # Rate limit - 1 second between sends
                await asyncio.sleep(1)

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
