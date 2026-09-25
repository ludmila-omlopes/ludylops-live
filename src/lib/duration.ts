export type DurationUnit = "seconds" | "minutes" | "hours";

export const durationUnitSeconds: Record<DurationUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
};

export const durationUnitLabels: Record<DurationUnit, string> = {
  seconds: "segundos",
  minutes: "minutos",
  hours: "horas",
};

/** Largest unit that represents the value exactly, so editing never rounds a saved interval. */
export function splitDuration(totalSeconds: number): { value: number; unit: DurationUnit } {
  const seconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  if (seconds > 0 && seconds % 3600 === 0) return { value: seconds / 3600, unit: "hours" };
  if (seconds > 0 && seconds % 60 === 0) return { value: seconds / 60, unit: "minutes" };
  return { value: seconds, unit: "seconds" };
}

export function toSeconds(value: number, unit: DurationUnit) {
  return Number.isFinite(value) ? Math.round(value * durationUnitSeconds[unit]) : Number.NaN;
}

/** Short Portuguese label, e.g. "45 s", "5 min", "1 h 30 min". */
export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const parts = [hours ? `${hours} h` : "", minutes ? `${minutes} min` : "", rest ? `${rest} s` : ""].filter(Boolean);
  return parts.length ? parts.join(" ") : "0 s";
}
