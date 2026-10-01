"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  applyTheme,
  getPreferredTheme,
  persistTheme,
  themeStorageKey,
  type ThemeMode,
} from "@/lib/theme";

const themeChangeEvent = "pipetz-theme-change";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === themeStorageKey) {
      onStoreChange();
    }
  };
  const handleThemeChange = () => onStoreChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(themeChangeEvent, handleThemeChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(themeChangeEvent, handleThemeChange);
  };
}

/** Current theme plus a toggle, shared by every theme switch in the app.
 * With followSystem, a visitor without a saved choice keeps the system theme: the
 * light fallback used while hydrating is never written to the page. */
export function useThemeMode(initialTheme: ThemeMode | null = null, { followSystem = false } = {}) {
  const theme = useSyncExternalStore(
    subscribe,
    getPreferredTheme,
    () => initialTheme ?? "light",
  );

  useEffect(() => {
    if (followSystem && theme !== getPreferredTheme()) return;
    applyTheme(theme);
  }, [theme, followSystem]);

  function toggle() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    persistTheme(nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  return { theme, toggle };
}

export function ThemeToggle({ initialTheme = null }: { initialTheme?: ThemeMode | null }) {
  const { theme, toggle: handleToggle } = useThemeMode(initialTheme);
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      onClick={handleToggle}
      variant="accent"
      size="xs"
      className="min-w-0 px-3 sm:min-w-[104px]"
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      aria-pressed={isDark}
      suppressHydrationWarning
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
      <span className="mono hidden tracking-[0.18em] sm:inline" suppressHydrationWarning>
        {isDark ? "LIGHT ->" : "DARK ->"}
      </span>
    </Button>
  );
}
