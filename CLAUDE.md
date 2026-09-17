# TutorLab — правила репозитория

Платформа репетитора: ученики 6–11 классов, госпрограмма и SAT. Генерация заданий, автопроверка, карта усвоения. См. `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/MASTERY-MODEL.md`, `docs/ROADMAP.md`.

## Статус

Фаза 0 (проектирование) — документы написаны, ждут ревью. Кода ещё нет.

## Стек (после утверждения)

Next.js 15 + TypeScript, Supabase (Postgres, Auth, Storage, RLS), Drizzle ORM, Zod, Tailwind + shadcn/ui, KaTeX, next-intl, Inngest, Anthropic SDK за `LLMProvider`, Resend, Vitest, Playwright. Пакетный менеджер — pnpm.

## Команды (появятся в фазе 1)

```
pnpm i                  зависимости
supabase start          локальные Postgres/Auth/Storage (docker)
pnpm db:migrate         применить миграции Drizzle
pnpm db:seed            каталог тем и демо-данные
pnpm dev                приложение на http://localhost:3000
pnpm test               unit + integration (Vitest)
pnpm test:e2e           Playwright
pnpm lint && pnpm typecheck
pnpm ai:bench           бенчмарк генерации → docs/AI-QUALITY.md
```

## Соглашения

- Бизнес-логика только в `modules/*`; компоненты вызывают Server Actions, те — функции модулей. Модули не импортируют React.
- Все входные данные валидируются Zod на границе. Ответы ИИ — тоже, никакого парсинга свободного текста.
- Верные ответы не отдаются клиенту до `submitted_at`. Скоринг только на сервере.
- Тексты интерфейса только через `messages/{ru,en,uz}.json`. Русский по умолчанию.
- Никаких эмодзи вместо иконок в интерфейсе; иконки — lucide-react.
- Миграции: только через `drizzle-kit generate`, каждая с обратным скриптом в `db/migrations/down/`.
- Ключи только в `.env.local`; `.env.example` описывает каждую переменную.
- Никаких `TODO` в коде без задачи в `docs/BACKLOG.md`. Никакого закомментированного кода.
- Промпты в `prompts/<name>.v<N>.md`; смена промпта = новая версия.
- Коммиты на русском, в повелительном наклонении: «Добавить скоринг numeric».

## Структура

См. раздел 3 в `docs/ARCHITECTURE.md`.
