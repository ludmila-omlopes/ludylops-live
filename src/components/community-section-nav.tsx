"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type CommunitySectionNavItem = { key: string; label: string; href: string };

export function CommunitySectionNav({ items }: { items: CommunitySectionNavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Seções da comunidade" className="min-w-0">
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.key} className="shrink-0">
              <Link href={item.href} aria-current={active ? "page" : undefined} className="hub-nav-link block">
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
