import type { BridgeConfig } from "./config";
import type { BridgeLogger } from "./logger";
import { HostedApiClient } from "./api-client";
import { ActionRejectedError, StreamerbotClient } from "./streamerbot";
import type { RedemptionPayload } from "./types";
import os from "node:os";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BridgeService {
  private readonly apiClient: HostedApiClient;
  private readonly streamerbotClient: StreamerbotClient;
  private running = false;
  private lastPollAt: string | null = null;
  private inFlight = 0;
  private consecutivePollFailures = 0;
  private readonly confirmations = new Map<string, { kind: "complete" | "fail"; note: string }>();

  constructor(
    private readonly config: BridgeConfig,
    private readonly logger: BridgeLogger,
  ) {
    this.apiClient = new HostedApiClient(config);
    this.streamerbotClient = new StreamerbotClient(config, logger);
  }

  async start() {
    this.running = true;
    this.logger.info("Bridge service starting", {
      machineKey: this.config.BRIDGE_MACHINE_KEY,
      apiBaseUrl: this.config.BRIDGE_API_BASE_URL,
      streamerbotBaseUrl: this.config.BRIDGE_STREAMERBOT_BASE_URL,
    });

    await Promise.all([this.runHeartbeatLoop(), this.runPollLoop()]);
  }

  stop() {
    this.running = false;
  }

  private async runHeartbeatLoop() {
    while (this.running) {
      try {
        const reachable = await this.streamerbotClient.healthcheck();

        await this.apiClient.sendHeartbeat({
          bridgeId: this.config.BRIDGE_MACHINE_KEY,
          machineKey: this.config.BRIDGE_MACHINE_KEY,
          label: `${os.hostname()}${reachable ? " • live-ready" : " • waiting streamer.bot"}`,
        });

        this.logger.debug("Heartbeat sent", { reachable, inFlight: this.inFlight });
      } catch (error) {
        this.logger.warn("Heartbeat failed", error);
      }

      await sleep(this.config.BRIDGE_HEARTBEAT_INTERVAL_MS);
    }
  }

  private async runPollLoop() {
    while (this.running) {
      try {
        // Retrying the receipt never executes the action or turns a successful dispatch into a refund.
        for (const [id, receipt] of this.confirmations) {
          await this.confirm(id, receipt);
        }
        const queue = await this.apiClient.pullQueue({
          bridgeId: this.config.BRIDGE_MACHINE_KEY,
        });

        this.lastPollAt = new Date().toISOString();
        this.consecutivePollFailures = 0;

        for (const redemption of queue) {
          await this.handleRedemption(redemption);
        }

        await sleep(this.config.BRIDGE_POLL_INTERVAL_MS);
      } catch (error) {
        this.consecutivePollFailures += 1;
        const backoff = Math.min(
          this.config.BRIDGE_POLL_INTERVAL_MS * 2 ** this.consecutivePollFailures,
          this.config.BRIDGE_MAX_BACKOFF_MS,
        );

        this.logger.warn("Queue polling failed; backing off", {
          error,
          backoff,
        });

        await sleep(backoff);
      }
    }
  }

  private async handleRedemption(redemption: RedemptionPayload) {
    const claim = await this.apiClient.claimRedemption(redemption.id, {
      bridgeId: this.config.BRIDGE_MACHINE_KEY,
    });

    if (!claim) {
      this.logger.debug("Redemption already claimed by another bridge", {
        redemptionId: redemption.id,
      });
      return;
    }

    this.inFlight += 1;

    try {
      this.logger.info("Executing redemption", {
        redemptionId: redemption.id,
        item: redemption.item?.slug,
        viewer: redemption.viewer?.youtubeDisplayName,
      });

      await this.streamerbotClient.executeRedemption(redemption);

      const receipt = { kind: "complete" as const, note: "Streamer.bot aceitou a ação via HTTP. As subações não foram verificadas." };
      this.confirmations.set(redemption.id, receipt);
      await this.confirm(redemption.id, receipt);

      this.logger.info("Redemption completed", {
        redemptionId: redemption.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown execution error";

      if (!this.confirmations.has(redemption.id)) {
        if (!this.config.STREAMERBOT_CREDENTIAL_ID || error instanceof ActionRejectedError) {
          const receipt = { kind: "fail" as const, note: message.slice(0, 255) };
          this.confirmations.set(redemption.id, receipt);
          await this.confirm(redemption.id, receipt);
        } else this.logger.error("Action outcome unknown; inspect Streamer.bot before reconciling. No automatic refund or re-execution.", { redemptionId: redemption.id });
      }

      this.logger.error("Redemption failed", {
        redemptionId: redemption.id,
        error: message,
      });
    } finally {
      this.inFlight -= 1;
    }
  }

  private async confirm(id: string, receipt: { kind: "complete" | "fail"; note: string }) {
    const body = { bridgeId: this.config.BRIDGE_MACHINE_KEY };
    if (receipt.kind === "complete") await this.apiClient.completeRedemption(id, { ...body, executionNote: receipt.note });
    else await this.apiClient.failRedemption(id, { ...body, failureReason: receipt.note });
    this.confirmations.delete(id);
  }
}
