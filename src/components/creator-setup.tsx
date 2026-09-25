"use client";
import { ownerPanelClass, ownerPanelTitleClass } from "@/components/ui/owner-panel";
export const setupGuides = [
  ["Credenciais e teste de autenticação", "docs/streamerbot-credentials.md"],
  ["Vínculo do YouTube e moeda", "docs/creator-economy.md"],
  ["Action de ganhos por mensagem", "docs/creator-chat-rewards.md"],
  ["Bridge, actions e resgate de teste", "docs/creator-redemptions.md"],
] as const;
export function CreatorSetupGuides() {
  return <section className={`${ownerPanelClass} text-sm`}>
    <h2 className={ownerPanelTitleClass}>Instruções para configurar e testar</h2>
    <ul className="grid gap-2">{setupGuides.map(([label, path]) => <li key={path}><a className="font-bold underline" href={`https://github.com/ludmila-omlopes/ludylops-live/blob/master/${path}`} target="_blank" rel="noreferrer">{label}</a></li>)}</ul>
    <p>Presença, inscrições, apostas e sugestões ainda não estão disponíveis para novas comunidades. Ganhos por chat exigem a regra ativa e a action configurada.</p>
  </section>;
}
