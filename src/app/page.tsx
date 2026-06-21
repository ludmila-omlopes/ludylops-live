import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CirclePlay,
  Gamepad2,
  Sparkles,
  Ticket,
  type LucideIcon,
} from "lucide-react";

import { auth } from "@/auth";
import { AuthButtons } from "@/components/auth-buttons";
import { LivestreamIndicator } from "@/components/livestream-indicator";
import { GOOGLE_ACCOUNT_SWITCH_HINT } from "@/lib/auth/google";
import {
  getAccountProtectionStatusFromSearchParams,
  getSessionAccountProtectionStatus,
  hasUsableAppSession,
  type AccountProtectionStatus,
} from "@/lib/auth/session-state";
import { getCurrentGame } from "@/lib/current-game";
import { listBets } from "@/lib/db/repository";
import { isStreamerbotLivestreamActive } from "@/lib/streamerbot/live-status";
import type { BetWithOptionsRecord, CurrentGameRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const LUDYLOPS_PROFILE_IMAGE = "/selfie2.png";

type HomeAction = {
  href: string;
  title: string;
  body: string;
  cta: string;
  icon: LucideIcon;
  bg: string;
};

type HomePageProps = {
  searchParams: Promise<{ googleAccountProtection?: string | string[] | undefined }>;
};

function getGameMetadataParts(game: CurrentGameRecord | null) {
  if (!game) {
    return [];
  }

  return [game.releaseYear, ...game.platforms.slice(0, 2), ...game.genres.slice(0, 2)]
    .filter(Boolean)
    .map(String);
}

function getHeroBackgroundStyle(game: CurrentGameRecord | null): CSSProperties {
  const imageUrl = game?.coverImageUrl ?? LUDYLOPS_PROFILE_IMAGE;

  return {
    backgroundImage: [
      "linear-gradient(90deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.45) 48%, rgba(0, 0, 0, 0.05) 100%)",
      "linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.5) 100%)",
      `url(${JSON.stringify(imageUrl)})`,
    ].join(", "),
    backgroundPosition: game?.coverImageUrl ? "center" : "center 22%",
    backgroundSize: "cover",
  };
}

function AccountProtectionNotice({ status }: { status: AccountProtectionStatus }) {
  const title =
    status === "google_signin_blocked"
      ? "Seu login Google foi pausado por segurança."
      : "Sua sessão foi encerrada por um alerta de segurança.";
  const body =
    status === "google_signin_blocked"
      ? "O Google enviou um sinal de risco para esta conta, então eu bloqueei novas entradas com esse login até a situação ser normalizada."
      : "Recebi um evento de proteção entre contas e encerrei sua sessão local. Para continuar, entre novamente depois de revisar a segurança da sua conta Google.";
  const nextStep =
    status === "google_signin_blocked"
      ? "Se você quiser testar com outra conta Google, use o seletor de conta. Se esta for a sua conta principal, revise a segurança dela primeiro."
      : "Se estiver tudo certo na sua conta Google, você pode entrar novamente agora.";

  return (
    <div className="mt-6 max-w-2xl border-[3px] border-white bg-white/92 p-4 text-black shadow-[5px_5px_0_rgba(255,255,255,0.28)]">
      <p className="mono text-[10px] uppercase tracking-[0.24em] text-black/70">
        segurança da conta
      </p>
      <p className="mt-2 text-lg font-black uppercase leading-tight">{title}</p>
      <p className="mt-3 text-sm font-bold leading-6">{body}</p>
      <p className="mt-3 text-sm font-medium leading-6">{nextStep}</p>
      <p className="mt-3 text-xs font-medium leading-5">{GOOGLE_ACCOUNT_SWITCH_HINT}</p>
    </div>
  );
}

function HeroGameLabel({ game }: { game: CurrentGameRecord | null }) {
  const metadata = getGameMetadataParts(game);

  return (
    <div className="mt-8 w-full max-w-[calc(100vw-2rem)] border-l-[6px] border-[var(--color-pink)] bg-white/90 p-4 text-black shadow-[5px_5px_0_rgba(255,255,255,0.22)] backdrop-blur dark:bg-black/70 dark:text-white dark:shadow-[5px_5px_0_rgba(0,0,0,0.45)] sm:max-w-2xl">
      <p className="mono text-[10px] font-black uppercase tracking-[0.24em] text-black/65 dark:text-white/65">
        {game ? "jogando agora" : "ao vivo"}
      </p>
      <h2
        className="mt-2 break-words text-3xl uppercase leading-[0.9] sm:text-4xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {game?.name ?? "Live da Ludylops"}
      </h2>
      {metadata.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {metadata.map((item) => (
            <span
              key={item}
              className="mono max-w-full border border-black/20 px-2 py-1 text-[10px] font-bold uppercase leading-4 tracking-[0.1em] text-black/65 dark:border-white/20 dark:text-white/65 [overflow-wrap:anywhere]"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HeroActions({ hasUsableSession }: { hasUsableSession: boolean }) {
  if (hasUsableSession) {
    return (
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link href="/apostas" className="btn-brutal accent-button px-6 py-3 text-sm">
          <Ticket className="size-4" aria-hidden="true" />
          Abrir Apostas
        </Link>
        <Link href="/me" className="btn-brutal ink-button px-6 py-3 text-sm">
          <Sparkles className="size-4" aria-hidden="true" />
          Minha Área
        </Link>
        <Link href="/jogos" className="btn-brutal bg-[var(--color-mint)] px-6 py-3 text-sm text-[var(--color-accent-ink)]">
          <Gamepad2 className="size-4" aria-hidden="true" />
          Sugerir Jogo
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <AuthButtons />
      <Link href="/apostas" className="btn-brutal accent-button px-6 py-3 text-sm">
        <Ticket className="size-4" aria-hidden="true" />
        Ver Apostas
      </Link>
      <Link href="/jogos" className="btn-brutal bg-[var(--color-mint)] px-6 py-3 text-sm text-[var(--color-accent-ink)]">
        <Gamepad2 className="size-4" aria-hidden="true" />
        Ver Jogos
      </Link>
    </div>
  );
}

function HomeHero({
  accountProtectionStatus,
  currentGame,
  hasUsableSession,
  isLive,
  viewerName,
}: {
  accountProtectionStatus: AccountProtectionStatus | null;
  currentGame: CurrentGameRecord | null;
  hasUsableSession: boolean;
  isLive: boolean;
  viewerName: string | null;
}) {
  const title = hasUsableSession
    ? "Você já está na live da Ludylops."
    : "A live da Ludylops começa aqui.";
  const description = accountProtectionStatus
    ? accountProtectionStatus === "google_signin_blocked"
      ? "Seu acesso com Google foi colocado em espera por segurança. Você ainda pode acompanhar a live enquanto revisa a conta."
      : "Sua sessão local foi encerrada por segurança. Quando você entrar de novo, os caminhos da live voltam para a sua conta."
    : hasUsableSession
      ? "Entre nas apostas, acione resgates e leve suas sugestões para o que acontece ao vivo."
      : "Faça login para participar das apostas, resgatar efeitos e sugerir os jogos que movem a stream.";

  return (
    <section className="landing-plane relative isolate overflow-hidden bg-black text-white">
      <div className="absolute inset-0 -z-20 bg-black" />
      <div
        className="absolute inset-0 -z-10 scale-[1.02] bg-cover bg-center"
        style={getHeroBackgroundStyle(currentGame)}
        aria-hidden="true"
      />

      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[56px] w-full sm:h-[104px]"
        viewBox="0 0 1440 104"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0,104 V52 C240,28 480,76 720,52 C960,28 1200,76 1440,52 V104 Z" style={{ fill: "var(--color-paper)" }} />
      </svg>

      <div className="mx-auto flex min-h-[min(760px,calc(100svh-9rem))] w-full max-w-[1520px] items-center px-4 py-12 sm:px-6 sm:py-16 lg:px-10 lg:py-18">
        <div className="w-full min-w-0 max-w-[calc(100vw-2rem)] sm:max-w-4xl">
          <div className="flex flex-wrap items-center gap-3">
            <LivestreamIndicator isLive={isLive} />
            {viewerName ? (
              <span className="mono border border-white/40 bg-black/45 px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white">
                {viewerName}
              </span>
            ) : null}
          </div>

          <h1
            className="mt-6 max-w-4xl break-words text-5xl leading-[0.88] text-pretty [overflow-wrap:anywhere] sm:text-6xl lg:text-[5.8rem]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h1>

          <p className="mt-5 max-w-2xl break-words text-base font-medium leading-8 text-white/88 [overflow-wrap:anywhere] sm:text-lg">
            {description}
          </p>

          {accountProtectionStatus ? (
            <AccountProtectionNotice status={accountProtectionStatus} />
          ) : null}

          <HeroActions hasUsableSession={hasUsableSession} />
          <HeroGameLabel game={currentGame} />
        </div>
      </div>
    </section>
  );
}

function ActionTile({ action }: { action: HomeAction }) {
  const Icon = action.icon;

  return (
    <article className={cn("flex h-full min-w-0 flex-col justify-between border-[3px] border-[var(--color-ink)] p-5", action.bg)}>
      <div>
        <div className="flex size-12 items-center justify-center border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)]">
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <h3
          className="mt-5 text-3xl uppercase leading-[0.9]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {action.title}
        </h3>
        <p className="mt-4 text-sm font-medium leading-7 text-[var(--color-accent-ink-soft)]">
          {action.body}
        </p>
      </div>
      <Link href={action.href} className="mt-6 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] underline decoration-[3px] underline-offset-4">
        {action.cta}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

function LiveActionSection({
  activeBet,
  hasUsableSession,
}: {
  activeBet: BetWithOptionsRecord | undefined;
  hasUsableSession: boolean;
}) {
  const actions: HomeAction[] = hasUsableSession
    ? [
        {
          href: "/apostas",
          title: activeBet ? "Aposta aberta" : "Apostas da live",
          body: activeBet
            ? activeBet.question
            : "Quando a live abre um palpite, esse é o caminho direto para entrar na disputa.",
          cta: "Abrir Apostas",
          icon: Ticket,
          bg: "bg-[var(--color-pink)] text-[var(--color-accent-ink)]",
        },
        {
          href: "/me",
          title: "Minha área",
          body: "Resgates, vínculo com o YouTube e histórico ficam juntos para você agir rápido durante a stream.",
          cta: "Abrir Minha Área",
          icon: Sparkles,
          bg: "bg-[var(--color-blue)] text-[var(--color-accent-ink)]",
        },
        {
          href: "/jogos",
          title: "Próximo jogo",
          body: "Sugira jogos e fortaleça as ideias da comunidade para as próximas lives.",
          cta: "Ver Jogos",
          icon: Gamepad2,
          bg: "bg-[var(--color-mint)] text-[var(--color-accent-ink)]",
        },
      ]
    : [
        {
          href: "/apostas",
          title: "Apostas ao vivo",
          body: "Veja os palpites que aparecem quando a live vira desafio para o chat.",
          cta: "Ver Apostas",
          icon: Ticket,
          bg: "bg-[var(--color-pink)] text-[var(--color-accent-ink)]",
        },
        {
          href: "/jogos",
          title: "Jogos do chat",
          body: "Conheça a fila de sugestões que ajuda a puxar o próximo jogo da stream.",
          cta: "Ver Jogos",
          icon: Gamepad2,
          bg: "bg-[var(--color-blue)] text-[var(--color-accent-ink)]",
        },
        {
          href: "/videos",
          title: "Pautas da live",
          body: "Vídeos, indicações e ideias entram como combustível para conversas com a comunidade.",
          cta: "Ver Vídeos",
          icon: CirclePlay,
          bg: "bg-[var(--color-purple)] text-[var(--color-accent-ink)]",
        },
      ];

  return (
    <section className="landing-plane bg-[var(--color-paper)] py-9 sm:py-12">
      <div className="mx-auto w-full max-w-[1520px] px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl">
          <p className="mono text-[11px] font-black uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
            caminhos principais
          </p>
          <h2
            className="mt-3 text-4xl uppercase leading-[0.9] text-pretty sm:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {hasUsableSession ? "Seu próximo lance na live." : "O que move a live."}
          </h2>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {actions.map((action) => (
            <ActionTile key={action.href} action={action} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BetOptionCard({
  index,
  optionLabel,
}: {
  index: number;
  optionLabel: string;
}) {
  const colors = [
    "bg-[var(--color-blue)]",
    "bg-[var(--color-purple)]",
    "bg-[var(--color-pink)]",
    "bg-[var(--color-mint)]",
  ];

  return (
    <div className={cn("min-w-0 border-[3px] border-[var(--color-ink)] p-4", colors[index % colors.length])}>
      <p className="mono text-[10px] font-black uppercase tracking-[0.24em] text-[var(--color-accent-ink-soft)]">
        opção 0{index + 1}
      </p>
      <p className="mt-2 break-words text-lg font-black uppercase leading-tight text-[var(--color-accent-ink)] [overflow-wrap:anywhere]">
        {optionLabel}
      </p>
    </div>
  );
}

function LiveBetSpotlight({
  activeBet,
  loggedIn,
}: {
  activeBet: BetWithOptionsRecord | undefined;
  loggedIn: boolean;
}) {
  if (!activeBet) {
    return null;
  }

  return (
    <section className="landing-plane landing-divider bg-[var(--color-paper-pink)] py-9 sm:py-12">
      <div className="mx-auto grid w-full max-w-[1520px] gap-6 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <div>
          <p className="mono text-[11px] font-black uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
            aposta aberta
          </p>
          <h2
            className="mt-4 max-w-3xl break-words text-4xl uppercase leading-[0.9] text-pretty sm:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {activeBet.question}
          </h2>
          <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-[var(--color-ink-soft)]">
            Veja o que importa para entrar no clima da live: a pergunta, as opções e o
            caminho para participar.
          </p>
          <Link href="/apostas" className="btn-brutal accent-button mt-7 px-5 py-3 text-xs">
            <Ticket className="size-4" aria-hidden="true" />
            {loggedIn ? "Entrar na Aposta" : "Ver Aposta"}
          </Link>
        </div>

        <div className="grid gap-4 self-start">
          {activeBet.options.map((option, index) => (
            <BetOptionCard key={option.id} optionLabel={option.label} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function Home({ searchParams }: HomePageProps) {
  const session = await auth();
  const resolvedSearchParams = await searchParams;
  const accountProtectionStatus =
    getSessionAccountProtectionStatus(session) ?? getAccountProtectionStatusFromSearchParams(resolvedSearchParams);
  const hasUsableSession = hasUsableAppSession(session) && !accountProtectionStatus;
  const activeViewerId = hasUsableSession ? session?.user?.activeViewerId ?? null : null;
  const [bets, isLive, currentGame] = await Promise.all([
    listBets(activeViewerId),
    isStreamerbotLivestreamActive(),
    getCurrentGame(),
  ]);
  const activeBet = bets.find((bet) => bet.status === "open");
  const viewerName = hasUsableSession ? session?.user?.activeViewerDisplayName ?? session?.user?.name ?? null : null;

  return (
    <div className="flex w-full flex-col overflow-x-hidden">
      <HomeHero
        accountProtectionStatus={accountProtectionStatus}
        currentGame={currentGame}
        hasUsableSession={hasUsableSession}
        isLive={isLive}
        viewerName={viewerName}
      />

      <LiveActionSection activeBet={activeBet} hasUsableSession={hasUsableSession} />
      <LiveBetSpotlight activeBet={activeBet} loggedIn={hasUsableSession} />
    </div>
  );
}
