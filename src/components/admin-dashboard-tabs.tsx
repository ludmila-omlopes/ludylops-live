"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Coins, Dices, Radio, Users, type LucideIcon } from "lucide-react";
import styles from "./admin-tab-content.module.css";

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
  const [expandedSection, setExpandedSection] = useState(
    sections.find((section) => section.items.some((tab) => tab.id === tabs[0]?.id))?.id ??
      sections[0]?.id ??
      "",
  );
  const scrollPositionBeforeTabChange = useRef<number | null>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousOverflowAnchor = root.style.overflowAnchor;
    const previousBodyOverflowAnchor = body.style.overflowAnchor;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.overflowAnchor = "none";
    body.style.overflowAnchor = "none";
    root.style.scrollBehavior = "auto";

    return () => {
      root.style.overflowAnchor = previousOverflowAnchor;
      body.style.overflowAnchor = previousBodyOverflowAnchor;
      root.style.scrollBehavior = previousScrollBehavior;
    };
  }, []);

  useLayoutEffect(() => {
    if (scrollPositionBeforeTabChange.current === null) {
      return;
    }

    window.scrollTo(0, scrollPositionBeforeTabChange.current);
    scrollPositionBeforeTabChange.current = null;
  }, [activeTab]);

  const selectTab = (tabId: string, sectionId: string) => {
    scrollPositionBeforeTabChange.current = window.scrollY;
    setActiveTab(tabId);
    setExpandedSection(sectionId);
  };

  const selected = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  if (!selected) {
    return null;
  }

  const sectionIcons: Record<string, LucideIcon> = {
    live: Radio,
    apostas: Dices,
    comunidade: Users,
    pipetz: Coins,
  };

  return (
    // Clip horizontal overflow without creating another scroll container.
    <section className="landing-divider overflow-clip bg-[var(--color-paper-pink)] py-6 sm:py-8 dark:bg-[var(--surface-card)]">
      <div className="mx-auto grid w-full max-w-[1500px] items-start gap-6 px-4 sm:px-6 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-8 lg:px-10">
        <aside className="panel surface-section self-start p-2">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line-soft)] px-3 pb-3 pt-2">
            <div>
              <h2 className="text-xl uppercase" style={{ fontFamily: "var(--font-display)" }}>
                Módulos
              </h2>
              <p className="mt-1 text-xs font-bold text-[var(--color-ink-soft)]">
                Operação da live
              </p>
            </div>
            <span className="mono border border-[var(--color-ink)] bg-[var(--color-admin)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]">
              Admin
            </span>
          </div>

          <nav className="mt-2" aria-label="Módulos da administração">
            <div className="grid gap-1" role="tablist" aria-label="Módulos do admin">
              {sections.map((section) => {
                const isExpanded = section.id === expandedSection;
                const Icon = sectionIcons[section.id];

                return (
                  <div key={section.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setExpandedSection(isExpanded ? "" : section.id);
                        if (!isExpanded && section.items[0]) {
                          selectTab(section.items[0].id, section.id);
                        }
                      }}
                      className="flex min-h-11 w-full items-center gap-3 border border-transparent px-3 py-2 text-left transition-colors duration-[var(--snap)] hover:border-[var(--color-ink)] hover:bg-[var(--color-lavender)] focus-visible:border-[var(--color-ink)] focus-visible:outline-none"
                      aria-expanded={isExpanded}
                      aria-controls={`admin-section-${section.id}`}
                    >
                      {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
                      <span className="min-w-0 flex-1 text-xs font-black uppercase tracking-[0.08em]">
                        {section.title}
                      </span>
                      <span className="mono min-w-5 text-center text-[10px] font-bold text-[var(--color-ink-soft)]">
                        {section.items.length}
                      </span>
                      <ChevronDown
                        className={`size-4 shrink-0 transition-transform duration-[var(--snap)] ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    <div
                      id={`admin-section-${section.id}`}
                      className="mt-1 grid gap-1"
                      role="presentation"
                      hidden={!isExpanded}
                    >
                      {section.items.map((tab) => {
                        const isActive = tab.id === selected.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectTab(tab.id, section.id)}
                            className={`group flex min-h-10 w-full items-center gap-2 border-l-4 px-3 py-2 text-left transition-colors duration-[var(--snap)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-purple-mid)] focus-visible:ring-offset-1 ${
                              isActive
                                ? "border-l-[var(--color-admin)] bg-[var(--color-admin)] text-[var(--color-admin-ink)]"
                                : "border-l-transparent text-[var(--color-ink-soft)] hover:border-l-[var(--color-purple-mid)] hover:bg-[var(--color-lavender)] hover:text-[var(--color-ink)]"
                            }`}
                            role="tab"
                            id={`admin-tab-trigger-${tab.id}`}
                            aria-controls={`admin-tab-${tab.id}`}
                            aria-selected={isActive}
                            title={tab.description}
                          >
                            <span className="min-w-0 flex-1 truncate text-xs font-black uppercase tracking-[0.04em]">
                              {tab.label}
                            </span>
                            {tab.badge ? (
                              <span
                                className={`mono shrink-0 border px-1.5 py-1 text-[10px] font-bold leading-none ${
                                  isActive
                                    ? "border-[var(--color-admin-ink)] bg-[var(--color-paper)] text-[var(--color-ink)]"
                                    : "border-[var(--color-line-soft)] bg-[var(--color-paper)] text-[var(--color-ink-soft)]"
                                }`}
                              >
                                {tab.badge}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </nav>
        </aside>

        <div
          className={styles.content}
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
