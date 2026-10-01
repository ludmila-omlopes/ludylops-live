import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCreatorAreaBySlug } from "@/lib/creators/service";
import { creatorHomeLinks } from "@/lib/creators/home";
import { creatorColorInk, safeCreatorColor } from "@/lib/creators/profile";
import { DEFAULT_CREATOR_ID, DEFAULT_CREATOR_DOMAIN } from "@/lib/creators/defaults";
import { hasLiveModules } from "@/lib/creators/modules";
import { creatorTemplateFrom } from "@/lib/creators/templates";

export default async function CreatorAreaPage({ params }: { params: Promise<{ creatorSlug: string }> }) {
  const { creatorSlug } = await params;
  const requestHeaders = await headers();
  const tenant = await getCreatorAreaBySlug(creatorSlug, { hostname: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") });
  if (!tenant) notFound();
  if (tenant.creator.id === DEFAULT_CREATOR_ID) redirect(`https://${DEFAULT_CREATOR_DOMAIN}`);
  const links = creatorHomeLinks(tenant);
  const live = hasLiveModules(tenant.modules);
  const initial = Array.from(tenant.creator.displayName)[0];
  const tagline = live ? "Cada live rende uma história. Essa comunidade faz parte dela." : "Escolhas, descobertas e indicações para compartilhar com você.";
  const heading = live ? "Entre uma live e outra." : "Para conhecer de perto.";
  const emptyText = live ? "Até o próximo encontro na live." : "Novas indicações em breve.";

  const template = creatorTemplateFrom(tenant.branding.themeJson);

  if (template === "estudio") {
    return <div className="flex w-full flex-col">
      <header className="estudio-hero">
        <div aria-hidden="true" className="estudio-grid" />
        <div className="estudio-wrap estudio-hero-in">
          <div aria-hidden="true" className="estudio-avatar">{initial}</div>
          <h1 className="estudio-title">{tenant.creator.displayName}</h1>
          <p className="estudio-lede">{tagline}</p>
          <span className="estudio-meta">/c/{tenant.creator.slug}</span>
        </div>
      </header>
      <section className="estudio-sec">
        <div className="estudio-wrap grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <h2 className="estudio-h2">{heading}</h2>
          {links.length ? <nav aria-label="Participar da comunidade" className="estudio-links">
            {links.map((link) => <Link key={link.href} href={link.href} className="estudio-link">
              <span className="min-w-0">
                <span className="block break-words text-lg font-medium tracking-tight sm:text-xl">{link.label}</span>
                <span className="hub-muted mt-1 block break-words text-sm leading-6">{link.description}</span>
              </span>
              <span aria-hidden="true" className="estudio-arrow"><ArrowUpRight className="size-4" /></span>
            </Link>)}
          </nav> : <p className="hub-sub">{emptyText}</p>}
        </div>
      </section>
    </div>;
  }

  if (template === "palco") {
    return <div className="hub-page grid gap-12 sm:gap-16">
      <header className="hub-card palco-hero">
        <div aria-hidden="true" className="palco-avatar">{initial}</div>
        <h1 className="palco-title">{tenant.creator.displayName}</h1>
        <p className="hub-sub">{tagline}</p>
      </header>
      <section className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
        <h2 className="hub-h2">{heading}</h2>
        {links.length ? <nav aria-label="Participar da comunidade" className="grid gap-3">
          {links.map((link) => <Link key={link.href} href={link.href} className="hub-item palco-link group">
            <span className="min-w-0">
              <span className="block break-words text-lg font-semibold tracking-tight">{link.label}</span>
              <span className="hub-muted mt-1 block break-words text-sm leading-6">{link.description}</span>
            </span>
            <span aria-hidden="true" className="palco-link-arrow"><ArrowUpRight className="size-4" /></span>
          </Link>)}
        </nav> : <p className="hub-sub">{emptyText}</p>}
      </section>
    </div>;
  }

  const primary = safeCreatorColor(tenant.branding.primaryColor, "#c7a2e9");
  const accent = safeCreatorColor(tenant.branding.accentColor, "#40a9ff");
  return <div className="flex w-full flex-col">
    <header className="relative overflow-hidden px-4 pb-14 pt-12 sm:px-6 sm:pb-20 lg:px-10"
      style={{ backgroundColor: primary, color: creatorColorInk(primary) }}>
      <div className="mx-auto w-full max-w-[1200px]">
        <div aria-hidden="true" className="flex size-16 items-center justify-center border-[3px] border-current text-3xl font-black uppercase">
          {initial}
        </div>
        <h1 className="mt-8 max-w-4xl break-words text-5xl uppercase leading-[0.95] text-pretty sm:text-7xl"
          style={{ fontFamily: "var(--font-display)" }}>{tenant.creator.displayName}</h1>
        <p className="mt-6 max-w-xl text-lg font-medium leading-8">{tagline}</p>
      </div>
    </header>
    <div aria-hidden="true" className="h-4 border-y-[3px] border-[var(--color-ink)]" style={{ backgroundColor: accent }} />
    <section className="bg-[var(--color-paper)] px-4 pb-16 pt-10 sm:px-6 lg:px-10">
      <div className="mx-auto grid w-full max-w-[1200px] gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
        <h2 className="max-w-xs text-3xl font-black leading-tight">{heading}</h2>
        {links.length ? <nav aria-label="Participar da comunidade" className="border-t-[3px] border-[var(--color-ink)]">
          {links.map((link) => <Link key={link.href} href={link.href}
            className="group flex min-w-0 items-center justify-between gap-5 border-b-2 border-[var(--color-ink)] py-6 transition-colors hover:bg-[var(--color-paper-pink)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4">
            <span className="min-w-0">
              <span className="block break-words text-xl font-black sm:text-2xl">{link.label}</span>
              <span className="mt-2 block break-words text-sm leading-6 text-[var(--color-ink-soft)]">{link.description}</span>
            </span>
            <ArrowUpRight aria-hidden="true" className="size-6 shrink-0 transition-transform motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:translate-x-1" />
          </Link>)}
        </nav> : <p className="max-w-lg text-lg leading-8">{emptyText}</p>}
      </div>
    </section>
  </div>;
}
