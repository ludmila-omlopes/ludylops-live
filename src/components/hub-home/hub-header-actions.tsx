"use client";

import Link from "next/link";
import { getProviders, signIn } from "next-auth/react";
import { Moon, Sun } from "lucide-react";

import { useThemeMode } from "@/components/theme-toggle";
import { GOOGLE_AUTHORIZATION_PARAMS } from "@/lib/auth/google";
import type { ThemeMode } from "@/lib/theme";

import styles from "./hub-home.module.css";

const AFTER_SIGN_IN = "/criar-area";

export function HubHeaderActions({ initialTheme, createHref }: { initialTheme: ThemeMode | null; createHref: string }) {
  const { theme, toggle } = useThemeMode(initialTheme, { followSystem: true });
  const isDark = theme === "dark";

  async function handleSignIn() {
    const providers = await getProviders();
    if (providers?.google) {
      await signIn("google", { callbackUrl: AFTER_SIGN_IN }, GOOGLE_AUTHORIZATION_PARAMS);
    } else if (providers?.credentials) {
      await signIn("credentials", { email: "ana@example.com", callbackUrl: AFTER_SIGN_IN });
    }
  }

  return (
    <div className={styles.navRight}>
      <button
        type="button"
        className={styles.themeToggle}
        onClick={toggle}
        aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
        aria-pressed={isDark}
        suppressHydrationWarning
      >
        {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </button>
      <button type="button" className={`${styles.textButton} ${styles.navLogin}`} onClick={handleSignIn}>
        Entrar
      </button>
      <Link href={createHref} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>
        Criar comunidade
      </Link>
    </div>
  );
}
