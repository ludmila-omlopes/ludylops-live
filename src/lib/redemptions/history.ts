import type { RedemptionRecord } from "@/lib/types";

export type AdminRedemption = RedemptionRecord & { itemName: string; viewerName: string };
export const redemptionStatusLabels: Record<RedemptionRecord["status"], string> = {
  queued: "Na fila", executing: "Em execução", completed: "Concluído", failed: "Falhou", cancelled: "Cancelado",
};

/** The current state machine has one claim and one terminal transition; retries do not replace them. */
export function redemptionTimeline(entry: RedemptionRecord) {
  const events: Array<{ label: string; at: string | null; detail: string }> = [{
    label: "Entrou na fila", at: entry.queuedAt, detail: `Origem: ${entry.requestSource}`,
  }];
  if (entry.claimedByBridgeId || entry.claimedAt || entry.bridgeAttemptCount > 0 || entry.status === "executing") {
    events.push({ label: "Assumido pela bridge", at: entry.claimedAt ?? null,
      detail: entry.claimedByBridgeId ? `Bridge: ${entry.claimedByBridgeId}` : "Identificação da bridge não registrada." });
  }
  if (entry.status === "completed" || entry.executedAt) events.push({
    label: "Conclusão informada pela bridge", at: entry.executedAt,
    detail: entry.executionNote || "Sem observação de execução.",
  });
  if (entry.status === "failed" || entry.failedAt) events.push({
    label: "Falha informada pela bridge", at: entry.failedAt,
    detail: entry.failureReason || "Motivo não registrado.",
  });
  if (entry.status === "cancelled") events.push({ label: "Cancelado", at: null, detail: "Data e motivo do cancelamento não registrados." });
  return events;
}
