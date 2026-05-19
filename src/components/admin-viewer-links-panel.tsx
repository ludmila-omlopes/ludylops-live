"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminViewerDirectoryRecord } from "@/lib/types";
import { formatDateTime, formatPipetz } from "@/lib/utils";

function getViewerStatus(entry: AdminViewerDirectoryRecord) {
  if (entry.isLinked && entry.googleAccountId && !entry.isSyntheticYoutubeChannel) {
    return {
      label: "Vinculado",
      tone: "var(--color-mint)",
      note: "Google + YouTube confirmados",
    };
  }

  if (entry.googleAccountId && entry.isSyntheticYoutubeChannel) {
    return {
      label: "Não vinculado",
      tone: "var(--color-lavender)",
      note: "Conta Google sem canal final",
    };
  }

  if (!entry.googleAccountId && !entry.isSyntheticYoutubeChannel) {
    return {
      label: "Não vinculado",
      tone: "var(--color-sky)",
      note: "Canal do YouTube sem conta Google",
    };
  }

  return {
    label: entry.isLinked ? "Vinculado" : "Não vinculado",
    tone: "var(--color-paper)",
    note: "Sem dados suficientes",
  };
}

function buildGoogleCandidateLabel(entry: AdminViewerDirectoryRecord) {
  const parts = [maskEmail(entry.googleAccountEmail), entry.youtubeDisplayName];
  if (entry.email && entry.email !== entry.googleAccountEmail) {
    parts.push(maskEmail(entry.email));
  }
  return parts.filter(Boolean).join(" . ");
}

function buildYoutubeCandidateLabel(entry: AdminViewerDirectoryRecord) {
  return [entry.youtubeDisplayName, entry.youtubeHandle, maskEmail(entry.email)].filter(Boolean).join(" . ");
}

type LinkedGoogleAccountSummary = {
  googleAccountId: string;
  email: string | null;
  displayName: string | null;
  channelNames: string[];
};

function buildLinkedAccountLabel(account: LinkedGoogleAccountSummary) {
  const emailMask = maskEmail(account.email);
  const visibleChannels = account.channelNames.slice(0, 3).join(", ");
  const extras = account.channelNames.length > 3 ? ` (+${account.channelNames.length - 3})` : "";
  const channelText = visibleChannels ? `${visibleChannels}${extras}` : "";
  return [emailMask, channelText].filter(Boolean).join(" . ");
}

function maskEmail(email: string | null | undefined) {
  if (!email) {
    return null;
  }

  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return email;
  }

  const visibleLocal = localPart.length <= 3 ? localPart.slice(0, 1) : localPart.slice(0, 3);
  return `${visibleLocal}...@${domain}`;
}

export function AdminViewerLinksPanel({
  entries,
}: {
  entries: AdminViewerDirectoryRecord[];
}) {
  const router = useRouter();
  const [googleViewerId, setGoogleViewerId] = useState("");
  const [youtubeViewerId, setYoutubeViewerId] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [extraGoogleAccountId, setExtraGoogleAccountId] = useState("");
  const [extraViewerId, setExtraViewerId] = useState("");
  const [extraConfirmationText, setExtraConfirmationText] = useState("");
  const [extraFeedback, setExtraFeedback] = useState<string | null>(null);
  const [isExtraPending, startExtraTransition] = useTransition();

  const googleCandidates = useMemo(
    () => entries.filter((entry) => entry.googleAccountId && entry.isSyntheticYoutubeChannel),
    [entries],
  );
  const youtubeCandidates = useMemo(
    () => entries.filter((entry) => !entry.isSyntheticYoutubeChannel),
    [entries],
  );

  const linkedGoogleAccounts = useMemo<LinkedGoogleAccountSummary[]>(() => {
    const byId = new Map<string, LinkedGoogleAccountSummary>();
    for (const entry of entries) {
      if (!entry.googleAccountId || entry.isSyntheticYoutubeChannel) {
        continue;
      }
      const existing = byId.get(entry.googleAccountId);
      if (existing) {
        existing.channelNames.push(entry.youtubeDisplayName);
        continue;
      }
      byId.set(entry.googleAccountId, {
        googleAccountId: entry.googleAccountId,
        email: entry.googleAccountEmail,
        displayName: entry.googleAccountDisplayName,
        channelNames: [entry.youtubeDisplayName],
      });
    }
    return Array.from(byId.values()).sort((left, right) =>
      (left.email ?? "").localeCompare(right.email ?? ""),
    );
  }, [entries]);

  const unlinkedYoutubeChannels = useMemo(
    () => entries.filter((entry) => !entry.isSyntheticYoutubeChannel && !entry.googleAccountId),
    [entries],
  );

  const selectedGoogleViewer = entries.find((entry) => entry.id === googleViewerId) ?? null;
  const selectedYoutubeViewer = entries.find((entry) => entry.id === youtubeViewerId) ?? null;
  const selectedExtraAccount =
    linkedGoogleAccounts.find((entry) => entry.googleAccountId === extraGoogleAccountId) ?? null;
  const selectedExtraViewer = entries.find((entry) => entry.id === extraViewerId) ?? null;
  const isExtraConfirmationValid = extraConfirmationText.trim().toUpperCase() === "VINCULAR";
  const totalLinked = entries.filter((entry) => entry.isLinked).length;
  const totalGoogleOnly = entries.filter((entry) => entry.googleAccountId && entry.isSyntheticYoutubeChannel).length;
  const totalYoutubeOnly = entries.filter((entry) => !entry.googleAccountId && !entry.isSyntheticYoutubeChannel).length;
  const isConfirmationValid = confirmationText.trim().toUpperCase() === "VINCULAR";

  function submitLink() {
    if (!googleViewerId || !youtubeViewerId) {
      setFeedback("Escolha um usuário Google e um usuário do YouTube.");
      return;
    }
    if (!isConfirmationValid) {
      setFeedback('Digite "VINCULAR" para liberar a operação.');
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/viewers/link", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sourceViewerId: googleViewerId,
            targetViewerId: youtubeViewerId,
            confirmationText: confirmationText.trim(),
          }),
        });

        const payload = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          setFeedback(payload.error ?? "Falha ao vincular usuários.");
          return;
        }

        setFeedback("Usuarios vinculados com sucesso.");
        setGoogleViewerId("");
        setYoutubeViewerId("");
        setConfirmationText("");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao vincular usuários.");
      }
    });
  }

  function submitAttachChannel() {
    if (!extraGoogleAccountId || !extraViewerId) {
      setExtraFeedback("Escolha uma conta Google e um canal do YouTube.");
      return;
    }
    if (!isExtraConfirmationValid) {
      setExtraFeedback('Digite "VINCULAR" para liberar a operação.');
      return;
    }

    setExtraFeedback(null);
    startExtraTransition(async () => {
      try {
        const response = await fetch("/api/admin/viewers/attach-channel", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            googleAccountId: extraGoogleAccountId,
            viewerId: extraViewerId,
            confirmationText: extraConfirmationText.trim(),
          }),
        });

        const payload = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          setExtraFeedback(payload.error ?? "Falha ao adicionar canal.");
          return;
        }

        setExtraFeedback("Canal adicionado com sucesso.");
        setExtraGoogleAccountId("");
        setExtraViewerId("");
        setExtraConfirmationText("");
        router.refresh();
      } catch (error) {
        setExtraFeedback(error instanceof Error ? error.message : "Falha ao adicionar canal.");
      }
    });
  }

  return (
    <section className="landing-plane landing-divider bg-[var(--color-lilac)] py-8 sm:py-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mono text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
              Usuarios
            </p>
            <h2
              className="mt-2 text-3xl uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Vínculos Google + YouTube
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)]">
              Veja todos os usuários, confira quem já está vinculado e use o fluxo abaixo para unir
              com segurança uma sessão Google ao canal certo do YouTube.
            </p>
          </div>
          {feedback ? <div className="retro-label neutral-chip">{feedback}</div> : null}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="card-brutal-static p-5">
            <p className="mono text-xs uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
              Vincular manualmente
            </p>

            <div className="mt-4 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
                  Usuario Google
                </span>
                <Select value={googleViewerId || null} onValueChange={(value) => setGoogleViewerId(value ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Escolha a sessão Google">
                      {(value) =>
                        googleCandidates.find((entry) => entry.id === value)
                          ? buildGoogleCandidateLabel(
                              googleCandidates.find((entry) => entry.id === value)!,
                            )
                          : "Escolha a sessão Google"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {googleCandidates.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {buildGoogleCandidateLabel(entry)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs font-bold text-[var(--color-ink-soft)]">
                  Mostro aqui apenas usuários que já têm conta Google, mas ainda não foram ligados
                  ao canal final do YouTube.
                </span>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
                  Usuario YouTube
                </span>
                <Select value={youtubeViewerId || null} onValueChange={(value) => setYoutubeViewerId(value ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Escolha o canal do YouTube">
                      {(value) =>
                        youtubeCandidates.find((entry) => entry.id === value)
                          ? buildYoutubeCandidateLabel(
                              youtubeCandidates.find((entry) => entry.id === value)!,
                            )
                          : "Escolha o canal do YouTube"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {youtubeCandidates.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {buildYoutubeCandidateLabel(entry)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs font-bold text-[var(--color-ink-soft)]">
                  O canal escolhido passa a ser o viewer oficial dessa conta Google.
                </span>
              </label>

              <div className="card-flat bg-[var(--color-paper)] p-4">
                <p className="mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                  Revisão da operação
                </p>
                <div className="mt-3 grid gap-3 text-sm text-[var(--color-ink-soft)]">
                  <p>
                    <span className="font-black text-[var(--color-ink)]">Conta Google:</span>{" "}
                    {selectedGoogleViewer
                      ? buildGoogleCandidateLabel(selectedGoogleViewer)
                      : "Escolha uma sessão Google"}
                  </p>
                  <p>
                    <span className="font-black text-[var(--color-ink)]">Canal do YouTube:</span>{" "}
                    {selectedYoutubeViewer
                      ? buildYoutubeCandidateLabel(selectedYoutubeViewer)
                      : "Escolha um canal do YouTube"}
                  </p>
                  <p>
                    Essa ação transfere saldo, histórico, sugestões e a posse da conta Google para
                    o canal do YouTube selecionado. Se houver conflito de apostas ou se o canal já
                    pertencer a outra conta Google, eu bloqueio a operação.
                  </p>
                </div>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
                  Confirmação
                </span>
                <Input
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  placeholder='Digite "VINCULAR"'
                  className="px-3 py-2"
                />
                <span className="text-xs font-bold text-[var(--color-ink-soft)]">
                  Essa confirmação existe para evitar vínculos acidentais.
                </span>
              </label>

              <Button
                type="button"
                onClick={submitLink}
                disabled={isPending || !googleViewerId || !youtubeViewerId || !isConfirmationValid}
                size="sm"
                className="w-full sm:w-fit"
              >
                {isPending ? "Vinculando..." : "Vincular usuários"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card-brutal-static bg-[var(--color-paper)] p-5">
              <p className="mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">
                Total
              </p>
              <p className="mt-2 text-3xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                {entries.length}
              </p>
              <p className="mt-2 text-sm text-[var(--color-ink-soft)]">usuários no diretório</p>
            </div>
            <div className="card-brutal-static bg-[var(--color-mint)] p-5 text-[var(--color-accent-ink)]">
              <p className="mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent-ink-soft)]">
                Vinculados
              </p>
              <p className="mt-2 text-3xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                {totalLinked}
              </p>
              <p className="mt-2 text-sm text-[var(--color-accent-ink-soft)]">Google + YouTube unidos</p>
            </div>
            <div className="card-brutal-static bg-[var(--color-sky)] p-5">
              <p className="mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">
                Pendentes
              </p>
              <p className="mt-2 text-3xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                {totalGoogleOnly + totalYoutubeOnly}
              </p>
              <p className="mt-2 text-sm text-[var(--color-ink-soft)]">Google ou YouTube sem pareamento</p>
            </div>
          </div>
        </div>

        <div className="mt-6 card-brutal-static p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="mono text-xs uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
                Adicionar canal extra
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)]">
                Use este fluxo quando uma conta Google já tem um canal vinculado e você precisa
                associar outro canal do YouTube à mesma conta. O canal extra mantém saldo e
                histórico próprios.
              </p>
            </div>
            {extraFeedback ? <div className="retro-label neutral-chip">{extraFeedback}</div> : null}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
                Conta Google
              </span>
              <Select
                value={extraGoogleAccountId || null}
                onValueChange={(value) => setExtraGoogleAccountId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha a conta Google">
                    {(value) => {
                      const account = linkedGoogleAccounts.find(
                        (entry) => entry.googleAccountId === value,
                      );
                      return account ? buildLinkedAccountLabel(account) : "Escolha a conta Google";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {linkedGoogleAccounts.map((account) => (
                    <SelectItem key={account.googleAccountId} value={account.googleAccountId}>
                      {buildLinkedAccountLabel(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs font-bold text-[var(--color-ink-soft)]">
                Mostro aqui contas Google que já têm ao menos um canal vinculado.
              </span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
                Canal do YouTube
              </span>
              <Select
                value={extraViewerId || null}
                onValueChange={(value) => setExtraViewerId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha um canal sem conta Google">
                    {(value) => {
                      const entry = unlinkedYoutubeChannels.find((item) => item.id === value);
                      return entry
                        ? buildYoutubeCandidateLabel(entry)
                        : "Escolha um canal sem conta Google";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {unlinkedYoutubeChannels.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {buildYoutubeCandidateLabel(entry)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs font-bold text-[var(--color-ink-soft)]">
                Só listo canais reais do YouTube que ainda não foram vinculados a nenhuma conta.
              </span>
            </label>
          </div>

          <div className="mt-4 card-flat bg-[var(--color-paper)] p-4">
            <p className="mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
              Revisão da operação
            </p>
            <div className="mt-3 grid gap-3 text-sm text-[var(--color-ink-soft)]">
              <p>
                <span className="font-black text-[var(--color-ink)]">Conta Google:</span>{" "}
                {selectedExtraAccount
                  ? buildLinkedAccountLabel(selectedExtraAccount)
                  : "Escolha uma conta Google"}
              </p>
              <p>
                <span className="font-black text-[var(--color-ink)]">Canal a adicionar:</span>{" "}
                {selectedExtraViewer
                  ? buildYoutubeCandidateLabel(selectedExtraViewer)
                  : "Escolha um canal"}
              </p>
              <p>
                Essa ação apenas cria o vínculo: o canal passa a aparecer como canal adicional da
                conta Google, sem mesclar saldo, histórico ou sugestões. Se o canal já pertencer a
                outra conta Google, eu bloqueio a operação.
              </p>
            </div>
          </div>

          <label className="mt-4 grid gap-2">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
              Confirmação
            </span>
            <Input
              value={extraConfirmationText}
              onChange={(event) => setExtraConfirmationText(event.target.value)}
              placeholder='Digite "VINCULAR"'
              className="px-3 py-2"
            />
            <span className="text-xs font-bold text-[var(--color-ink-soft)]">
              Essa confirmação existe para evitar vínculos acidentais.
            </span>
          </label>

          <Button
            type="button"
            onClick={submitAttachChannel}
            disabled={
              isExtraPending ||
              !extraGoogleAccountId ||
              !extraViewerId ||
              !isExtraConfirmationValid
            }
            size="sm"
            className="mt-4 w-full sm:w-fit"
          >
            {isExtraPending ? "Adicionando..." : "Adicionar canal"}
          </Button>
        </div>

        <div className="mt-6 overflow-hidden rounded-[var(--radius)] border-[3px] border-[var(--color-ink)] shadow-[4px_4px_0_var(--shadow-color)]">
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_120px] gap-3 border-b-[3px] border-[var(--color-ink)] bg-[var(--color-blue)] px-4 py-3 text-xs font-bold uppercase tracking-[0.18em]">
            <span>Usuario</span>
            <span>Conta Google</span>
            <span>Status</span>
            <span>Saldo</span>
          </div>
          <div>
            {entries.map((entry) => {
              const status = getViewerStatus(entry);

              return (
                <div
                  key={entry.id}
                  className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_120px] gap-3 border-b-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] px-4 py-4 text-sm last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black uppercase">{entry.youtubeDisplayName}</p>
                    <p className="mt-0.5 truncate text-xs tracking-[0.12em] text-[var(--color-ink-soft)]">
                      {[entry.youtubeHandle, entry.youtubeChannelId].filter(Boolean).join(" . ")}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                      criado em {formatDateTime(entry.createdAt)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {maskEmail(entry.googleAccountEmail) ?? maskEmail(entry.email) ?? "Sem conta Google"}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                      {entry.googleAccountId
                        ? entry.googleAccountActiveViewerId === entry.id
                          ? "viewer ativo da conta"
                          : "viewer secundario da conta"
                        : entry.isSyntheticYoutubeChannel
                          ? "sessão sem conta vinculada"
                          : "canal sem conta Google"}
                    </p>
                  </div>

                  <div>
                    <span
                      className="badge-brutal inline-flex px-2 py-1 text-[10px] text-[var(--color-ink)]"
                      style={{ backgroundColor: status.tone }}
                    >
                      {status.label}
                    </span>
                    <p className="mt-2 text-xs text-[var(--color-ink-soft)]">{status.note}</p>
                  </div>

                  <div className="self-start">
                    <span className="badge-brutal bg-[var(--color-paper)] px-2 py-1 text-xs text-[var(--color-ink)]">
                      {entry.currentBalance !== null ? formatPipetz(entry.currentBalance) : "--"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
