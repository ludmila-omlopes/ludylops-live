import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Coins, Palette, Sparkles, MessageSquare, type LucideIcon } from "lucide-react";

import { auth } from "@/auth";
import { CreatorAreaCreateForm } from "@/components/creator-area-create-form";
import { CreatorLandingCta } from "@/components/creator-landing-cta";
import { canCreateCreatorArea } from "@/lib/creators/access";
import { COMMUNITIES_PATH } from "@/lib/creators/owner-dashboard";
import { getPlatformOrigin, resolveCreatorLandingState } from "@/lib/creators/platform";
import { listCreatorAreasForOwner } from "@/lib/creators/service";

export const metadata: Metadata = {
  title: "Sua comunidade",
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
    body: "Sua comunidade ganha sua moeda pelas mensagens no chat, conforme a regra que você ativar.",
    icon: Coins,
    bg: "bg-[var(--color-mint)]",
  },
  {
    title: "Frases da comunidade",
    body: "Guarde as frases que marcaram as lives e relembre esses momentos com o chat.",
    icon: MessageSquare,
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
    hasUsableSession ? await listCreatorAreasForOwner(session!.user!.activeViewerId, { includeArchived: true }) : [];

  // Owners manage their communities elsewhere; this route stays the entry for newcomers.
  if (creatorAreas.length > 0) {
    redirect(COMMUNITIES_PATH);
  }

  return (
    <div className="surface-section flex w-full flex-1 flex-col">
      <section className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
        <div>
          <h1
            className="max-w-3xl text-4xl uppercase leading-[0.9] text-pretty sm:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Sua live, sua moeda, sua comunidade.
          </h1>
          <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-[var(--color-ink-soft)]">
            Reúna sua comunidade com uma moeda própria e resgates durante a live.
            O acesso para novos streamers está disponível por convite, em beta fechado.
          </p>

          <CommunitySection />
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

          {landingState === "approved" ? <CreatorAreaCreateForm addressPrefix={`${getPlatformOrigin()}/c/`} /> : null}
        </div>
      </section>
    </div>
  );
}
