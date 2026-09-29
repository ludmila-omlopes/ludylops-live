"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { CreatorBetaRequestRecord } from "@/lib/types";

export function CreatorBetaRequest({ email }: { email: string }) {
  const router = useRouter();
  const [request, setRequest] = useState<CreatorBetaRequestRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    fetch("/api/me/creator-area-access", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error ?? "Falha ao consultar o pedido.");
        if (!active) return;
        setRequest(result.data.request);
        if (result.data.canCreate) router.refresh();
      })
      .catch(() => { if (active) setFeedback("Não foi possível consultar seu pedido. Tente novamente."); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [router]);

  function send(method: "GET" | "POST") {
    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/me/creator-area-access", { method, cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error ?? "Não foi possível enviar o pedido.");
        setRequest(result.data.request);
        if (result.data.canCreate) router.refresh();
        else if (method === "GET") setFeedback("Situação atualizada.");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Tente novamente.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm font-medium leading-6 text-[var(--color-ink-soft)]">
        Solicite acesso com <strong>{email}</strong>. Um admin vai analisar seu pedido.
      </p>
      <p role="status" className="text-sm font-bold leading-6">
        {!loaded ? "Consultando seu pedido..." : request?.status === "pending"
          ? "Solicitação enviada. Aguarde a aprovação do admin."
          : request?.status === "rejected" ? "Seu pedido não foi aprovado. Você pode solicitar novamente."
          : "Seu email ainda não está liberado para o beta."}
      </p>
      <Button type="button" disabled={!loaded || isPending} onClick={() => send(request?.status === "pending" ? "GET" : "POST")} variant="success">
        {isPending ? "Aguarde..." : request?.status === "pending" ? "Verificar aprovação" : "Solicitar acesso ao beta"}
      </Button>
      {feedback ? <p role="status" className="text-sm font-medium">{feedback}</p> : null}
    </div>
  );
}
