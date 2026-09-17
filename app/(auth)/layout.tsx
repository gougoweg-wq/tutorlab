import { Logo } from "@/ui/shell/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="h-14 px-5 flex items-center max-w-[980px] w-full mx-auto"><Logo /></header>
      <main id="main" className="flex-1 grid place-items-center px-5 py-10">
        <div className="w-full max-w-[400px] rise">{children}</div>
      </main>
    </div>
  );
}
