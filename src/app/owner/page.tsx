import { PlatformOwnerCreatorList } from "@/components/platform-owner-creator-list";
import { listPlatformCreatorInstances } from "@/lib/creators/instances";
import { requirePlatformOwnerSession } from "@/lib/auth/session";

export default async function OwnerPage() {
  await requirePlatformOwnerSession();
  const instances = await listPlatformCreatorInstances();

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

      <PlatformOwnerCreatorList instances={instances} />
    </div>
  );
}
