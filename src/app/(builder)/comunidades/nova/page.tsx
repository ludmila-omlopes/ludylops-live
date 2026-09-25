import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CreatorAreaCreateForm } from "@/components/creator-area-create-form";
import { requireSession } from "@/lib/auth/session";
import { canCreateCreatorArea } from "@/lib/creators/access";
import { COMMUNITIES_PATH } from "@/lib/creators/owner-dashboard";
import { getPlatformOrigin } from "@/lib/creators/platform";

export const metadata: Metadata = {
  title: "Nova comunidade",
};

export default async function NewCommunityPage() {
  const session = await requireSession();
  if (!(await canCreateCreatorArea(session.user!.email))) {
    redirect("/criar-area");
  }

  return (
    <div className="surface-section flex w-full flex-1 flex-col">
      <section className="mx-auto grid w-full max-w-[760px] gap-6 px-4 py-10 sm:px-6">
        <Link
          href={COMMUNITIES_PATH}
          className="inline-flex items-center gap-2 justify-self-start text-sm font-bold text-[var(--color-ink-soft)] underline decoration-2 underline-offset-4"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Minhas comunidades
        </Link>
        <h1
          className="text-4xl uppercase leading-[0.9] sm:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Nova comunidade
        </h1>
        <div className="border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5 shadow-[6px_6px_0_var(--shadow-color)] sm:p-6">
          <CreatorAreaCreateForm addressPrefix={`${getPlatformOrigin()}/c/`} />
        </div>
      </section>
    </div>
  );
}
