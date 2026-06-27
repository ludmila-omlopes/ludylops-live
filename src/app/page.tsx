import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CirclePlay,
  Coins,
  Gamepad2,
  Sparkles,
  Ticket,
  Trophy,
  Users,
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
import { getHomeHeroCopy } from "@/lib/home-hero-copy";
import { isStreamerbotLivestreamActive } from "@/lib/streamerbot/live-status";
import type { BetWithOptionsRecord, CurrentGameRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const LUDYLOPS_PROFILE_IMAGE = "/selfie2.png";
const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@ludylopsgames";
const YOUTUBE_LIVE_URL = `${YOUTUBE_CHANNEL_URL}/live`;
const YOUTUBE_STREAMS_URL = `${YOUTUBE_CHANNEL_URL}/streams`;

type HomePageProps = {
  searchParams: Promise<{ googleAccountProtection?: string | string[] | undefined }>;
};

type PipetzStep = {
  title: string;
  body: string;
  icon: LucideIcon;
  bg: string;
};

type BetweenLivesLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  bg: string;
};

const PIPETZ_STEPS: PipetzStep[] = [
  {
    title: "Junte pipetz",
    body: "Os pontos entram na sua conta enquanto você acompanha a transmissão.",
    icon: Coins,
    bg: "bg-[var(--color-mint)]",
  },
  {
    title: "Dê seus palpites",
    body: "Escolha um lado nos bolões que eu abrir durante o jogo.",
    icon: Ticket,
    bg: "bg-[var(--color-pink)]",
  },
  {
    title: "Ative resgates",
    body: "Troque pipetz por efeitos que aparecem ao vivo.",
    icon: Sparkles,
    bg: "bg-[var(--color-blue)]",
  },
  {
    title: "Acompanhe o ranking",
    body: "Veja sua posição e quem mais está participando da comunidade.",
    icon: Trophy,
    bg: "bg-[var(--color-purple)]",
  },
];

const BETWEEN_LIVES_LINKS: BetweenLivesLink[] = [
  { href: "/jogos", label: "Sugestões de jogos", icon: Gamepad2, bg: "bg-[var(--color-mint)]" },
  { href: "/videos", label: "Vídeos e pautas", icon: CirclePlay, bg: "bg-[var(--color-blue)]" },
  { href: "/indicacoes", label: "Canais que me inspiram", icon: Users, bg: "bg-[var(--color-purple)]" },
];

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

function HeroGameLabel({ game, isLive }: { game: CurrentGameRecord | null; isLive: boolean }) {
  const metadata = getGameMetadataParts(game);
  const eyebrow = game ? (isLive ? "jogando agora" : "campanha atual") : isLive ? "ao vivo" : "próxima live";
  const title = game?.name ?? (isLive ? "Live da Ludylops" : "Canal da Ludylops");

  return (
    <div className="mt-8 w-full max-w-[calc(100vw-2rem)] border-l-[6px] border-[var(--color-pink)] bg-white/90 p-4 text-black shadow-[5px_5px_0_rgba(255,255,255,0.22)] backdrop-blur dark:bg-black/70 dark:text-white dark:shadow-[5px_5px_0_rgba(0,0,0,0.45)] sm:max-w-2xl">
      <p className="mono text-[10px] font-black uppercase tracking-[0.24em] text-black/65 dark:text-white/65">
        {eyebrow}
      </p>
      <h2
        className="mt-2 break-words text-3xl uppercase leading-[0.9] sm:text-4xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
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

function HeroAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative aspect-square shrink-0 overflow-hidden rounded-full border-[3px] border-[var(--color-ink)] bg-[var(--color-pink)] shadow-[4px_4px_0_var(--shadow-color)]",
        className,
      )}
    >
      <Image
        src={LUDYLOPS_PROFILE_IMAGE}
        alt="Foto da Ludylops"
        fill
        sizes="16rem"
        className="object-cover object-top contrast-110"
        priority
      />
    </div>
  );
}

function HeroActions({
  hasUsableSession,
  isLive,
}: {
  hasUsableSession: boolean;
  isLive: boolean;
}) {
  if (hasUsableSession) {
    return (
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <a
          href={YOUTUBE_CHANNEL_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-brutal bg-[var(--color-pink)] px-6 py-3 text-sm text-[var(--color-accent-ink)]"
        >
          <CirclePlay className="size-4" aria-hidden="true" />
          Ir pro canal
        </a>
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

  if (isLive) {
    return (
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <a
          href={YOUTUBE_LIVE_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-brutal accent-button px-6 py-3 text-sm"
        >
          <CirclePlay className="size-4" aria-hidden="true" />
          Assistir no YouTube
        </a>
        <AuthButtons label="Participar da live" />
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <a
        href={YOUTUBE_CHANNEL_URL}
        target="_blank"
        rel="noreferrer"
        className="btn-brutal accent-button px-6 py-3 text-sm"
      >
        <CirclePlay className="size-4" aria-hidden="true" />
        Ver próxima Live
      </a>
      <Link
        href="#pipetz"
        className="btn-brutal bg-[var(--color-mint)] px-6 py-3 text-sm text-[var(--color-accent-ink)]"
      >
        <Coins className="size-4" aria-hidden="true" />
        Como funcionam os pipetz
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
  const { title, description } = getHomeHeroCopy({
    accountProtectionStatus,
    hasUsableSession,
    isLive,
  });

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
          <div className="flex flex-wrap items-center gap-4">
            <HeroAvatar className="w-20 sm:w-24" />
            <LivestreamIndicator isLive={isLive} />
            {viewerName ? (
              <span className="mono border border-white/40 bg-black/45 px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white">
                {viewerName}
              </span>
            ) : null}
          </div>

          <h1
            className="mt-6 max-w-4xl break-words text-4xl leading-[0.92] text-pretty [overflow-wrap:anywhere] sm:text-5xl lg:text-[4.25rem]"
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

          <HeroActions hasUsableSession={hasUsableSession} isLive={isLive} />
          <HeroGameLabel game={currentGame} isLive={isLive} />
        </div>
      </div>
    </section>
  );
}

function PipetzSection() {
  return (
    <section id="pipetz" className="landing-plane scroll-mt-24 bg-[var(--color-paper)] py-9 sm:py-12">
      <div className="mx-auto w-full max-w-[1520px] px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl">
          <h2
            className="text-4xl uppercase leading-[0.9] text-pretty sm:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            O chat entra no jogo.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[var(--color-ink-soft)]">
            Você junta pipetz enquanto assiste e usa os pontos para participar do que acontece
            durante a live.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PIPETZ_STEPS.map((step) => {
            const Icon = step.icon;

            return (
              <article
                key={step.title}
                className={cn(
                  "flex h-full min-w-0 flex-col border-[3px] border-[var(--color-ink)] p-5 text-[var(--color-accent-ink)] shadow-[5px_5px_0_var(--shadow-color)]",
                  step.bg,
                )}
              >
                <div className="flex size-12 items-center justify-center border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)]">
                  <Icon className="size-6" aria-hidden="true" />
                </div>
                <h3
                  className="mt-5 text-2xl uppercase leading-[0.95]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {step.title}
                </h3>
                <p className="mt-3 text-sm font-medium leading-6 text-[var(--color-accent-ink-soft)]">
                  {step.body}
                </p>
              </article>
            );
          })}
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
          <h2
            className="max-w-3xl break-words text-4xl uppercase leading-[0.9] text-pretty sm:text-5xl"
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

function CampaignSection({ game }: { game: CurrentGameRecord | null }) {
  if (!game) {
    return null;
  }

  const metadata = getGameMetadataParts(game);
  const shortName = game.name.split(":")[0]?.trim() || game.name;

  return (
    <section className="landing-plane landing-divider bg-[var(--color-paper)] py-9 sm:py-12">
      <div className="mx-auto grid w-full max-w-[1520px] gap-6 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-10">
        {game.coverImageUrl ? (
          <div className="overflow-hidden border-[3px] border-[var(--color-ink)] shadow-[6px_6px_0_var(--shadow-color)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={game.coverImageUrl}
              alt={`Capa de ${game.name}`}
              className="aspect-video w-full object-cover"
            />
          </div>
        ) : null}

        <div>
          <h2
            className="break-words text-4xl uppercase leading-[0.9] text-pretty sm:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {game.name}
          </h2>
          {metadata.length > 0 ? (
            <p className="mono mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
              {metadata.join(" / ")}
            </p>
          ) : null}
          <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-[var(--color-ink-soft)]">
            Estou jogando a campanha nas lives. Veja os últimos episódios, acompanhe de onde
            paramos e entre na próxima transmissão.
          </p>
          <a
            href={YOUTUBE_STREAMS_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-brutal accent-button mt-7 px-5 py-3 text-sm"
          >
            <CirclePlay className="size-4" aria-hidden="true" />
            Ver as lives de {shortName}
          </a>
        </div>
      </div>
    </section>
  );
}

function BetweenLivesSection() {
  return (
    <section className="landing-plane landing-divider bg-[var(--color-paper-pink)] py-9 sm:py-12">
      <div className="mx-auto w-full max-w-[1520px] px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl">
          <h2
            className="text-4xl uppercase leading-[0.9] text-pretty sm:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Entre uma live e outra.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[var(--color-ink-soft)]">
            Veja os jogos sugeridos pelo chat, vídeos que podem virar assunto e canais que eu
            acompanho.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {BETWEEN_LIVES_LINKS.map((link) => {
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "group flex items-center justify-between gap-3 border-[3px] border-[var(--color-ink)] p-5 text-[var(--color-accent-ink)] shadow-[5px_5px_0_var(--shadow-color)] transition-transform hover:-translate-y-0.5",
                  link.bg,
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className="size-6 shrink-0" aria-hidden="true" />
                  <span className="break-words text-lg font-black uppercase leading-tight [overflow-wrap:anywhere]">
                    {link.label}
                  </span>
                </span>
                <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
              </Link>
            );
          })}
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

      <PipetzSection />
      <LiveBetSpotlight activeBet={activeBet} loggedIn={hasUsableSession} />
      <CampaignSection game={currentGame} />
      <BetweenLivesSection />
    </div>
  );
}
