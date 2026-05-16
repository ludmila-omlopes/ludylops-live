"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type AdminDashboardTab = {
  id: string;
  label: string;
  description: string;
  badge?: string;
  content: ReactNode;
};

export function AdminDashboardTabs({ tabs }: { tabs: AdminDashboardTab[] }) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");
  const selected = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  if (!selected) {
    return null;
  }

  return (
    <section className="landing-plane landing-divider bg-[var(--color-paper-pink)] py-6 sm:py-8">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
        <div className="panel surface-section p-3 sm:p-4">
          <div className="grid gap-3 md:grid-cols-4" role="tablist" aria-label="Áreas do admin">
            {tabs.map((tab) => {
              const isActive = tab.id === selected.id;
              return (
                <Button
                  key={tab.id}
                  type="button"
                  variant={isActive ? "accent" : "neutral"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className="min-h-20 w-full items-start justify-start whitespace-normal p-3 text-left"
                  role="tab"
                  aria-controls={`admin-tab-${tab.id}`}
                  aria-pressed={isActive}
                  aria-selected={isActive}
                >
                  <span className="grid gap-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-black uppercase">
                      {tab.label}
                      {tab.badge ? (
                        <span className="badge-brutal bg-[var(--color-paper)] px-2 py-0.5 text-[10px] text-[var(--color-ink)]">
                          {tab.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs normal-case leading-snug opacity-80">
                      {tab.description}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="mt-6" id={`admin-tab-${selected.id}`} role="tabpanel">
          {selected.content}
        </div>
      </div>
    </section>
  );
}
