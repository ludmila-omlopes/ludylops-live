import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Coins, Radio, Trophy, WalletCards } from "lucide-react";

import { auth } from "@/auth";
import { AuthButtons } from "@/components/auth-buttons";
import { BetList } from "@/components/bet-list";
import { StickerBadge } from "@/components/sticker-badge";
import { getViewerDashboard, listBets } from "@/lib/db/repository";
import { formatPipetz } from "@/lib/utils";

const LUDYLOPS_PROFILE_IMAGE = "/selfie2.png";

type BetMetric = {
  label: string;
  value: string;
  note: string;
  Icon: LucideIcon;
  className: string;
};

function MetricTile({ metric }: { metric: BetMetric }) {
  const Icon = metric.Icon;

  return (
    <div className={`border border-[var(--color-ink)] p-4 text-[var(--color-accent-ink)] ${metric.className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="mono text-[10px] font-black uppercase tracking-[0.22em] text-[var(--color-accent-ink-soft)]">
          {metric.label}
        </p>
        <Icon className="size-5 shrink-0" aria-hidden="true" />
      </div>
      <p
        className="mt-3 text-3xl uppercase leading-none sm:text-4xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {metric.value}
      </p>
      <p className="mt-2 text-sm font-bold leading-5 text-[var(--color-accent-ink-soft)]">
        {metric.note}
      </p>
    </div>
  );
}

export default async function ApostasPage() {
  const session = await auth();
  const activeViewerId = session?.user?.activeViewerId ?? null;
  const [bets, dashboard] = await Promise.all([
    listBets(activeViewerId),
    activeViewerId ? getViewerDashboard(activeViewerId) : Promise.resolve(null),
  ]);

  const openBets = bets.filter((bet) => bet.status === "open");
  const activeBets = bets.filter((bet) => bet.status === "open" || bet.status === "locked");
  const resolvedBets = bets.filter((bet) => bet.status === "resolved" || bet.status === "cancelled");
  const totalActivePool = activeBets.reduce((sum, bet) => sum + bet.totalPool, 0);
  const viewerBalance = dashboard?.balance.currentBalance ?? null;
  const loggedIn = Boolean(session?.user);
  const canBet = Boolean(activeViewerId && dashboard?.viewer.isLinked);
  const viewerName = dashboard?.viewer.youtubeDisplayName ?? session?.user?.name ?? null;

  const metrics: BetMetric[] = [
    {
      label: "abertas",
      value: formatPipetz(openBets.length),
      note: "pools aceitando entrada agora",
      Icon: Radio,
      className: "bg-[var(--color-pink)]",
    },
    {
      label: "em jogo",
      value: formatPipetz(totalActivePool),
      note: "pipetz nos pools ativos",
      Icon: Coins,
      className: "bg-[var(--color-blue)]",
    },
    {
      label: "saldo",
      value: typeof viewerBalance === "number" ? formatPipetz(viewerBalance) : "--",
      note: canBet ? "disponível para apostar" : "entre e vincule o chat",
      Icon: WalletCards,
      className: "bg-[var(--color-mint)]",
    },
    {
      label: "histórico",
      value: formatPipetz(resolvedBets.length),
      note: "apostas encerradas",
      Icon: Trophy,
      className: "bg-[var(--color-purple)]",
    },
  ];

  const statusTitle = canBet
    ? viewerName
      ? `${viewerName}, você está liberada para apostar.`
      : "Você está liberada para apostar."
    : loggedIn
      ? "Falta vincular sua conta ao chat."
      : "Entre com Google para apostar pelo site.";
  const statusBody = canBet
    ? "Escolha uma opção aberta, informe o valor e acompanhe o pool mudar ao vivo."
    : loggedIn
      ? "A vinculação confirma qual viewer do chat recebe débitos, retornos e reembolsos."
      : "Depois do login, vincule seu canal do YouTube para conectar saldo, chat e apostas.";

  return (
    <div className="flex w-full max-w-[100vw] flex-col overflow-x-hidden">
      <section className="landing-plane surface-hero relative overflow-hidden py-5 sm:py-6">
        <div className="bg-micro-grid pointer-events-none absolute inset-0 opacity-30" />
        <StickerBadge
          variant="spark"
          className="absolute right-5 top-5 hidden size-16 rotate-[10deg] lg:inline-flex"
          label="brilho decorativo"
        />

        <div className="relative mx-auto grid w-full max-w-[100vw] gap-8 px-4 sm:px-6 lg:max-w-[1520px] lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-10">
          <div className="min-w-0 max-w-[22rem] sm:max-w-none">
            <h1
              className="max-w-3xl break-words text-balance text-4xl uppercase leading-[0.9] sm:text-6xl lg:text-[4.45rem]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Entre no pool da live.
            </h1>

            <p className="mt-5 max-w-2xl break-words text-pretty text-base leading-8 text-[var(--color-ink-soft)] sm:text-lg">
              Palpite junto com o chat usando os pipetz da sua conta. Se vencer, o retorno é
              calculado pelo pool encerrado; se a rodada for cancelada, os valores voltam para os viewers.
            </p>

            <div className="mt-4 border-l-[6px] border-[var(--color-ink)] bg-[var(--color-paper)] p-4">
              <p className="text-base font-black uppercase leading-6">{statusTitle}</p>
              <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-[var(--color-ink-soft)]">
                {statusBody}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {canBet ? (
                <Link href="/me" className="btn-brutal ink-button px-6 py-3 text-sm">
                  <WalletCards className="size-4" aria-hidden="true" />
                  Meus Pipetz
                </Link>
              ) : loggedIn ? (
                <Link href="/me" className="btn-brutal accent-button px-6 py-3 text-sm">
                  <WalletCards className="size-4" aria-hidden="true" />
                  Vincular Conta
                </Link>
              ) : (
                <AuthButtons />
              )}
              <Link href="#apostas-abertas" className="btn-brutal bg-[var(--color-paper)] px-6 py-3 text-sm">
                <Radio className="size-4" aria-hidden="true" />
                Ver Pools
              </Link>
            </div>
          </div>

          <div className="relative mx-auto min-h-[260px] w-full max-w-[22rem] sm:min-h-[330px] sm:max-w-none">
            <StickerBadge
              variant="heart"
              className="absolute -left-2 top-6 z-20 size-20 rotate-[-10deg] sm:left-2"
              label="coração decorativo"
            />
            <div className="absolute inset-x-8 bottom-0 top-8 border-[3px] border-[var(--color-ink)] bg-[var(--color-pink)] shadow-[8px_8px_0_var(--shadow-color)] sm:inset-x-16" />
            <div className="absolute inset-x-0 bottom-0 mx-auto w-[72%] max-w-[360px]">
              <Image
                src={LUDYLOPS_PROFILE_IMAGE}
                alt="Foto da Ludylops"
                width={1100}
                height={1100}
                className="h-auto w-full contrast-125"
                preload
              />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-plane landing-divider bg-[var(--color-paper)] py-6">
        <div className="mx-auto grid w-full max-w-[100vw] gap-3 px-4 sm:grid-cols-2 sm:px-6 lg:max-w-[1520px] lg:grid-cols-4 lg:px-10">
          {metrics.map((metric) => (
            <MetricTile key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <BetList
        id="apostas-abertas"
        bets={activeBets}
        title="Pools da live"
        subtitle="Apostas abertas aceitam entrada pelo site; travadas ficam aguardando resultado."
        emptyMessage="Nenhuma aposta rolando agora. Aguarde a próxima live!"
        viewerBalance={viewerBalance}
        loggedIn={loggedIn}
        canBet={canBet}
        fullWidth
        sectionClassName="bg-[var(--color-paper-pink)]"
      />

      {resolvedBets.length > 0 ? (
        <BetList
          bets={resolvedBets}
          title="Histórico recente"
          subtitle="Resultados, reembolsos e retornos ficam visíveis depois que a rodada fecha."
          emptyMessage=""
          viewerBalance={viewerBalance}
          loggedIn={loggedIn}
          canBet={canBet}
          fullWidth
          sectionClassName="bg-[var(--color-sky)]"
        />
      ) : null}
    </div>
  );
}
