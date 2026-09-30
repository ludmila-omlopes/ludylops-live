import { CreatorAreaCreateForm } from "@/components/creator-area-create-form";
import { PlatformOwnerCreatorList } from "@/components/platform-owner-creator-list";
import { requirePlatformOwnerSession } from "@/lib/auth/session";
import { canCreateCreatorArea } from "@/lib/creators/access";
import { listPlatformCreatorInstances } from "@/lib/creators/instances";
import { getPlatformOrigin } from "@/lib/creators/platform";

export default async function OwnerPage() {
  const session = await requirePlatformOwnerSession();
  const [instances, canCreateArea] = await Promise.all([
    listPlatformCreatorInstances(),
    canCreateCreatorArea(session.user!.email),
  ]);

  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto grid w-[min(1500px,100%-32px)] gap-8 pt-12 pb-6">
        <h1 className="hub-h1">Plataforma</h1>

        {canCreateArea ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.7fr)]" aria-labelledby="nova-area">
            <div className="grid content-center gap-2">
              <h2 id="nova-area" className="hub-h2">Nova área</h2>
              <p className="hub-sub text-[15px]">
                Convide um criador para reunir sua comunidade com nome, cores e moeda próprios.
              </p>
            </div>
            <div className="hub-card hub-card-pad sm:p-8">
              <CreatorAreaCreateForm addressPrefix={`${getPlatformOrigin()}/c/`} />
            </div>
          </section>
        ) : null}
      </div>

      <PlatformOwnerCreatorList instances={instances} />
    </div>
  );
}
