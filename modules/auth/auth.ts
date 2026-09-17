import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { getDb, schema } from "@/db/client";
import { sendEmail, emailLayout } from "@/modules/notifications/email";

async function build() {
  const db = await getDb();
  const google = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : undefined;
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification } }),
    user: { additionalFields: { locale: { type: "string", required: false, defaultValue: "ru", input: true } }, deleteUser: { enabled: true } },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({ to: user.email, subject: "Сброс пароля · TutorLab", html: emailLayout("Сброс пароля", "Нажмите кнопку, чтобы задать новый пароль. Ссылка действует один час.", { label: "Задать новый пароль", url }) });
      },
    },
    socialProviders: google,
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, window: 60, max: 30, customRules: { "/sign-in/email": { window: 60, max: 8 }, "/sign-up/email": { window: 60, max: 5 }, "/sign-in/magic-link": { window: 60, max: 4 } } },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendEmail({ to: email, subject: "Вход в TutorLab", html: emailLayout("Вход по ссылке", "Нажмите кнопку, чтобы войти. Ссылка одноразовая и действует 5 минут.", { label: "Войти", url }) });
        },
      }),
      nextCookies(), // must be last: lets server actions set auth cookies
    ],
  });
}

type Auth = Awaited<ReturnType<typeof build>>;
const g = globalThis as unknown as { __tutorlab_auth?: Promise<Auth> };
export function getAuth(): Promise<Auth> { return (g.__tutorlab_auth ??= build()); }
export const googleEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
