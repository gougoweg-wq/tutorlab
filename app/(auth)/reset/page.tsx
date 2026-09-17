import { Suspense } from "react";
import { ResetForm } from "@/modules/auth/ui/reset-form";
export const metadata = { title: "Сброс пароля" };
export default function ResetPage() { return <Suspense><ResetForm /></Suspense>; }
