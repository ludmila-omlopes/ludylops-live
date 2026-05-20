import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade | Pipetz",
  description:
    "Como o Pipetz coleta, usa e protege dados de login Google e dados vinculados ao canal do YouTube.",
};

const LAST_UPDATED = "2026-04-08";
const SUPPORT_EMAIL = "ludmila.omlopes@gmail.com";

type PolicySection = {
  title: string;
  body: string[];
};

const sections: PolicySection[] = [
  {
    title: "Resumo",
    body: [
      "O Pipetz é um painel da comunidade da live da Ludylops. Esta política explica quais dados podem ser coletados quando você usa o login Google, participa das funções da live e vincula sua conta ao seu canal do YouTube.",
      "Os dados são usados para autenticar você, associar sua conta ao viewer correto, mostrar saldo e ranking, registrar apostas, resgates e sugestões, e manter o funcionamento do app.",
    ],
  },
  {
    title: "Dados que podemos coletar",
    body: [
      "Dados básicos de login Google: nome, email, foto de perfil e identificador da conta Google.",
      "Quando você concede permissão de YouTube ao app: identificador do canal, nome exibido e handle do canal retornados pela API do Google.",
      "Dados de uso dentro do Pipetz: viewer vinculado, saldo, histórico de pontos, apostas, resgates, sugestões de jogos, canais associados e informações necessárias para diagnosticar problemas de vinculação.",
      "Dados técnicos de sessão e segurança, como cookies de autenticação e logs básicos necessários para manter o app funcionando e investigar falhas ou abuso.",
    ],
  },
  {
    title: "Como usamos esses dados",
    body: [
      "Para autenticar sua conta e manter sua sessão ativa no Pipetz.",
      "Para tentar vincular sua conta Google ao canal correto do YouTube e ao viewer correspondente no chat da live.",
      "Para operar as funcionalidades do app, incluindo painel do viewer, ranking, apostas, resgates, catálogo e sugestões.",
      "Para corrigir erros de vinculação, evitar duplicidade de viewers e prestar suporte quando você reporta um problema.",
    ],
  },
  {
    title: "Compartilhamento",
    body: [
      "Seus dados não são vendidos.",
      "Eles podem ser processados por provedores técnicos usados para operar o app, como Google para autenticação e consulta do canal do YouTube, e serviços de hospedagem, banco de dados e observabilidade usados pelo Pipetz.",
      "Se você clicar para abrir uma issue manualmente no GitHub, o conteúdo que você enviar seguirá também as regras de privacidade do GitHub.",
    ],
  },
  {
    title: "Retenção e segurança",
    body: [
      "Mantemos os dados pelo tempo necessário para operar o Pipetz, preservar o histórico das interações da live, resolver problemas de conta e cumprir obrigações técnicas ou legais.",
      "Buscamos limitar o acesso aos dados ao necessário para operar o app, mas nenhum sistema conectado à internet oferece garantia absoluta de segurança.",
    ],
  },
  {
    title: "Seus controles",
    body: [
      "Você pode parar de usar o login Google a qualquer momento e pode revogar o acesso do app nas configurações da sua Conta Google.",
      "Se quiser solicitar remoção de conta, desvinculação ou tirar dúvidas sobre estes dados, entre em contato pelo email de suporte informado abaixo.",
    ],
  },
  {
    title: "Contato",
    body: [
      `Email de suporte: ${SUPPORT_EMAIL}`,
      "Se esta política mudar de forma relevante, a versão publicada nesta página será atualizada.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6 px-4 sm:px-6 lg:px-8">
      <section className="panel surface-hero p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="retro-label accent-chip">documento público</span>
            <h1
              className="mt-4 text-4xl uppercase leading-[0.9] sm:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Política de privacidade
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--color-ink-soft)]">
              Esta página explica como o Pipetz acessa, usa e protege dados de autenticação Google
              e de vinculação com canal do YouTube.
            </p>
          </div>

          <div className="card-poster bg-[var(--color-paper)] p-4">
            <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
              última atualização
            </p>
            <p className="mt-2 text-lg font-black uppercase">{LAST_UPDATED}</p>
          </div>
        </div>
      </section>

      {sections.map((section, index) => (
        <section
          key={section.title}
          className={`panel p-6 sm:p-8 ${
            index % 3 === 0
              ? "bg-[var(--color-paper)]"
              : index % 3 === 1
                ? "bg-[var(--color-blue)] text-[var(--color-accent-ink)]"
                : "bg-[var(--color-mint)] text-[var(--color-accent-ink)]"
          }`}
        >
          <p className={`mono text-[11px] uppercase tracking-[0.24em] ${ index % 3 === 0 ? "text-[var(--color-ink-soft)]" : "text-[var(--color-accent-ink-soft)]" }`}>
            seção {String(index + 1).padStart(2, "0")}
          </p>
          <h2
            className="mt-3 text-3xl uppercase leading-none sm:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {section.title}
          </h2>
          <div className={`mt-5 space-y-4 text-sm font-medium leading-7 sm:text-base ${ index % 3 === 0 ? "text-[var(--color-ink-soft)]" : "text-[var(--color-accent-ink-soft)]" }`}>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}

      <section className="panel bg-[var(--color-pink)] p-6 sm:p-8">
        <p className="mono text-[11px] uppercase tracking-[0.24em] text-[var(--color-accent-ink)]">
          links úteis
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/" className="btn-brutal bg-[var(--color-paper)] px-5 py-3 text-xs text-[var(--color-ink)]">
            Voltar para a home
          </Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="btn-brutal bg-[var(--color-accent-yellow)] px-5 py-3 text-xs text-[var(--color-accent-ink)]"
          >
            Falar por email
          </a>
        </div>
      </section>
    </div>
  );
}

