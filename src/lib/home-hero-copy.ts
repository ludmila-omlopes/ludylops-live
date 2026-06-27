import type { AccountProtectionStatus } from "@/lib/auth/session-state";

type HomeHeroCopyInput = {
  accountProtectionStatus: AccountProtectionStatus | null;
  hasUsableSession: boolean;
  isLive: boolean;
};

type HomeHeroCopy = {
  title: string;
  description: string;
};

export function getHomeHeroCopy({
  accountProtectionStatus,
  hasUsableSession,
  isLive,
}: HomeHeroCopyInput): HomeHeroCopy {
  const title = hasUsableSession
    ? isLive
      ? "Estou online, vem pra live!"
      : "A live está offline agora."
    : isLive
      ? "A live já começou."
      : "Oi, eu sou a Ludylops. Eu jogo, o chat palpita.";

  if (accountProtectionStatus) {
    return {
      title,
      description:
        accountProtectionStatus === "google_signin_blocked"
          ? "Seu acesso com Google foi colocado em espera por segurança. Você ainda pode acompanhar a live enquanto revisa a conta."
          : "Sua sessão local foi encerrada por segurança. Quando você entrar de novo, os caminhos da live voltam para a sua conta.",
    };
  }

  if (hasUsableSession) {
    return {
      title,
      description: isLive
        ? "Entre nas apostas, acione resgates e leve suas sugestões para o que acontece ao vivo."
        : "Enquanto eu não abro a live, você pode conferir seu painel, sugerir jogos e deixar tudo pronto para a próxima transmissão.",
    };
  }

  return {
    title,
    description: isLive
      ? "Entre no YouTube para assistir, e faça login aqui pra participar dos palpites e usar seus pipetz com resgates de interação comigo."
      : "Faço lives e vídeos de jogos no YouTube, com campanhas longas, sugestões do chat e muito bate-papo! Aqui você acompanha o jogo atual, junta pipetz e participa do que acontece ao vivo.",
  };
}
