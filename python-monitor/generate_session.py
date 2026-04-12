"""
Run this ONCE locally to generate a Telegram session string.
Save the output to TELEGRAM_SESSION_STRING environment variable.

Usage:
  1. python generate_session.py
  2. Enter your phone number (with country code, e.g., +972123456789)
  3. Enter the OTP code sent to your Telegram account
  4. Copy the printed session string
  5. Add it to your .env file as: TELEGRAM_SESSION_STRING=<output>
  6. Deploy to Railway with this env var set
"""

from telethon.sync import TelegramClient
from telethon.sessions import StringSession
import os
from dotenv import load_dotenv

load_dotenv()
API_ID = int(os.getenv('TELEGRAM_API_ID'))
API_HASH = os.getenv('TELEGRAM_API_HASH')

print('🔐 Telegram Session Generator')
print('=' * 50)
print('This will create a session string for Railway deployment.')
print()

with TelegramClient(StringSession(), API_ID, API_HASH) as client:
    print('✅ Connected to Telegram')
    print()
    print('🔑 Copy this session string:')
    print('=' * 50)
    session_string = client.session.save()
    print(session_string)
    print('=' * 50)
    print()
    print('📝 Add to .env or Railway:')
    print(f'TELEGRAM_SESSION_STRING={session_string}')
