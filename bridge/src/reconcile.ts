import { z } from "zod";
import { loadConfig } from "./config";
import { HostedApiClient } from "./api-client";

// Recovery only: never calls Streamer.bot or claims/re-executes an action.
async function main() {
  const [operation, redemptionId, note] = z.tuple([
    z.enum(["complete", "fail"]), z.string().uuid(), z.string().trim().min(1).max(255),
  ]).parse(process.argv.slice(2));
  const config = loadConfig();
  if (!config.STREAMERBOT_CREDENTIAL_ID) throw new Error("Recovery requires per-creator credentials.");
  const client = new HostedApiClient(config);
  const body = { bridgeId: config.BRIDGE_MACHINE_KEY };
  const result = operation === "complete"
    ? await client.completeRedemption(redemptionId, { ...body, executionNote: note })
    : await client.failRedemption(redemptionId, { ...body, failureReason: note });
  console.info(result);
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Recovery failed.");
  process.exitCode = 1;
});
