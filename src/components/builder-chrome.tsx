"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { AuthButtons } from "@/components/auth-buttons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import type { ThemeMode } from "@/lib/theme";

export function BuilderChrome({
  children,
  initialTheme = null,
  isPlatformOwner = false,
}: {
  children: React.ReactNode;
  initialTheme?: ThemeMode | null;
  isPlatformOwner?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isCreateAreaActive = pathname === "/criar-area";
  const isOwnerActive = pathname === "/owner";

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-40 border-b-[3px] border-[var(--color-ink)] bg-[var(--color-header-surface)]"
        aria-label="Comunidades"
      >
        <div className="mx-auto flex w-full max-w-[1500px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Link href="/criar-area" className="shrink-0 text-xl font-black uppercase text-[var(--color-ink)]">
            Comunidades
          </Link>

          <nav className="ml-auto hidden items-center gap-2 md:flex" aria-label="Navegação de comunidades">
            <Link
              href="/criar-area"
              className={`rounded-[var(--radius)] border px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em] ${
                isCreateAreaActive
                  ? "border-[2px] border-[var(--color-ink)] bg-[var(--color-purple)] text-[var(--color-accent-ink)] shadow-[4px_4px_0_var(--shadow-color)]"
                  : "border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
              }`}
            >
              Criar área
            </Link>
            {isPlatformOwner ? (
              <Link
                href="/owner"
                className={`rounded-[var(--radius)] border px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em] ${
                  isOwnerActive
                    ? "admin-action border-[2px] border-[var(--color-ink)] text-[var(--color-admin-ink)] shadow-[4px_4px_0_var(--shadow-color)]"
                    : "admin-action border-[2px] border-[var(--color-ink)] text-[var(--color-admin-ink)]"
                }`}
              >
                Administrar comunidades
              </Link>
            ) : null}
            <Link
              href="/"
              className="rounded-[var(--radius)] border border-transparent px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
            >
              Ludylops
            </Link>
            <ThemeToggle initialTheme={initialTheme} />
            <AuthButtons />
          </nav>

          <div className="ml-auto flex items-center gap-3 md:hidden">
            <ThemeToggle initialTheme={initialTheme} />
            <Button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              variant="pink"
              size="sm"
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? "Fechar" : "Menu"}
            </Button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-4 md:hidden">
            <nav className="flex flex-col gap-2" aria-label="Navegação de comunidades">
              <Link
                href="/criar-area"
                onClick={() => setMobileOpen(false)}
                className="border-[2px] border-[var(--color-ink)] px-4 py-3 text-sm font-extrabold uppercase"
              >
                Criar área
              </Link>
              {isPlatformOwner ? (
                <Link
                  href="/owner"
                  onClick={() => setMobileOpen(false)}
                  className="admin-action border-[2px] border-[var(--color-ink)] px-4 py-3 text-sm font-extrabold uppercase"
                >
                  Administrar comunidades
                </Link>
              ) : null}
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="border-[2px] border-[var(--color-ink)] px-4 py-3 text-sm font-extrabold uppercase"
              >
                Ludylops
              </Link>
            </nav>
            <div className="mt-4 border-t-[2px] border-[var(--color-ink)] pt-4">
              <AuthButtons />
            </div>
          </div>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
