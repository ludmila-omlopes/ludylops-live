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

type AdminDashboardSection = {
  id: string;
  title: string;
  items: AdminDashboardTab[];
};

export function AdminDashboardTabs({ sections }: { sections: AdminDashboardSection[] }) {
  const tabs = sections.flatMap((section) => section.items);
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");
  const selected = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  if (!selected) {
    return null;
  }

  return (
    <section className="landing-plane landing-divider bg-[var(--color-paper-pink)] py-6 sm:py-8 lg:h-[calc(100vh-10.5rem)] lg:min-h-[640px] lg:overflow-hidden">
      <div className="mx-auto grid h-full w-full max-w-[1500px] items-start gap-6 px-4 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-10">
        <aside className="panel surface-section p-3 lg:h-full lg:overflow-y-auto lg:overscroll-contain">
          <div className="grid gap-4" role="tablist" aria-label="Módulos do admin">
            {sections.map((section) => (
              <div key={section.id} className="grid gap-2">
                <p className="px-2 text-xs font-black uppercase text-[var(--color-ink-soft)]">
                  {section.title}
                </p>
                <div className="grid gap-2">
                  {section.items.map((tab) => {
                    const isActive = tab.id === selected.id;
                    return (
                      <Button
                        key={tab.id}
                        type="button"
                        variant={isActive ? "accent" : "neutral"}
                        size="sm"
                        onClick={() => setActiveTab(tab.id)}
                        className="min-h-16 w-full items-start justify-start whitespace-normal p-3 text-left"
                        role="tab"
                        id={`admin-tab-trigger-${tab.id}`}
                        aria-controls={`admin-tab-${tab.id}`}
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
            ))}
          </div>
        </aside>

        <div
          className="min-w-0 self-start lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pr-2"
          id={`admin-tab-${selected.id}`}
          role="tabpanel"
          aria-labelledby={`admin-tab-trigger-${selected.id}`}
        >
          {selected.content}
        </div>
      </div>
    </section>
  );
}
