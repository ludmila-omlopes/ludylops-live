import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Globe, Link2, Palette, type LucideIcon } from "lucide-react";

import { auth } from "@/auth";
import { CreatorAreaCreateForm } from "@/components/creator-area-create-form";
import { CreatorLandingCta } from "@/components/creator-landing-cta";
import { CreatorBetaRequest } from "@/components/creator-beta-request";
import { canCreateCreatorArea } from "@/lib/creators/access";
import { COMMUNITIES_PATH } from "@/lib/creators/owner-dashboard";
import { getPlatformOrigin, resolveCreatorLandingState } from "@/lib/creators/platform";
import { listCreatorAreasForOwner } from "@/lib/creators/service";

export const metadata: Metadata = {
  title: "Criar comunidade",
};

// What a new community gets today; live features are installed separately.
const INCLUDED: { title: string; body: string; icon: LucideIcon }[] = [
  { title: "Endereço próprio", body: "Um link curto para a bio, a descrição dos vídeos e o chat.", icon: Globe },
  { title: "Seu visual, suas cores", body: "Escolha entre três templates e use as cores do seu canal.", icon: Palette },
  { title: "Links de afiliado", body: "Os produtos que você usa, com o seu link e o motivo de cada indicação.", icon: Link2 },
];

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
    <div className="hub-page grid items-start gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
      <div className="grid gap-6">
        <h1 className="hub-h1">Crie a sua comunidade.</h1>
        <p className="hub-sub">
          Um ponto de encontro para quem acompanha o seu canal. O acesso está em beta fechado e é liberado por aprovação.
        </p>
        <ul className="mt-4 grid gap-5">
          {INCLUDED.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-4">
                <span className="hub-well grid size-11 place-items-center text-[var(--hub-accent-text)]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="hub-muted text-[15px]">{item.body}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="hub-card hub-card-pad grid gap-5 sm:p-8">
        {landingState === "visitor" ? (
          <>
            <h2 className="hub-h2">Entre para começar</h2>
            <p className="hub-muted text-[15px]">
              Use a sua conta Google. Se o seu email ainda não estiver liberado, você pode pedir acesso ao beta em seguida.
            </p>
            <CreatorLandingCta />
          </>
        ) : null}

        {landingState === "closed_beta" ? (
          <>
            <h2 className="hub-h2">Peça acesso ao beta</h2>
            <CreatorBetaRequest email={session!.user!.email!} />
          </>
        ) : null}

        {landingState === "approved" ? (
          <>
            <h2 className="hub-h2">Sua comunidade</h2>
            <CreatorAreaCreateForm addressPrefix={`${getPlatformOrigin()}/c/`} />
          </>
        ) : null}
      </div>
    </div>
  );
}
