#!/bin/sh
# Запуск одной командой — локально (npm run up) и в GitHub Codespaces.
# setup — зависимости, .env.local, база, аккаунты, сборка (повторно делает только недостающее); start — сервер на порту 3000; info — адрес и пароль.
# Логин и пароль владельца берутся из OWNER_EMAIL / OWNER_PASSWORD (в Codespaces — из секретов), иначе генерируются.
set -e
cd "$(dirname "$0")/.."
PORT=3000
if [ -n "$CODESPACE_NAME" ]; then URL="https://${CODESPACE_NAME}-${PORT}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"; else URL="http://localhost:$PORT"; fi
rand() { node -e "console.log(require('crypto').randomBytes($1).toString('base64url'))"; }
# дописывает переменную в .env.local, только если её там ещё нет
env_default() { grep -q "^$1=" .env.local 2>/dev/null || echo "$1=$2" >> .env.local; }
# сборка помечается коммитом, из которого сделана; после git pull / checkout она пересобирается
HEAD_REV="$(git rev-parse HEAD 2>/dev/null || echo none)"
build_if_stale() { [ -f .next/BUILD_ID ] && [ "$(cat .next/.built-from 2>/dev/null)" = "$HEAD_REV" ] || { npm run build && echo "$HEAD_REV" > .next/.built-from; }; }

case "$1" in
  setup)
    [ -d node_modules ] || npm ci --no-audit --no-fund
    env_default NEXT_PUBLIC_APP_URL "$URL"
    env_default BETTER_AUTH_URL "$URL"
    env_default TRUSTED_ORIGINS "$URL"
    env_default BETTER_AUTH_SECRET "$(rand 32)"
    env_default JOBS_SECRET "$(rand 24)"
    env_default OWNER_EMAIL "${OWNER_EMAIL:-owner@tutorlab.app}"
    env_default OWNER_PASSWORD "${OWNER_PASSWORD:-$(rand 9)}"
    env_default GUEST_EMAIL guest@tutorlab.app
    env_default GUEST_PASSWORD "$(rand 12)"
    if [ ! -d .data/pg ]; then npm run setup && npm run db:owner && npm run db:guest; fi
    build_if_stale
    sh scripts/up.sh info
    ;;
  start)
    pgrep -f "next start" >/dev/null && exit 0
    if command -v lsof >/dev/null && lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
      echo "Порт $PORT уже занят:"; lsof -nP -iTCP:$PORT -sTCP:LISTEN
      echo "Остановите его: kill \$(lsof -t -iTCP:$PORT -sTCP:LISTEN)"; exit 1
    fi
    build_if_stale
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
