"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Menu, Moon, Sun, Users, X } from "lucide-react";

import { AuthButtons } from "@/components/auth-buttons";
import { useThemeMode } from "@/components/theme-toggle";
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
  isAdmin = false,
}: {
  isSignedIn: boolean;
  isPlatformOwner: boolean;
  isAdmin?: boolean;
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

  if (isAdmin) {
    items.push({ href: "/admin/beta", label: "Beta áreas", isActive: (pathname) => pathname === "/admin/beta", tone: "admin" });
  }
  return items;
}

function ThemeButton({ initialTheme }: { initialTheme: ThemeMode | null }) {
  const { theme, toggle } = useThemeMode(initialTheme, { followSystem: true });
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="hub-icon-btn"
      onClick={toggle}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      aria-pressed={isDark}
      suppressHydrationWarning
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}

export function BuilderChrome({
  children,
  initialTheme = null,
  isPlatformOwner = false,
  isSignedIn = false,
  isAdmin = false,
  fontClassName = "",
}: {
  children: React.ReactNode;
  initialTheme?: ThemeMode | null;
  isPlatformOwner?: boolean;
  isSignedIn?: boolean;
  isAdmin?: boolean;
  fontClassName?: string;
}) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = builderNavItems({ isSignedIn, isPlatformOwner, isAdmin });

  const links = (onNavigate?: () => void) =>
    navItems.map((item) => {
      const active = item.isActive(pathname);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={`hub-nav-link${item.tone === "admin" ? " is-admin" : ""}`}
        >
          {item.label}
        </Link>
      );
    });

  return (
    <div className={`hub-scope flex min-h-screen flex-col ${fontClassName}`}>
      <header className="hub-nav" aria-label={PLATFORM_NAME}>
        <div className="hub-nav-inner">
          <Link href={isSignedIn ? COMMUNITIES_PATH : "/inicio"} className="hub-brand">
            <span className="hub-brand-mark">
              <Users aria-hidden="true" />
            </span>
            {PLATFORM_NAME}
          </Link>

          <nav className="hub-nav-links" aria-label="Navegação de comunidades">
            {links()}
          </nav>
          <div className="hub-nav-actions hub-desktop-only">
            <ThemeButton initialTheme={initialTheme} />
            <AuthButtons />
          </div>

          <div className="hub-nav-actions hub-mobile-only" style={{ marginLeft: "auto" }}>
            <ThemeButton initialTheme={initialTheme} />
            <button
              type="button"
              className="hub-icon-btn"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="hub-mobile-menu">
            <nav className="grid gap-1" aria-label="Navegação de comunidades">
              {links(() => setMobileOpen(false))}
            </nav>
            <AuthButtons />
          </div>
        ) : null}
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
