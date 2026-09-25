export function CommunitySectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6 grid gap-2">
      <h1 className="text-3xl uppercase leading-[0.95] sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h1>
      {description ? (
        <p className="max-w-2xl text-sm font-medium leading-6 text-[var(--color-ink-soft)]">{description}</p>
      ) : null}
    </div>
  );
}
