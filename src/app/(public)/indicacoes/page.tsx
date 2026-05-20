/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import { auth } from "@/auth";
import { CreatorSuggestionList } from "@/components/creator-suggestion-list";
import {
  getViewerDashboard,
  listCreatorSuggestions,
  listFeaturedCreatorSuggestions,
} from "@/lib/db/repository";
import type { CreatorSuggestionWithMeta } from "@/lib/types";

export const metadata: Metadata = {
  title: "Inspirações da comunidade | Pipetz",
  description: "YouTubers e streamers recomendados para a comunidade.",
};

function getCreatorAvatarUrl(creator: CreatorSuggestionWithMeta) {
  const url = new URL(creator.channelUrl);
  const handle = url.pathname.split("/").filter(Boolean).at(-1)?.replace(/^@/, "");

  if (!handle) {
    return "https://unavatar.io/pipetz";
  }

  if (creator.platform === "twitch") {
    return `https://unavatar.io/twitch/${handle}`;
  }

  if (creator.platform === "youtube") {
    return `https://unavatar.io/youtube/${handle}`;
  }

  return `https://unavatar.io/${handle}`;
}

function AdminCreatorCard({
  creator,
}: {
  creator: CreatorSuggestionWithMeta;
}) {
  return (
    <article className="card-brutal flex h-full flex-col bg-[var(--color-paper)] p-4">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center gap-3">
          <img
            src={getCreatorAvatarUrl(creator)}
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
            {creator.reason}
          </p>
          <a
            href={creator.channelUrl}
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
  const [featuredCreators, creatorSuggestions, dashboard] = await Promise.all([
    listFeaturedCreatorSuggestions(),
    listCreatorSuggestions(activeViewerId),
    activeViewerId ? getViewerDashboard(activeViewerId) : Promise.resolve(null),
  ]);
  const viewerBalance = dashboard?.balance.currentBalance ?? null;
  const canInteract = Boolean(activeViewerId && dashboard?.viewer.isLinked);

  return (
    <div className="flex w-full flex-col">
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
              {featuredCreators.map((creator) => (
                <AdminCreatorCard key={creator.id} creator={creator} />
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
