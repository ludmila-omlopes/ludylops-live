export function CommunitySectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8 grid gap-3">
      <h1 className="text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">{title}</h1>
      {description ? <p className="hub-sub text-[15px]">{description}</p> : null}
    </div>
  );
}
