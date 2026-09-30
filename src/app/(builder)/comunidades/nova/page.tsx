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
    <div className="hub-page hub-page-narrow grid gap-6">
      <Link href={COMMUNITIES_PATH} className="hub-back">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Minhas comunidades
      </Link>
      <h1 className="hub-h1">Nova comunidade</h1>
      <div className="hub-card hub-card-pad sm:p-8">
        <CreatorAreaCreateForm addressPrefix={`${getPlatformOrigin()}/c/`} />
      </div>
    </div>
  );
}
