import Link from "next/link";
import { notFound } from "next/navigation";

import { CreatorAreaCreateForm } from "@/components/creator-area-create-form";
import { requireSession } from "@/lib/auth/session";
import { canCreateCreatorArea } from "@/lib/creators/access";
import { listCreatorAreasForOwner } from "@/lib/creators/service";

export default async function CreateCreatorAreaPage() {
  const session = await requireSession();
  const isAllowed = await canCreateCreatorArea(session.user!.email);
  if (!isAllowed) {
    notFound();
  }

  const creatorAreas = await listCreatorAreasForOwner(session.user!.activeViewerId);

  return (
    <div className="surface-section flex w-full flex-col">
      <section className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
        <div>
          <h1
            className="max-w-3xl text-4xl uppercase leading-[0.9] text-pretty sm:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Crie um ponto de encontro para sua comunidade.
          </h1>
          <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-[var(--color-ink-soft)]">
            Escolha o nome, reserve o endereço e deixe os módulos principais preparados para a sua live.
          </p>

          {creatorAreas.length > 0 ? (
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
          <CreatorAreaCreateForm />
        </div>
      </section>
    </div>
  );
}
