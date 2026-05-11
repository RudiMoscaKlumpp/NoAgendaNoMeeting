#!/usr/bin/env bash
set -euo pipefail

echo "=== No Agenda? No Meeting — Quick Setup ==="
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "❌ Node.js is not installed. Install Node.js 20+ first: https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ required (you have $(node -v))"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install --silent
echo "✅ Dependencies installed"

# Create .env if it doesn't exist
if [ -f .env ]; then
  echo ""
  echo "✅ .env already exists — skipping config"
  echo "   (delete .env and re-run this script to reconfigure)"
else
  echo ""
  echo "--- Google OAuth Setup ---"
  echo "You need OAuth 2.0 credentials from Google Cloud Console."
  echo "  1. Go to https://console.cloud.google.com/apis/credentials"
  echo "  2. Create an OAuth 2.0 Client ID (Web application)"
  echo "  3. Add this redirect URI: http://localhost:3000/auth/google/callback"
  echo "  4. Enable the Google Calendar API under APIs & Services → Library"
  echo ""

  read -rp "Google Client ID: " GOOGLE_CLIENT_ID
  read -rp "Google Client Secret: " GOOGLE_CLIENT_SECRET
  echo ""

  echo "--- SMTP Setup (for sending notification emails) ---"
  echo "If you use Mailgun, the host is smtp.mailgun.org and port is 587."
  echo ""

  read -rp "SMTP Host [smtp.mailgun.org]: " SMTP_HOST
  SMTP_HOST=${SMTP_HOST:-smtp.mailgun.org}
  read -rp "SMTP Port [587]: " SMTP_PORT
  SMTP_PORT=${SMTP_PORT:-587}
  read -rp "SMTP User: " SMTP_USER
  read -rp "SMTP Password: " SMTP_PASS
  read -rp "Email From address [No Agenda No Meeting <nanm@wooga.com>]: " EMAIL_FROM
  EMAIL_FROM=${EMAIL_FROM:-"No Agenda No Meeting <nanm@wooga.com>"}

  # Auto-generate secrets
  TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
  SESSION_SECRET=$(openssl rand -hex 16)
  SHS_SECRET=$(openssl rand -hex 16)

  cat > .env <<EOF
# Google OAuth2 credentials
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# App settings
PORT=3000
SESSION_SECRET=${SESSION_SECRET}

# Encryption key (auto-generated)
TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}

# SHS auth (auto-generated)
SHS_SECRET=${SHS_SECRET}

# App URL
APP_URL=http://localhost:3000

# SMTP settings
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
EMAIL_FROM=${EMAIL_FROM}
EOF

  echo ""
  echo "✅ .env created (secrets auto-generated)"
fi

# Build
echo ""
echo "Building..."
npm run build --silent
echo "✅ Build complete"

echo ""
echo "=== Ready! ==="
echo ""
echo "Start the server:"
echo "  npm start"
echo ""
echo "Then open http://localhost:3000/auth/google to sign in."
echo ""
echo "To share with testers on your network, find your IP:"
echo "  ipconfig getifaddr en0    (Wi-Fi)"
echo "  Then testers visit: http://YOUR_IP:3000/auth/google"
echo ""
