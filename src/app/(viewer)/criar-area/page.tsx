import type { Metadata } from "next";
import Link from "next/link";
import { Coins, Palette, Sparkles, Ticket, type LucideIcon } from "lucide-react";

import { auth } from "@/auth";
import { CreatorAreaCreateForm } from "@/components/creator-area-create-form";
import { CreatorLandingCta } from "@/components/creator-landing-cta";
import { canCreateCreatorArea } from "@/lib/creators/access";
import { PLATFORM_NAME, resolveCreatorLandingState } from "@/lib/creators/platform";
import { listCreatorAreasForOwner } from "@/lib/creators/service";

export const metadata: Metadata = {
  title: `${PLATFORM_NAME} — crie a área da sua comunidade`,
};

type CommunityStep = {
  title: string;
  body: string;
  icon: LucideIcon;
  bg: string;
};

const COMMUNITY_STEPS: CommunityStep[] = [
  {
    title: "Pontos acumulados",
    body: "Sua comunidade acumula pontos enquanto assiste, direto na live.",
    icon: Coins,
    bg: "bg-[var(--color-mint)]",
  },
  {
    title: "Bolões ao vivo",
    body: "Ela aposta nos rumos do jogo enquanto a partida acontece.",
    icon: Ticket,
    bg: "bg-[var(--color-pink)]",
  },
  {
    title: "Resgates com efeito",
    body: "Ela troca pontos por efeitos que aparecem na sua transmissão.",
    icon: Sparkles,
    bg: "bg-[var(--color-blue)]",
  },
  {
    title: "Sua identidade",
    body: "Tudo com o nome e as cores do seu canal, no seu próprio endereço.",
    icon: Palette,
    bg: "bg-[var(--color-purple)]",
  },
];

function CommunitySection() {
  return (
    <section className="mt-10">
      <div className="grid gap-4 sm:grid-cols-2">
        {COMMUNITY_STEPS.map((step) => {
          const Icon = step.icon;

          return (
            <article
              key={step.title}
              className={`flex h-full min-w-0 flex-col border-[3px] border-[var(--color-ink)] p-5 text-[var(--color-accent-ink)] shadow-[5px_5px_0_var(--shadow-color)] ${step.bg}`}
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
    </section>
  );
}

export default async function CreateCreatorAreaPage() {
  const session = await auth();
  const hasUsableSession = Boolean(session?.user?.email && session.user.activeViewerId);
  const canCreateArea = hasUsableSession ? await canCreateCreatorArea(session!.user!.email) : false;
  const landingState = resolveCreatorLandingState({ hasUsableSession, canCreateArea });

  const creatorAreas =
    landingState === "approved" ? await listCreatorAreasForOwner(session!.user!.activeViewerId) : [];

  return (
    <div className="surface-section flex w-full flex-col">
      <section className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
        <div>
          <h1
            className="max-w-3xl text-4xl uppercase leading-[0.9] text-pretty sm:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Sua live, sua área, sua comunidade.
          </h1>
          <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-[var(--color-ink-soft)]">
            {PLATFORM_NAME} está em beta fechado: crie um ponto de encontro para a sua comunidade,
            com pontos, bolões e resgates que acontecem durante a sua live.
          </p>

          <CommunitySection />

          {landingState === "approved" && creatorAreas.length > 0 ? (
            <div className="mt-8 grid gap-3">
              <h2
                className="text-2xl uppercase text-[var(--color-ink)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Suas áreas
              </h2>
              {creatorAreas.map((creator) => (
                <Link
                  key={creator.id}
                  href={creator.publicPath}
                  className="group flex items-center justify-between gap-3 border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-4 shadow-[4px_4px_0_var(--shadow-color)] transition-transform hover:-translate-y-0.5"
                >
                  <span className="min-w-0">
                    <span className="block break-words text-lg font-black uppercase leading-tight text-[var(--color-ink)]">
                      {creator.displayName}
                    </span>
                    <span className="mt-1 block break-all text-sm font-bold text-[var(--color-ink-soft)]">
                      {creator.publicHostname}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-xl font-black">
                    →
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5 shadow-[6px_6px_0_var(--shadow-color)] sm:p-6">
          {landingState === "visitor" ? (
            <div className="grid gap-4">
              <h2
                className="text-2xl uppercase text-[var(--color-ink)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Crie a área da sua comunidade
              </h2>
              <p className="text-sm font-medium leading-6 text-[var(--color-ink-soft)]">
                A criação de novas áreas está em beta fechado. Entre com sua conta Google para ver
                se o seu email já está liberado.
              </p>
              <CreatorLandingCta />
            </div>
          ) : null}

          {landingState === "closed_beta" ? (
            <div className="grid gap-4">
              <h2
                className="text-2xl uppercase text-[var(--color-ink)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Beta fechado
              </h2>
              <p className="text-sm font-medium leading-6 text-[var(--color-ink-soft)]">
                Novas áreas estão em beta fechado e o acesso é liberado por convite. O email da
                conta Google usada no login (<strong>{session?.user?.email}</strong>) ainda não
                está na lista de aprovados. Peça para liberar esse endereço e tente novamente
                depois.
              </p>
            </div>
          ) : null}

          {landingState === "approved" ? <CreatorAreaCreateForm /> : null}
        </div>
      </section>
    </div>
  );
}
