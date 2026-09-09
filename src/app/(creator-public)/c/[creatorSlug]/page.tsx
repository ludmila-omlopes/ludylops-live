import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, CirclePlay } from "lucide-react";

import { getEnabledCreatorModules, getCreatorModuleManifest } from "@/lib/creators/modules";
import { getCreatorAreaBySlug } from "@/lib/creators/service";

type CreatorPageProps = {
  params: Promise<{
    creatorSlug: string;
  }>;
};

export default async function CreatorAreaPage({ params }: CreatorPageProps) {
  const { creatorSlug } = await params;
  const tenant = await getCreatorAreaBySlug(creatorSlug);

  if (!tenant) {
    notFound();
  }

  const modules = getEnabledCreatorModules(tenant.modules)
    .map((module) => getCreatorModuleManifest(module.moduleKey))
    .filter((module) => module !== null);
  const primaryModules = modules.slice(0, 6);

  return (
    <div className="flex w-full flex-col">
      <section
        className="relative overflow-hidden border-b-[3px] border-[var(--color-ink)] px-4 py-12 text-[var(--color-ink)] sm:px-6 lg:px-10"
        style={{
          background: `linear-gradient(135deg, ${tenant.branding.primaryColor}, ${tenant.branding.accentColor})`,
        }}
      >
        <div className="mx-auto grid w-full max-w-[1280px] gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <div className="flex size-20 items-center justify-center border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] text-3xl font-black uppercase shadow-[5px_5px_0_var(--shadow-color)]">
              {tenant.creator.displayName.slice(0, 1)}
            </div>
            <h1
              className="mt-6 max-w-4xl break-words text-5xl uppercase leading-[0.9] text-pretty sm:text-6xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {tenant.creator.displayName}
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-[var(--color-accent-ink)]">
              A comunidade já tem endereço reservado para lives, pontos, desafios e interações ao vivo.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={`https://${tenant.creator.slug}.ludylops.live`}
                className="btn-brutal ink-button px-5 py-3 text-xs text-[var(--color-accent-ink)]"
              >
                <CirclePlay className="size-4" aria-hidden="true" />
                Abrir subdomínio
              </a>
            </div>
          </div>

          <div className="border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5 shadow-[6px_6px_0_var(--shadow-color)]">
            <h2
              className="text-2xl uppercase leading-none text-[var(--color-ink)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Módulos preparados
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {primaryModules.map((module) => (
                <div key={module.key} className="flex min-w-0 items-center gap-3 border-[2px] border-[var(--color-ink)] bg-[var(--color-paper-pink)] p-3">
                  <CheckCircle2 className="size-5 shrink-0 text-[var(--color-ink)]" aria-hidden="true" />
                  <span className="break-words text-sm font-black uppercase leading-tight text-[var(--color-ink)]">
                    {module.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm font-medium leading-6 text-[var(--color-ink-soft)]">
              A operação completa entra quando pontos, apostas e sugestões estiverem separados para esta comunidade.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-paper)] px-4 py-10 sm:px-6 lg:px-10">
        <div className="mx-auto grid w-full max-w-[1280px] gap-4 sm:grid-cols-3">
          {modules.slice(0, 3).map((module) => (
            <article key={module.key} className="border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5 shadow-[5px_5px_0_var(--shadow-color)]">
              <h3 className="text-xl font-black uppercase leading-tight text-[var(--color-ink)]">{module.label}</h3>
              <p className="mt-3 text-sm font-medium leading-6 text-[var(--color-ink-soft)]">
                Preparado para entrar no fluxo da live quando esta comunidade tiver dados próprios.
              </p>
              {module.publicRoutes[0] ? (
                <div className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                  {module.publicRoutes[0]}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
