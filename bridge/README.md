# Streamer.bot Bridge

For a new creator's currency and catalog, use the [per-creator setup and recovery guide](../docs/creator-redemptions.md). The existing shared-secret configuration below continues to serve only Ludylops. Creator credentials use a separate signed endpoint and queue.

Local bridge that runs on the streaming PC and connects:

- the hosted Next.js API on Vercel
- the local Streamer.bot HTTP server

## What it does

- sends `POST /api/internal/bridge/heartbeat`
- polls `POST /api/internal/bridge/pull`
- claims queued redemptions
- calls local `POST /DoAction` on Streamer.bot
- reports `complete` or `fail` back to the hosted API

## Requirements

- Node.js 20+
- Streamer.bot with HTTP Server enabled
- hosted app reachable over HTTPS

## Environment

Copy `bridge/.env.example` and set:

- `BRIDGE_API_BASE_URL`
- `BRIDGE_MACHINE_KEY`
- `BRIDGE_SHARED_SECRET`
- `BRIDGE_STREAMERBOT_BASE_URL`
- `BRIDGE_POLL_INTERVAL_MS`
- `BRIDGE_HEARTBEAT_INTERVAL_MS`
- `BRIDGE_REQUEST_TIMEOUT_MS`
- `BRIDGE_MAX_BACKOFF_MS`
- `BRIDGE_LOG_LEVEL`

## Run

```bash
npx tsx bridge/src/index.ts
```

PowerShell example:

```powershell
$env:BRIDGE_API_BASE_URL="https://your-app.vercel.app"
$env:BRIDGE_MACHINE_KEY="stream-pc-01"
$env:BRIDGE_SHARED_SECRET="change-me"
$env:BRIDGE_STREAMERBOT_BASE_URL="http://127.0.0.1:7474"
npx tsx bridge/src/index.ts
```

## Signed requests

The bridge sends:

- `x-machine-key`
- `x-timestamp`
- `x-signature`

Signature format:

```text
HMAC_SHA256(secret, "<timestamp>.<body_json>")
```

## Hosted API endpoints

- `POST /api/internal/bridge/heartbeat`
- `POST /api/internal/bridge/pull`
- `POST /api/internal/bridge/:redemptionId/claim`
- `POST /api/internal/bridge/:redemptionId/complete`
- `POST /api/internal/bridge/:redemptionId/fail`

## Streamer.bot call

The bridge calls local `POST /DoAction` with:

```json
{
  "action": {
    "name": "Play Approved Sound"
  },
  "args": {
    "soundKey": "neon_horn"
  }
}
```

## Files

- `src/config.ts`: env parsing
- `src/crypto.ts`: HMAC helper
- `src/api-client.ts`: signed API client
- `src/streamerbot.ts`: local Streamer.bot executor
- `src/service.ts`: heartbeat, polling and execution loop
- `src/index.ts`: process bootstrap
