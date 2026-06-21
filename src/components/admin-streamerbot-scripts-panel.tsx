"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  groupStreamerbotScripts,
  streamerbotGlobalVariables,
  type StreamerbotScriptRecord,
} from "@/lib/streamerbot/scripts-catalog";

function CopyCodeButton({ source, label }: { source: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="neutral" size="sm" onClick={handleCopy}>
      {copied ? "Copiado" : label}
    </Button>
  );
}

function StreamerbotScriptCard({ script }: { script: StreamerbotScriptRecord }) {
  return (
    <Card className="card-brutal-static overflow-hidden bg-[var(--color-paper)]">
      <CardHeader className="gap-2 border-b-2 border-[var(--color-ink)] p-4">
        <CardTitle className="text-lg uppercase">{script.title}</CardTitle>
        <CardDescription className="text-sm leading-6 text-[var(--color-ink-soft)]">
          {script.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-4">
        <p className="text-sm">
          <span className="font-black uppercase tracking-[0.12em]">Trigger ou comando:</span>{" "}
          <span className="text-[var(--color-ink-soft)]">{script.trigger}</span>
        </p>
        <pre className="max-h-[420px] overflow-auto rounded-none border-2 border-[var(--color-ink)] bg-[var(--color-ink)] p-4 text-xs leading-5 text-[var(--color-paper)]">
          <code>{script.source}</code>
        </pre>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3 border-t-2 border-[var(--color-ink)] p-4">
        <CopyCodeButton source={script.source} label="Copiar código C#" />
      </CardFooter>
    </Card>
  );
}

export function AdminStreamerbotScriptsPanel({
  scripts,
}: {
  scripts: StreamerbotScriptRecord[];
}) {
  const groupedScripts = useMemo(() => groupStreamerbotScripts(scripts), [scripts]);

  return (
    <div className="panel surface-section p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-bold uppercase"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Códigos C# da integração
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)]">
            Todos os scripts usados pelo app ficam centralizados aqui. Copie o trecho desejado e
            cole em uma Sub-Action Execute C# Code no Streamer.bot. Antes de publicar instruções
            novas, confira a documentação oficial em{" "}
            <a
              href="https://docs.streamer.bot/"
              target="_blank"
              rel="noreferrer"
              className="font-bold underline decoration-[3px] underline-offset-4"
            >
              docs.streamer.bot
            </a>
            .
          </p>
        </div>
        <span className="badge-brutal bg-[var(--color-mint)] px-3 py-1 text-xs font-black uppercase">
          {scripts.length} scripts
        </span>
      </div>

      <div className="mt-6 grid gap-4">
        <div className="card-brutal-static bg-[var(--color-paper-pink)] p-4">
          <h3 className="text-sm font-black uppercase tracking-[0.12em]">Globals obrigatórias</h3>
          <div className="mt-3 grid gap-3">
            {streamerbotGlobalVariables.map((variable) => (
              <div key={variable.name} className="grid gap-1 text-sm">
                <p className="font-bold">
                  <code className="rounded border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-2 py-0.5 text-xs">
                    {variable.name}
                  </code>
                  {variable.required ? (
                    <span className="ml-2 text-xs uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                      obrigatória
                    </span>
                  ) : (
                    <span className="ml-2 text-xs uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                      opcional
                    </span>
                  )}
                </p>
                <p className="text-[var(--color-ink-soft)]">{variable.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card-brutal-static bg-[var(--color-lavender)] p-4 text-sm leading-7">
          <p className="font-black uppercase tracking-[0.12em]">Roleta da live</p>
          <p className="mt-2 text-[var(--color-ink-soft)]">
            O giro da roleta usa POST assinado em{" "}
            <code className="rounded border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-2 py-0.5 text-xs">
              /api/internal/streamerbot/wheel
            </code>
            . Ainda não há arquivo em{" "}
            <code className="rounded border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-2 py-0.5 text-xs">
              streamerbot/
            </code>
            ; siga{" "}
            <code className="rounded border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-2 py-0.5 text-xs">
              docs/twitch-wheel.md
            </code>{" "}
            para montar a action manualmente.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8">
        {groupedScripts.map((group) => (
          <section key={group.category} className="grid gap-4">
            <div>
              <h3
                className="text-xl font-bold uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {group.label}
              </h3>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{group.description}</p>
            </div>
            <div className="grid gap-4">
              {group.scripts.map((script) => (
                <StreamerbotScriptCard key={script.id} script={script} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
