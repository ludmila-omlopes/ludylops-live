/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import { auth } from "@/auth";
import { CreatorSuggestionList } from "@/components/creator-suggestion-list";
import {
  getViewerDashboard,
  listCreatorSuggestions,
} from "@/lib/db/repository";

export const metadata: Metadata = {
  title: "Inspirações da comunidade | Pipetz",
  description: "YouTubers e streamers recomendados para a comunidade.",
};

const adminCreatorRecommendations = [
  {
    name: "Nerdologia",
    href: "https://www.youtube.com/@nerdologia",
    avatarUrl: "https://unavatar.io/youtube/nerdologia",
    platform: "YouTube",
    category: "ciência e cultura pop",
    context:
      "Vídeos bem pesquisados para quando a live precisa de pauta curiosa e nerd.",
  },
  {
    name: "Jogabilidade",
    href: "https://www.youtube.com/@Jogabilidade",
    avatarUrl: "https://unavatar.io/youtube/Jogabilidade",
    platform: "YouTube",
    category: "games",
    context:
      "Conversas, reviews e contexto de jogos com um ritmo bom para descobrir coisa nova.",
  },
  {
    name: "Alanzoka",
    href: "https://www.twitch.tv/alanzoka",
    avatarUrl: "https://unavatar.io/twitch/alanzoka",
    platform: "Twitch",
    category: "variedades e gameplay",
    context:
      "Referência brasileira de live variada, caótica na medida e cheia de repertório.",
  },
];

function AdminCreatorCard({
  creator,
}: {
  creator: (typeof adminCreatorRecommendations)[number];
}) {
  return (
    <article className="card-brutal flex h-full flex-col bg-[var(--color-paper)] p-4">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center gap-3">
          <img
            src={creator.avatarUrl}
            alt={`Foto de perfil de ${creator.name}`}
            className="size-16 shrink-0 border-2 border-[var(--color-ink)] object-cover"
          />
          <div className="min-w-0 flex-1">
            <h3
              className="text-xl font-bold uppercase leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {creator.name}
            </h3>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4">
          <h3 className="sr-only" style={{ fontFamily: "var(--font-display)" }}>
            {creator.name}
          </h3>
          <p className="text-sm leading-6 text-[var(--color-ink-soft)]">
            {creator.context}
          </p>
          <a
            href={creator.href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brutal inline-flex items-center justify-center gap-2 bg-[var(--color-paper)] px-4 py-2 text-xs text-[var(--color-ink)]"
          >
            <ExternalLinkIcon className="size-4" aria-hidden="true" />
            Abrir canal
          </a>
        </div>
      </div>
    </article>
  );
}

export default async function IndicacoesPage() {
  const session = await auth();
  const activeViewerId = session?.user?.activeViewerId ?? null;
  const [creatorSuggestions, dashboard] = await Promise.all([
    listCreatorSuggestions(activeViewerId),
    activeViewerId ? getViewerDashboard(activeViewerId) : Promise.resolve(null),
  ]);
  const viewerBalance = dashboard?.balance.currentBalance ?? null;
  const canInteract = Boolean(activeViewerId);

  return (
    <div className="flex w-full flex-col pb-20">
      <section className="landing-plane surface-hero relative overflow-hidden py-8 sm:py-10">
        <div className="bg-dots-light pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <h1
            className="text-4xl uppercase sm:text-6xl lg:text-7xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Inspirações da comunidade
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)] sm:text-base">
            Inspirações pra mim e pra comunidade: YouTubers e streamers que
            valem conhecer, somados aos nomes que a galera indica com pipetz.
          </p>
        </div>
      </section>

      <section className="landing-plane landing-divider py-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 sm:px-6 lg:px-8">
          <section className="space-y-4">
            <div>
              <h2
                className="text-2xl font-bold uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Canais que me inspiram
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-ink-soft)]">
                Lista boa pra me conhecer. Esses canais me inspiram, seja pelo
                conteúdo e/ou pela índole do criador.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {adminCreatorRecommendations.map((creator) => (
                <AdminCreatorCard key={creator.href} creator={creator} />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <CreatorSuggestionList
              suggestions={creatorSuggestions}
              loggedIn={Boolean(session?.user)}
              canInteract={canInteract}
              viewerBalance={viewerBalance}
            />
          </section>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="btn-brutal bg-[var(--color-paper)] px-5 py-3 text-xs text-[var(--color-ink)]"
            >
              Voltar para home
            </Link>
            <Link
              href="/produtinhos"
              className="btn-brutal bg-[var(--color-blue)] px-5 py-3 text-xs text-[var(--color-accent-ink)]"
            >
              Ver produtinhos
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
