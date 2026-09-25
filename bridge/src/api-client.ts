import { URL } from "node:url";
import { createHmac } from "node:crypto";

import type { BridgeConfig } from "./config";
import { signRequest } from "./crypto";
import type {
  ApiErrorShape,
  BridgeHeartbeatBody,
  ClaimResponse,
  CompleteBody,
  FailBody,
  HeartbeatResponse,
  PullQueueResponse,
} from "./types";

type RequestOptions = {
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
};

export class HostedApiClient {
  constructor(private readonly config: BridgeConfig) {}

  async sendHeartbeat(body: BridgeHeartbeatBody) {
    return this.request<HeartbeatResponse["data"]>({
      path: "/api/internal/bridge/heartbeat",
      method: "POST",
      body,
    });
  }

  async pullQueue(body: { bridgeId: string }) {
    return this.request<PullQueueResponse["data"]>({
      path: "/api/internal/bridge/pull",
      method: "POST",
      body,
    });
  }

  async claimRedemption(redemptionId: string, body: { bridgeId: string }) {
    return this.request<ClaimResponse["data"]>({
      path: `/api/internal/bridge/${redemptionId}/claim`,
      method: "POST",
      body,
    });
  }

  async completeRedemption(redemptionId: string, body: CompleteBody) {
    return this.request<{ id: string; status: string } | null>({
      path: `/api/internal/bridge/${redemptionId}/complete`,
      method: "POST",
      body,
    });
  }

  async failRedemption(redemptionId: string, body: FailBody) {
    return this.request<{ id: string; status: string } | null>({
      path: `/api/internal/bridge/${redemptionId}/fail`,
      method: "POST",
      body,
    });
  }

  private async request<T>({ path, method = "GET", body }: RequestOptions): Promise<T> {
    const credentialId = this.config.STREAMERBOT_CREDENTIAL_ID;
    if (credentialId) {
      const parts = path.split("/");
      const operation = parts.at(-1)!;
      const fields = body as { bridgeId: string; executionNote?: string; failureReason?: string };
      body = { operation, bridgeId: fields.bridgeId,
        ...(["claim", "complete", "fail"].includes(operation) ? { redemptionId: parts.at(-2) } : {}),
        ...(operation === "complete" ? { executionNote: fields.executionNote } : {}),
        ...(operation === "fail" ? { failureReason: fields.failureReason } : {}) };
      path = "/api/internal/streamerbot/redemptions";
    }
    const requestBody = body === undefined ? "" : JSON.stringify(body);
    const timestamp = `${Date.now()}`;
    const signature = credentialId ? createHmac("sha256", this.config.STREAMERBOT_CREDENTIAL_SECRET!)
      .update(`v2\n${timestamp}\n${credentialId}\n${method}\n${path}\n${requestBody}`).digest("hex") : signRequest({
      timestamp,
      body: requestBody,
      secret: this.config.BRIDGE_SHARED_SECRET!,
    });

    const url = new URL(path, this.config.BRIDGE_API_BASE_URL);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.BRIDGE_REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
          "x-machine-key": this.config.BRIDGE_MACHINE_KEY,
          "x-timestamp": timestamp,
          "x-signature": signature,
          ...(credentialId ? { "x-streamerbot-credential-id": credentialId } : {}),
        },
        body: requestBody || undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        let error: ApiErrorShape | undefined;

        try {
          error = (await response.json()) as ApiErrorShape;
        } catch {
          error = undefined;
        }

        throw new Error(
          error?.error ??
            error?.message ??
            `Hosted API request failed with status ${response.status}`,
        );
      }

      const json = (await response.json()) as { ok: true; data: T };
      return json.data;
    } finally {
      clearTimeout(timeout);
    }
  }
}
