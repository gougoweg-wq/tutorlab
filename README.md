# TutorLab

Платформа репетитора: банк из 12 000+ задач (математика 6–9, SAT Math), тесты с личными вариантами, серверная проверка, карта усвоения, тренировка с мгновенной обратной связью, уроки с домашкой в один клик. Русский, English, Oʻzbekcha.

## Запуск за пять минут

```bash
npm install
cp .env.example .env.local      # впишите OWNER_EMAIL / OWNER_PASSWORD, по желанию GUEST_*
npm run setup                   # миграции + каталог тем + банк задач
npm run db:owner                # аккаунт владельца
npm run db:guest                # гостевой ученик с демо-тестами (нужен для /demo)
npm run dev                     # http://localhost:3000
```

База — встроенный Postgres (PGlite) в `.data/pg`, Docker не нужен. Папку открывает только один процесс: перед `npm run db:*` остановите сервер.

## Дать доступ ученику с телефона

```bash
npm run share
```

Поднимает продакшн-сборку и публичный https-адрес через Cloudflare quick tunnel, без регистрации. Адрес печатается в терминале, `<адрес>/demo` пускает без пароля. Работает, пока включён компьютер; адрес новый при каждом запуске.

## Постоянный хостинг

Встроенная база на serverless не работает, нужен обычный Postgres:

1. Создайте базу (Supabase, Neon или свой сервер), впишите строку в `DATABASE_URL`.
2. `DATABASE_URL=… npm run setup && npm run db:owner` — миграции, RLS и банк задач зальются в неё.
3. Задеплойте репозиторий на Vercel или любой Node-хостинг; переменные: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `JOBS_SECRET`, по желанию `RESEND_API_KEY`, `GOOGLE_CLIENT_*`.
4. Настройте cron на `GET /api/jobs/run` с заголовком `Authorization: Bearer $JOBS_SECRET`.

## Проверка

```bash
npm test          # 200+ тестов: скоринг, генераторы, модель усвоения, сценарии доступа и RLS, переводы
npm run typecheck
```

Документы: `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/MASTERY-MODEL.md`, `docs/CONTRACTS.md`.
