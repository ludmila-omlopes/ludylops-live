import { defineConfig } from "drizzle-kit";
import { loadDatabaseEnv } from "./scripts/database-env";

loadDatabaseEnv();

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
