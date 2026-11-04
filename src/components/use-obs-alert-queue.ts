"use client";

import { useEffect, useRef, useState } from "react";
import { stickerCursorSchema, STICKER_MAX_AGE_MS } from "@/lib/youtube-stickers";

type QueuedAlert = { id: string; receivedAt: string };

/**
 * Polls an OBS alert feed and plays alerts one at a time.
 * The cursor and pending queue survive a reload of the same browser source; the alert on screen does not replay.
 */
export function useObsAlertQueue<Alert extends QueuedAlert>({ creatorSlug, endpoint, storageKey, duration, enabled, isAlert, merge }: {
  creatorSlug: string;
  endpoint: string;
  storageKey: string;
  duration: number;
  enabled: boolean;
  isAlert: (value: unknown) => value is Alert;
  /** Returns the combined alert when `incoming` continues `current`, or null to queue it separately. */
  merge?: (current: Alert, incoming: Alert) => Alert | null;
}): Alert | null {
  const [active, setActive] = useState<{ creator: string; alert: Alert } | null>(null);
  const callbacks = useRef({ isAlert, merge });
  useEffect(() => { callbacks.current = { isAlert, merge }; });

  useEffect(() => {
    if (!enabled) return;
    const key = `${storageKey}:${creatorSlug}`;
    let cursor: string | undefined;
    let queue: Alert[] = [];
    let current: Alert | null = null;
    let stopped = false;
    let verified = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let displayTimer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (saved && stickerCursorSchema.safeParse(saved.cursor).success) {
        cursor = saved.cursor;
        if (Array.isArray(saved.queue)) queue = saved.queue.filter((alert: unknown) =>
          callbacks.current.isAlert(alert) && Date.parse(alert.receivedAt) > Date.now() - STICKER_MAX_AGE_MS);
      }
    } catch { /* Storage is optional in embedded browsers. */ }
    function persist() {
      try { sessionStorage.setItem(key, JSON.stringify({ cursor, queue })); } catch { /* Keep the in-memory queue. */ }
    }
    function display(alert: Alert) {
      current = alert;
      setActive({ creator: creatorSlug, alert });
      clearTimeout(displayTimer);
      displayTimer = setTimeout(() => {
        current = null;
        setActive(null);
        showNext();
      }, duration);
    }
    function showNext() {
      if (stopped || current) return;
      const alert = queue.shift();
      persist();
      if (alert) display(alert);
    }
    function enqueue(alerts: Alert[]) {
      const { merge } = callbacks.current;
      for (const alert of alerts) {
        const last = queue.at(-1);
        const intoQueue = merge && last ? merge(last, alert) : null;
        const intoCurrent = merge && !last && current ? merge(current, alert) : null;
        if (intoQueue) queue[queue.length - 1] = intoQueue;
        else if (intoCurrent) display(intoCurrent);
        else queue.push(alert);
      }
    }
    async function poll() {
      if (stopped) return;
      try {
        // Backpressure: leave the remaining events in the server feed while OBS catches up.
        if (verified && queue.length >= 100) return;
        const query = new URLSearchParams({ creator: creatorSlug });
        if (cursor) query.set("cursor", cursor);
        controller = new AbortController();
        const response = await fetch(`${endpoint}?${query}`, { cache: "no-store", signal: controller.signal });
        if (stopped) return;
        if (response.status === 403 || response.status === 404) {
          queue = [];
          clearTimeout(displayTimer);
          current = null;
          verified = false;
          setActive(null);
          persist();
          return;
        }
        if (!response.ok) return;
        const payload = await response.json() as { ok?: boolean; data?: { alerts?: unknown; cursor?: unknown } };
        if (stopped || !payload.ok || !payload.data || !stickerCursorSchema.safeParse(payload.data.cursor).success || !Array.isArray(payload.data.alerts)) return;
        cursor = payload.data.cursor as string;
        verified = true;
        enqueue(payload.data.alerts.filter((alert): alert is Alert => callbacks.current.isAlert(alert)));
        persist();
        showNext();
      } catch { /* Retry transient failures without discarding accepted alerts. */ }
      finally { if (!stopped) pollTimer = setTimeout(poll, 2000); }
    }
    // Verify access before resuming a saved queue.
    void poll();
    return () => {
      stopped = true;
      controller?.abort();
      clearTimeout(pollTimer);
      clearTimeout(displayTimer);
    };
  }, [creatorSlug, enabled, endpoint, storageKey, duration]);

  return active?.creator === creatorSlug ? active.alert : null;
}

export function readOverlayDuration(value: string | null, fallback: number) {
  const requested = Number(value ?? fallback);
  return Number.isFinite(requested) ? Math.min(30_000, Math.max(3000, requested)) : fallback;
}
