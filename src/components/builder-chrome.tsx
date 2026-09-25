"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { AuthButtons } from "@/components/auth-buttons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import type { ThemeMode } from "@/lib/theme";
import { PLATFORM_NAME } from "@/lib/creators/platform";
import { COMMUNITIES_PATH, NEW_COMMUNITY_PATH } from "@/lib/creators/owner-dashboard";

type NavItem = {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
  tone?: "admin";
};

export function builderNavItems({
  isSignedIn,
  isPlatformOwner,
}: {
  isSignedIn: boolean;
  isPlatformOwner: boolean;
}): NavItem[] {
  const items: NavItem[] = isSignedIn
    ? [
        {
          href: COMMUNITIES_PATH,
          label: "Minhas comunidades",
          isActive: (pathname) =>
            pathname === COMMUNITIES_PATH ||
            (pathname.startsWith(`${COMMUNITIES_PATH}/`) && pathname !== NEW_COMMUNITY_PATH),
        },
        {
          href: NEW_COMMUNITY_PATH,
          label: "Nova comunidade",
          isActive: (pathname) => pathname === NEW_COMMUNITY_PATH,
        },
      ]
    : [
        {
          href: "/criar-area",
          label: "Criar área",
          isActive: (pathname) => pathname === "/criar-area",
        },
      ];

  if (isPlatformOwner) {
    items.push({
      href: "/owner",
      label: "Administrar comunidades",
      isActive: (pathname) => pathname === "/owner",
      tone: "admin",
    });
  }

  return items;
}

function desktopLinkClass(item: NavItem, active: boolean) {
  const base = "rounded-[var(--radius)] border px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em]";
  if (item.tone === "admin") {
    return `${base} admin-action border-[2px] border-[var(--color-ink)] text-[var(--color-admin-ink)]${
      active ? " shadow-[4px_4px_0_var(--shadow-color)]" : ""
    }`;
  }
  return active
    ? `${base} border-[2px] border-[var(--color-ink)] bg-[var(--color-purple)] text-[var(--color-accent-ink)] shadow-[4px_4px_0_var(--shadow-color)]`
    : `${base} border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]`;
}

function mobileLinkClass(item: NavItem, active: boolean) {
  const base = "border-[2px] border-[var(--color-ink)] px-4 py-3 text-sm font-extrabold uppercase";
  if (item.tone === "admin") {
    return `${base} admin-action`;
  }
  return active ? `${base} bg-[var(--color-purple)] text-[var(--color-accent-ink)]` : base;
}

export function BuilderChrome({
  children,
  initialTheme = null,
  isPlatformOwner = false,
  isSignedIn = false,
}: {
  children: React.ReactNode;
  initialTheme?: ThemeMode | null;
  isPlatformOwner?: boolean;
  isSignedIn?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = builderNavItems({ isSignedIn, isPlatformOwner });

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-40 border-b-[3px] border-[var(--color-ink)] bg-[var(--color-header-surface)]"
        aria-label={PLATFORM_NAME}
      >
        <div className="mx-auto flex w-full max-w-[1500px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Link
            href={isSignedIn ? COMMUNITIES_PATH : "/criar-area"}
            className="shrink-0 text-xl font-black uppercase text-[var(--color-ink)]"
          >
            {PLATFORM_NAME}
          </Link>

          <nav className="ml-auto hidden items-center gap-2 md:flex" aria-label="Navegação de comunidades">
            {navItems.map((item) => {
              const active = item.isActive(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={desktopLinkClass(item, active)}
                >
                  {item.label}
                </Link>
              );
            })}
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
              {navItems.map((item) => {
                const active = item.isActive(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={mobileLinkClass(item, active)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 border-t-[2px] border-[var(--color-ink)] pt-4">
              <AuthButtons />
            </div>
          </div>
        ) : null}
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
