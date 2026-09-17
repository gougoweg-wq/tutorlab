#!/bin/sh
# Публичный адрес для телефона ученика без регистрации и хостинга: Cloudflare quick tunnel → локальный сервер.
# Работает, пока включён этот компьютер. Адрес новый при каждом запуске.
set -e
cd "$(dirname "$0")/.."
command -v cloudflared >/dev/null || { echo "Нужен cloudflared: brew install cloudflared"; exit 1; }
PORT="${PORT:-3000}"
LOG="$(mktemp)"
cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" >"$LOG" 2>&1 &
TUNNEL=$!
trap 'kill $TUNNEL 2>/dev/null; rm -f "$LOG"' EXIT INT TERM
URL=""
for i in $(seq 1 40); do URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1)"; [ -n "$URL" ] && break; sleep 1; done
[ -n "$URL" ] || { echo "Туннель не поднялся:"; cat "$LOG"; exit 1; }
echo ""
echo "  Адрес для ученика:  $URL"
echo "  Демо без пароля:    $URL/demo"
echo ""
[ -d .next ] && [ -f .next/BUILD_ID ] || npm run build
NEXT_PUBLIC_APP_URL="$URL" BETTER_AUTH_URL="$URL" npx next start -p "$PORT"
