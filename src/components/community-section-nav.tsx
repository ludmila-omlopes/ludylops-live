"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type CommunitySectionNavItem = { key: string; label: string; href: string };

export function CommunitySectionNav({ items }: { items: CommunitySectionNavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Seções da comunidade" className="min-w-0">
      <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap border-[2px] px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.08em] ${
                  active
                    ? "border-[var(--color-ink)] bg-[var(--color-purple)] text-[var(--color-accent-ink)] shadow-[4px_4px_0_var(--shadow-color)]"
                    : "border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
