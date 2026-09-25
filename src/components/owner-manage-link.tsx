import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Shown to the community owner on public pages, pointing to the matching Creator Hub section. */
export function OwnerManageLink({ href, label, className = "" }: { href: string; label: string; className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-[3px] border-[var(--color-ink)] bg-[var(--color-sky)] p-4 text-[var(--color-ink)] shadow-[4px_4px_0_var(--shadow-color)] ${className}`}
    >
      <p className="text-sm font-bold">Você administra esta comunidade.</p>
      <Link href={href} className="btn-brutal ink-button px-4 py-2 text-xs text-[var(--color-accent-ink)]">
        {label}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
