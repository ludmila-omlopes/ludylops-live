"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
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

export function ThemeToggle({ initialTheme = null }: { initialTheme?: ThemeMode | null }) {
  const theme = useSyncExternalStore(
    subscribe,
    getPreferredTheme,
    () => initialTheme ?? "light",
  );

  function handleToggle() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    persistTheme(nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

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
