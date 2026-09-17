# Контракты и соглашения для разработки модулей

Этот файл — общий договор между модулями. Прежде чем писать код, прочитай его, `CLAUDE.md`, `AGENTS.md` и `docs/*.md` по своей теме.

## Стек как он есть (важно: отличается от первоначального ARCHITECTURE.md)

- **Next.js 16.3** (App Router). Это НЕ тот Next, что в обучающих данных: `params`/`searchParams` — Promise, `cookies()`/`headers()` — async, middleware называется `proxy.ts`. Перед использованием незнакомого API читай `node_modules/next/dist/docs/01-app/`.
- **БД:** Postgres. Локально — встроенный **PGlite** в `./.data/pg` (без Docker), в проде — `DATABASE_URL`. ORM — Drizzle (`db/schema/*`). Миграции: `npm run db:generate` → `db/migrations/*.sql`, применяет `db/migrate.ts` вместе с `db/rls.sql`.
- **Auth:** Better Auth (`modules/auth/*`). **Очередь:** таблица `jobs` (`modules/jobs/queue.ts`). **Почта:** `modules/notifications/email.ts` (outbox, Resend опционально).
- **UI:** Tailwind v4 + свои компоненты в `ui/*` + Radix + lucide-react + `motion`. **i18n:** next-intl, локаль в cookie, без сегмента в URL.
- Менеджер пакетов — **npm**. Новые зависимости не добавлять без крайней необходимости.

## Жёсткие правила

1. **Не запускай `next dev`, `next build`, `npm run db:*`.** PGlite-папку `.data/pg` может открыть только один процесс. Проверяй себя `npx tsc --noEmit` и `npx vitest run tests/unit/<свои>` / `tests/integration/<свои>` (тесты идут на PGlite в памяти, см. `tests/helpers/db.ts`).
2. **Не меняй** `db/schema/*`, `db/rls.sql`, `db/client.ts`, `modules/questions/types.ts`, `modules/assessments/types.ts`, `modules/shared/*`, `modules/auth/*`, `ui/*` (кроме добавления НОВЫХ файлов в `ui/`), `app/layout.tsx`, `app/globals.css`, `i18n/*`, layout-файлы кабинетов. Если чего-то не хватает в схеме или контракте — не правь молча, а опиши в финальном отчёте, что нужно добавить. Свои новые файлы создавай только в своей зоне (см. задание).
3. **Бизнес-логика — в `modules/<домен>/`**, без React. Страницы и компоненты только вызывают Server Actions и функции модулей.
4. **Никакого хардкода текста в компонентах.** Все строки — через `messages/{ru,en,uz}/<namespace>.json` (свои namespaces указаны в задании; заполняй все три языка, ru — основной). Серверные компоненты: `const t = await getTranslations("ns")`, клиентские: `useTranslations("ns")`. Общие слова уже есть в `common`, `errors`, `nav`.
5. **Никаких эмодзи в интерфейсе**, иконки — `lucide-react`. Никаких `TODO`, заглушек, закомментированного кода.
6. **Верные ответы не уходят ученику до сдачи попытки.** Ученику отдаётся только `PublicQuestion` (`modules/questions/public.ts → toPublic`). Скоринг — только на сервере (`modules/questions/scoring.ts → scoreAnswer`). Время — только серверное.
7. Все входные данные Server Actions валидируются **Zod**. Текст ошибок пользователю — ключи `errors.<code>`.

## Доступ к данным

```ts
import { getDb, withUser, schema, rows, type Executor } from "@/db/client";
```

- `withUser(userId, async (tx) => …)` — транзакция от имени пользователя, **RLS включён** (роль `app_user`, `app.user_id`). Используй для всего, что читает/пишет от лица пользователя в кабинетах. Политики описаны в `db/rls.sql`: репетитор видит свой workspace; ученик — свои назначения/попытки/прогресс; таблицы банка вопросов ученику недоступны вовсе.
- `getDb()` — доверенное подключение **без RLS**. Только для серверной логики, которой нужно видеть больше пользователя: скоринг, сборка варианта, проекция `toPublic`, пересчёт mastery, jobs, сиды. Каждый такой вызов обязан сам проверить права (через `requireTutor()/requireStudent()` и явные `where workspace_id = ctx.workspaceId` / `student_id = ctx.studentId`).
- `rows<T>(await db.execute(sql`…`))` — нормализует результат raw SQL (PGlite vs postgres-js).
- Глобальный каталог и глобальный банк: строки с `workspace_id IS NULL` (из сидов, только чтение). В выборках для репетитора всегда `or(isNull(workspaceId), eq(workspaceId, ctx.workspaceId))`.

## Server Actions

```ts
"use server";
import { action, AppError } from "@/modules/shared/result";
import { requireTutor, requireStudent } from "@/modules/auth/context";

export async function doThing(input: unknown) {
  return action(async () => {
    const ctx = await requireTutor();                 // { user, workspaceId, role, studentId }
    const data = schemaZ.parse(input);                // ZodError → поймай и брось AppError("validation") если нужны поля
    …
    return result;                                    // → { ok: true, data }
  });
}
```

Клиент: `const res = await doThing(x); if (!res.ok) toast.error(te(res.error.code)); else …` (`te = useTranslations("errors")`). После мутаций — `revalidatePath(...)` или `router.refresh()`.
Страницы кабинетов: `const ctx = await requireTutorPage()` / `requireStudentPage()` (редиректят сами).
Аудит значимых действий: `audit(tx, {...})` из `modules/shared/audit.ts`. Лимиты: `rateLimit(key, max, windowSec)`.

## Межмодульные точки (сигнатуры зафиксированы, файлы-заглушки уже лежат)

| Файл | Кто реализует | Кто вызывает |
|---|---|---|
| `modules/questions/repo.ts → insertQuestion(exec, input)`, `resolveTopicIds` | готово | все, кто создаёт вопросы |
| `modules/questions/scoring.ts → scoreAnswer`, `describeAnswer`; `public.ts → toPublic` | готово | assessments |
| `modules/generators/index.ts → listGenerators(), getGenerator(id), generateOne(id, opts), generateForTopic(code, n, opts)` | агент «generators» | questions/generator UI, seeds, assessments (добор банка) |
| `modules/assessments/service.ts → createBlueprintAssignment(input: PracticeInput)` | агент «assessments» | mastery (тренировка), lessons (домашка) через `modules/assessments/practice.ts` |
| `modules/mastery/service.ts → recordAttempt(attemptId)` | агент «mastery» | assessments через `modules/mastery/hooks.ts → onAttemptGraded` |
| `modules/notifications/service.ts → deliver(event)` | агент «people» | все через `modules/notifications/notify.ts → notify(event)` |
| `modules/jobs/queue.ts → enqueue, registerJob`; регистрация в `jobs/register.ts` | готово | все |

Контракт генераторов (агент «generators» создаёт, остальные полагаются):

```ts
export type GeneratorMeta = { id: string; topicCode: string; title: { ru: string; en?: string }; grade: number | null; types: QuestionType[]; difficulties: number[]; language: "ru" | "en"; isSat: boolean; wordProblem: boolean };
export function listGenerators(): GeneratorMeta[];
export function getGenerator(id: string): GeneratorMeta | undefined;
/** Детерминированно: один и тот же (id, seed, difficulty) → тот же вопрос. Ответ вычислен кодом, а не придуман. */
export function generateOne(id: string, opts: { seed: number; difficulty?: number }): QuestionDraft;
export function generateForTopic(topicCode: string, n: number, opts: { seed: number; difficultyMin?: number; difficultyMax?: number }): QuestionDraft[]; // включает поддерево по префиксу кода
```

## UI и дизайн

Направление — **Apple**: много воздуха, крупная плотная типографика, нейтральная палитра, один синий акцент, матовое стекло на панелях, мягкие анимации на `cubic-bezier(.28,.11,.32,1)`. Всё строится из токенов в `app/globals.css` и компонентов `ui/*`:

- Типографика: классы `t-hero, t-display, t-title, t-h2, t-h3, t-lead, t-small, t-caption, t-eyebrow, tnum`.
- Цвета только через токены Tailwind: `bg-bg, bg-surface, bg-surface-2, bg-surface-3, text-ink, text-ink-2, text-muted, text-faint, border-line, border-line-strong, bg-accent, text-accent-text, bg-accent-soft`, семантика `ok/warn/bad` (`bg-ok-soft text-ok-text` и т.п.). Никаких hex в компонентах. Тёмная тема работает автоматически через токены.
- Радиусы: `rounded-md (14) / rounded-lg (20) / rounded-xl (28)`, кнопки и чипы — `rounded-full`. Тени: `shadow-sm/md/lg`.
- Компоненты: `Button` (variant primary|secondary|outline|ghost|quiet|danger|ink; size sm|md|lg|icon; `loading`, `asChild`), `Input, Textarea, Select, Label, Field, Checkbox, Switch`, `Card, CardHeader, CardTitle, CardBody, Stat`, `Badge` (tone), `Difficulty`, `Skeleton, SkeletonRows, EmptyState, ErrorState, ProgressBar`, `TableWrap, Table, Th, Td, Tr`, `PageHeader, Section`, `RichText` (Markdown + LaTeX через `$…$`, безопасно), `Dialog, DialogTrigger, DialogContent, DialogClose` (`ui/dialog`), `Tabs, TabsList, TabsTrigger, TabsContent, Segmented` (`ui/tabs`), `Reveal, RevealGroup, RevealItem, CountUp` (`ui/reveal`). Тосты — `import { toast } from "sonner"`.
- Анимации: появление секций — класс `rise` (+ `style={{"--i": n}}` для ступенчатой задержки) или `Reveal`; нажатия — уже в `Button`; списки/карточки — `transition … duration-300 ease-apple`, hover-подъём `hover:-translate-y-0.5 hover:shadow-md`. Длительности 150–300 мс для микровзаимодействий, до 800 мс для входа секций. Без прыгающего layout. Уважай `prefers-reduced-motion` (глобально уже учтено для CSS; в `motion` используй `useReducedMotion`).
- Каждый экран обязан иметь состояния: загрузка (`loading.tsx` со скелетонами), пусто (`EmptyState` с объяснением и действием), ошибка (`ErrorState`/тост), успех.
- Кабинет ученика — mobile-first (цель касания ≥ 44px, один столбец, крупный текст задач). Кабинет репетитора — desktop-first, но не ломается на телефоне (таблицы внутри `TableWrap`).
- Доступность: семантические теги, `label` у всех полей, `aria-*`, видимый фокус (глобально задан), полная работа с клавиатуры. Графики — чистый SVG на токенах, одна мысль на график, подписи осей, без градиентного шума; цвет не единственный носитель смысла (добавляй подпись/иконку).
- Математика в текстах задач: Markdown + `$…$`/`$$…$$` (KaTeX) через `<RichText>`.

## Маршруты (оболочки и навигация уже есть)

Репетитор: `/tutor` (обзор), `/tutor/students`, `/tutor/students/[id]`, `/tutor/assessments`, `/tutor/assessments/[id]`, `/tutor/assessments/attempts/[attemptId]`, `/tutor/questions`, `/tutor/generator`, `/tutor/catalog`, `/tutor/lessons`, `/tutor/settings`.
Ученик: `/student` (сегодня), `/student/assignment/[id]`, `/student/attempt/[id]`, `/student/attempt/[id]/result`, `/student/practice`, `/student/progress`.
Родитель: `/parent`, публичный отчёт `/r/[token]`.
