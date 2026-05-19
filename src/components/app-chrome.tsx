"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "next-auth";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { AuthButtons } from "@/components/auth-buttons";
import { LivestreamIndicator } from "@/components/livestream-indicator";
import { hasUsableAppSession } from "@/lib/auth/session-state";
import type { ThemeMode } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

type NavLink = {
  href: string;
  label: string;
};

type NavGroup = {
  label: string;
  links: NavLink[];
};

export function AppChrome({
  children,
  initialTheme = null,
  isAdmin = false,
  isLive = false,
  session,
}: {
  children: React.ReactNode;
  initialTheme?: ThemeMode | null;
  isAdmin?: boolean;
  isLive?: boolean;
  session: Session | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isObsView = pathname.startsWith("/obs/");

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) {
        setMobileOpen(false);
      }
    };
    mq.addEventListener("change", onChange);
    onChange();
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isObsView) {
      document.body.dataset.obsOverlay = "true";
      return () => {
        delete document.body.dataset.obsOverlay;
      };
    }

    delete document.body.dataset.obsOverlay;
    return undefined;
  }, [isObsView]);

  const primaryLinks: NavLink[] = [
    { href: "/apostas", label: "Apostas" },
    { href: "/ranking", label: "Ranking" },
  ];

  const navGroups: NavGroup[] = [
    {
      label: "Comunidade",
      links: [
        { href: "/indicacoes", label: "Canais que me inspiram" },
        { href: "/produtinhos", label: "Produtinhos que indico" },
        { href: "/jogos", label: "Jogos" },
        { href: "/videos", label: "Videos" },
      ],
    },
    {
      label: "Ao vivo",
      links: [
        { href: "/contadores", label: "Contadores" },
        { href: "/quotes", label: "Quotes" },
      ],
    },
  ];

  const authedLinks: NavLink[] = [{ href: "/me", label: "Meus Pipetz" }];
  const adminLinks: NavLink[] = isAdmin ? [{ href: "/admin", label: "Admin" }] : [];
  const hasUsableSession = hasUsableAppSession(session);

  const accountLinks = [...(hasUsableSession ? authedLinks : []), ...adminLinks];
  const mobileNavSections: NavGroup[] = [
    { label: "Principais", links: primaryLinks },
    ...navGroups,
    ...(accountLinks.length > 0 ? [{ label: "Conta", links: accountLinks }] : []),
  ];
  const isActiveLink = (href: string) => pathname === href;
  const isActiveGroup = (links: NavLink[]) => links.some((link) => isActiveLink(link.href));
  const showTicker = pathname === "/";
  if (isObsView) {
    return <>{children}</>;
  }

  const tickerText =
    "PIPETZ // GANHE ASSISTINDO // ENTRE NO POOL // RESGATE EFEITOS // SUBA NO RANKING // ";

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-40 border-b-[3px] border-[var(--color-ink)]"
        style={{ background: "var(--color-header-surface)" }}
      >
        <div className="mx-auto flex w-full max-w-[1500px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <div className="shrink-0">
            <Link href="/" className="group flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius)] border-[3px] border-[var(--color-ink)] bg-[var(--color-pink)] text-lg font-bold text-[var(--color-accent-ink)] shadow-[4px_4px_0_var(--shadow-color)] transition-transform group-hover:rotate-[-4deg]">
                Pz
              </div>
              <p
                className="text-xl font-bold uppercase text-[var(--color-ink)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Pipetz
              </p>
            </Link>
          </div>

          <div className="hidden flex-1 justify-center md:flex">
            <nav className="flex items-center gap-1">
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-[var(--radius)] border px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em] transition-colors duration-[var(--snap)] ${
                    isActiveLink(link.href)
                      ? "pastel-action border-[2px] border-[var(--color-ink)] bg-[var(--color-purple)] text-[var(--color-accent-ink)] shadow-[4px_4px_0_var(--shadow-color)]"
                      : "border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {navGroups.map((group) => {
                const groupActive = isActiveGroup(group.links);

                return (
                  <div key={group.label} className="group/nav relative">
                    <button
                      type="button"
                      className={`flex items-center gap-1 rounded-[var(--radius)] border px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em] transition-colors duration-[var(--snap)] ${
                        groupActive
                          ? "pastel-action border-[2px] border-[var(--color-ink)] bg-[var(--color-purple)] text-[var(--color-accent-ink)] shadow-[4px_4px_0_var(--shadow-color)]"
                          : "border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]"
                      }`}
                      aria-haspopup="menu"
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        className="h-3.5 w-3.5 transition-transform group-hover/nav:rotate-180 group-focus-within/nav:rotate-180"
                        aria-hidden="true"
                      />
                    </button>
                    <div
                      className="invisible absolute left-0 top-full z-50 min-w-52 pt-2 opacity-0 transition-opacity duration-[var(--snap)] group-hover/nav:visible group-hover/nav:opacity-100 group-focus-within/nav:visible group-focus-within/nav:opacity-100"
                      role="menu"
                    >
                      <div className="border-[2px] border-[var(--color-ink)] bg-[var(--color-paper)] p-2 shadow-[4px_4px_0_var(--shadow-color)]">
                        {group.links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className={`block rounded-[var(--radius)] border px-3 py-2 text-xs font-extrabold uppercase tracking-[0.1em] transition-colors duration-[var(--snap)] ${
                              isActiveLink(link.href)
                                ? "pastel-action border-[2px] border-[var(--color-ink)] bg-[var(--color-purple)] text-[var(--color-accent-ink)]"
                                : "border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:bg-[var(--color-lavender)] hover:text-[var(--color-ink)]"
                            }`}
                            role="menuitem"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {accountLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-[var(--radius)] border px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em] transition-colors duration-[var(--snap)] ${
                    link.href === "/admin"
                      ? "admin-action border-[2px] border-[var(--color-ink)] text-[var(--color-admin-ink)] shadow-[4px_4px_0_var(--shadow-color)]"
                      : isActiveLink(link.href)
                      ? "pastel-action border-[2px] border-[var(--color-ink)] bg-[var(--color-purple)] text-[var(--color-accent-ink)] shadow-[4px_4px_0_var(--shadow-color)]"
                      : "border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3 md:justify-end">
            <div className="hidden md:block">
              <LivestreamIndicator isLive={isLive} compact />
            </div>
            <ThemeToggle initialTheme={initialTheme} />
            <div className="hidden md:block">
              <AuthButtons />
            </div>
            <div className="shrink-0 md:hidden">
              <Button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                variant="pink"
                size="sm"
                aria-label="Menu"
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? "Fechar" : "Menu"}
              </Button>
            </div>
          </div>
        </div>

        {mobileOpen ? (
          <div className="mobile-nav-enter border-t-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-4 md:hidden">
            <div className="mb-4">
              <LivestreamIndicator isLive={isLive} />
            </div>
            <nav className="flex flex-col gap-4" aria-label="Navegação principal">
              {mobileNavSections.map((section) => (
                <div key={section.label} className="flex flex-col gap-1.5">
                  <p className="px-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-[var(--color-ink-soft)]">
                    {section.label}
                  </p>
                  {section.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`rounded-[var(--radius)] border px-4 py-3 text-sm font-extrabold uppercase tracking-[0.1em] transition-colors duration-[var(--snap)] ${
                        link.href === "/admin"
                          ? "admin-action border-[2px] border-[var(--color-ink)] text-[var(--color-admin-ink)] shadow-[4px_4px_0_var(--shadow-color)]"
                          : isActiveLink(link.href)
                          ? "pastel-action border-[2px] border-[var(--color-ink)] bg-[var(--color-purple)] text-[var(--color-accent-ink)] shadow-[4px_4px_0_var(--shadow-color)]"
                          : "border-[2px] border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)] active:border-[var(--color-ink)] active:bg-[var(--color-paper)] active:text-[var(--color-ink)]"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            <div className="mt-4 border-t-[2px] border-[var(--color-ink)] pt-4">
              <AuthButtons />
            </div>
          </div>
        ) : null}
      </header>

      {showTicker ? (
        <div className="marquee-strip" aria-hidden="true">
          <div className="marquee-inner">{tickerText.repeat(4)}</div>
        </div>
      ) : null}

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-[var(--color-backdrop)] md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <main className="flex-1">{children}</main>

      <footer className="border-t-[3px] border-[var(--color-ink)] bg-[var(--color-paper)]">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 px-4 py-5 text-sm font-medium text-[var(--color-ink-soft)] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <Link
            href="/privacy"
            className="w-fit font-black uppercase tracking-[0.08em] text-[var(--color-ink)] underline decoration-[3px] underline-offset-4"
          >
            Política de Privacidade
          </Link>
          <p className="flex items-center gap-2 text-[var(--color-ink)]">
            <span>Feito com carinho por ludylops</span>
            <span aria-hidden="true" className="text-lg text-[var(--color-pink)]">
              💗
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
