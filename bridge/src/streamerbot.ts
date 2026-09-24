import type { BridgeConfig } from "./config";
import type { BridgeLogger } from "./logger";
import type { Json, RedemptionPayload, StreamerbotActionRef } from "./types";

export class ActionRejectedError extends Error {}

type DoActionRequest = {
  action: StreamerbotActionRef;
  args?: Record<string, Json>;
};

export class StreamerbotClient {
  constructor(
    private readonly config: BridgeConfig,
    private readonly logger: BridgeLogger,
  ) {}

  async healthcheck() {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.BRIDGE_REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(
        new URL("/GetActions", this.config.BRIDGE_STREAMERBOT_BASE_URL),
        {
          method: "GET",
          signal: controller.signal,
        },
      );

      return response.ok;
    } catch (error) {
      this.logger.debug("Streamer.bot healthcheck failed", error);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async executeRedemption(redemption: RedemptionPayload) {
    const actionRef = redemption.item?.streamerbotActionRef;
    if (!actionRef) {
      throw new ActionRejectedError("Missing Streamer.bot action mapping.");
    }

    const body: DoActionRequest = {
      action: this.resolveAction(actionRef),
      args: redemption.item?.streamerbotArgsTemplate,
    };

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.BRIDGE_REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(
        new URL("/DoAction", this.config.BRIDGE_STREAMERBOT_BASE_URL),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );

      if (!response.ok && response.status !== 204) {
        const text = await response.text();
        throw new ActionRejectedError(
          `Streamer.bot DoAction failed with ${response.status}: ${text || "empty body"}`,
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private resolveAction(actionRef: string): StreamerbotActionRef {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actionRef) ? { id: actionRef } : { name: actionRef };
  }
}
