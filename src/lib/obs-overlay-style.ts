export type ObsOverlayStyle = "classic" | "obscur";

export interface ObsOverlayStyleConfigRecord {
  style: ObsOverlayStyle;
  updatedAt: string | null;
  updatedBy: string | null;
}

type SearchParamReader = {
  get(name: string): string | null;
};

const obscurStyleAliases = new Set(["obscur", "clair-obscur", "minimal", "minimalista"]);

export function normalizeObsOverlayStyle(value: unknown): ObsOverlayStyle | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return obscurStyleAliases.has(normalized) ? "obscur" : normalized === "classic" ? "classic" : null;
}

export function getObsOverlayStyle(searchParams: SearchParamReader): ObsOverlayStyle | null {
  for (const key of ["style", "design", "theme", "variant"]) {
    const style = normalizeObsOverlayStyle(searchParams.get(key));
    if (style) {
      return style;
    }
  }

  return null;
}

export function getObsOverlayStyleFromSearchParamsRecord(
  searchParams: Record<string, string | string[] | undefined>,
): ObsOverlayStyle | null {
  for (const key of ["style", "design", "theme", "variant"]) {
    const rawValue = searchParams[key];
    const style = normalizeObsOverlayStyle(Array.isArray(rawValue) ? rawValue[0] : rawValue);
    if (style) {
      return style;
    }
  }

  return null;
}
