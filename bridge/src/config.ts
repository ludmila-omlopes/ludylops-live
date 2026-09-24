import { z } from "zod";

const envSchema = z.object({
  BRIDGE_API_BASE_URL: z.url(),
  BRIDGE_MACHINE_KEY: z.string().min(3),
  BRIDGE_SHARED_SECRET: z.string().min(8).optional(),
  STREAMERBOT_CREDENTIAL_ID: z.string().regex(/^sbc_[a-f0-9]{32}$/).optional(),
  STREAMERBOT_CREDENTIAL_SECRET: z.string().min(32).optional(),
  BRIDGE_STREAMERBOT_BASE_URL: z.url().default("http://127.0.0.1:7474"),
  BRIDGE_POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(2000),
  BRIDGE_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).default(30000),
  BRIDGE_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
  BRIDGE_MAX_BACKOFF_MS: z.coerce.number().int().min(1000).default(30000),
  BRIDGE_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
}).superRefine((value, ctx) => {
  if (Boolean(value.STREAMERBOT_CREDENTIAL_ID) !== Boolean(value.STREAMERBOT_CREDENTIAL_SECRET)) ctx.addIssue({ code: "custom", message: "Configure both credential ID and secret." });
  if (!value.STREAMERBOT_CREDENTIAL_ID && !value.BRIDGE_SHARED_SECRET) ctx.addIssue({ code: "custom", message: "Configure creator credentials or the legacy bridge secret." });
  if (value.STREAMERBOT_CREDENTIAL_ID && !/^[a-zA-Z0-9_-]{3,64}$/.test(value.BRIDGE_MACHINE_KEY)) ctx.addIssue({ code: "custom", message: "Creator bridge machine key must contain 3–64 letters, digits, underscores or hyphens." });
});

export type BridgeConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid bridge configuration:\n${formatted}`);
  }

  return parsed.data;
}
