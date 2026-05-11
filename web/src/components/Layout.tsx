import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-ctp-base">
      <header className="flex items-center justify-between px-6 md:px-10 py-6">
        <a
          href="#/"
          className="text-xs font-black text-text uppercase tracking-widest hover:text-sapphire"
        >
          No Agenda? No Meeting
        </a>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-2xl px-6 md:px-10 pb-16">
        {children}
      </main>
    </div>
  );
}
