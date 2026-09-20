import { loadEnvConfig } from "@next/env";

/** Same precedence as Next.js; a shell value (including empty) wins. */
export function loadDatabaseEnv(directory = process.cwd()) {
  loadEnvConfig(directory, process.env.NODE_ENV === "development", {
    info: () => undefined,
    error: () => { throw new Error("Unable to load database environment files."); },
  });
  return process.env.DATABASE_URL;
}
