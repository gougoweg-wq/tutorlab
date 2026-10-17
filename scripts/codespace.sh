#!/bin/sh
# GitHub Codespaces: setup — зависимости, база, аккаунты, сборка (один раз при создании); start — сервер на порту 3000.
# Логин и пароль владельца берутся из секретов Codespaces OWNER_EMAIL / OWNER_PASSWORD, иначе генерируются и печатаются.
set -e
cd "$(dirname "$0")/.."
PORT=3000
URL="https://${CODESPACE_NAME}-${PORT}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
rand() { node -e "console.log(require('crypto').randomBytes($1).toString('base64url'))"; }

case "$1" in
  setup)
    npm ci --no-audit --no-fund
    if [ ! -f .env.local ]; then
      cat > .env.local <<ENV
NEXT_PUBLIC_APP_URL=$URL
BETTER_AUTH_URL=$URL
TRUSTED_ORIGINS=$URL
BETTER_AUTH_SECRET=$(rand 32)
JOBS_SECRET=$(rand 24)
OWNER_EMAIL=${OWNER_EMAIL:-owner@tutorlab.app}
OWNER_PASSWORD=${OWNER_PASSWORD:-$(rand 9)}
GUEST_EMAIL=guest@tutorlab.app
GUEST_PASSWORD=$(rand 12)
ENV
    fi
    npm run setup
    npm run db:owner
    npm run db:guest
    npm run build
    sh scripts/codespace.sh info
    ;;
  start)
    pgrep -f "next start" >/dev/null && exit 0
    [ -f .next/BUILD_ID ] || npm run build
    exec npx next start -p "$PORT"
    ;;
  info)
    echo ""
    echo "  TutorLab:        $URL"
    echo "  Демо без пароля: $URL/demo"
    grep -E '^OWNER_(EMAIL|PASSWORD)=' .env.local | sed 's/^OWNER_EMAIL=/  Логин:           /; s/^OWNER_PASSWORD=/  Пароль:          /'
    echo ""
    ;;
  *) echo "usage: $0 setup|start|info"; exit 1 ;;
esac
