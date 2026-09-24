import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPipetz(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

/** @deprecated Use formatPipetz */
export const formatPoints = formatPipetz;

// Match the existing live/bet and daily-counter convention on both server and browser.
export const APP_TIME_ZONE = "America/Sao_Paulo";

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "agora";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function shortCode(size = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: size }, () => {
    const index = Math.floor(Math.random() * alphabet.length);
    return alphabet[index];
  }).join("");
}
