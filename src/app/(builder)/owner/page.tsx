import { CreatorAreaCreateForm } from "@/components/creator-area-create-form";
import { PlatformOwnerCreatorList } from "@/components/platform-owner-creator-list";
import { requirePlatformOwnerSession } from "@/lib/auth/session";
import { canCreateCreatorArea } from "@/lib/creators/access";
import { listPlatformCreatorInstances } from "@/lib/creators/instances";

export default async function OwnerPage() {
  const session = await requirePlatformOwnerSession();
  const [instances, canCreateArea] = await Promise.all([
    listPlatformCreatorInstances(),
    canCreateCreatorArea(session.user!.email),
  ]);

  return (
    <div className="flex w-full flex-col">
      <section className="landing-plane surface-hero py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <h1
            className="text-4xl uppercase sm:text-6xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Plataforma
          </h1>
        </div>
      </section>

      {canCreateArea ? (
        <section className="landing-plane bg-[var(--color-paper)] py-6 sm:py-8">
          <div className="mx-auto grid w-full max-w-[1500px] gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.7fr)] lg:px-10">
            <div className="self-center">
              <h2
                className="text-3xl uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Nova área
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-[var(--color-ink-soft)]">
                Crie uma instância para um criador aprovado no beta e deixe domínio,
                branding inicial e módulos principais preparados.
              </p>
            </div>
            <div className="border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5 shadow-[6px_6px_0_var(--shadow-color)] sm:p-6">
              <CreatorAreaCreateForm />
            </div>
          </div>
        </section>
      ) : null}

      <PlatformOwnerCreatorList instances={instances} />
    </div>
  );
}
