import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Serviço | Pipetz",
  description:
    "Regras básicas de uso do Pipetz, incluindo apostas, resgates, indicações, conteúdos externos e disponibilidade da plataforma.",
};

const LAST_UPDATED = "2026-05-20";
const SUPPORT_EMAIL = "ludmila.omlopes@gmail.com";

type TermsSection = {
  title: string;
  body: string[];
};

const sections: TermsSection[] = [
  {
    title: "Resumo",
    body: [
      "O Pipetz é um site de apoio à comunidade da live da Ludylops. Ele reúne ranking, apostas, resgates, indicações, sugestões e integrações usadas durante as transmissões.",
      "Ao usar o site, você concorda em participar de forma respeitosa, seguir as regras da comunidade e entender que recursos da live podem mudar, pausar ou ficar indisponíveis.",
    ],
  },
  {
    title: "Uso aceitável",
    body: [
      "Você não deve usar o site para assediar pessoas, publicar conteúdo ilegal, tentar burlar regras de pontuação, explorar falhas técnicas ou prejudicar a experiência de outros viewers.",
      "A Ludylops pode moderar, remover, cancelar ou ajustar interações quando houver abuso, erro técnico, tentativa de fraude ou necessidade de manter a live funcionando bem.",
    ],
  },
  {
    title: "Pipetz, apostas e resgates",
    body: [
      "Pipetz são pontos de comunidade usados dentro da experiência da live. Eles não representam dinheiro, crédito financeiro, prêmio garantido ou direito de saque.",
      "Apostas, resgates e efeitos dependem das regras exibidas no site, do estado da live e das integrações disponíveis no momento. Em caso de erro, a equipe pode cancelar, reembolsar pontos ou corrigir saldos.",
    ],
  },
  {
    title: "Conteúdos, indicações e links externos",
    body: [
      "Sugestões de jogos, vídeos, canais, produtos e demais indicações podem incluir conteúdo de terceiros. Esses conteúdos seguem as regras e políticas dos serviços externos onde são publicados.",
      "Links externos podem direcionar para plataformas fora do controle do Pipetz. Antes de comprar, assistir, baixar ou interagir fora do site, confira as condições, privacidade e segurança do serviço de destino.",
    ],
  },
  {
    title: "Propriedade intelectual",
    body: [
      "Textos, identidade visual, organização da experiência e elementos próprios do Pipetz pertencem aos seus respectivos titulares.",
      "Ao enviar sugestões, mensagens ou conteúdos pela plataforma, você declara ter permissão para compartilhar esse material e autoriza seu uso no contexto da comunidade e da live.",
    ],
  },
  {
    title: "Disponibilidade e integrações",
    body: [
      "O site pode depender de serviços como Google, YouTube, banco de dados, hospedagem, OBS e Streamer.bot. Instabilidades nesses serviços podem afetar login, ranking, apostas, overlays e resgates.",
      "O Pipetz é oferecido no estado em que se encontra, sem garantia de disponibilidade contínua, ausência de erros ou compatibilidade permanente com todas as integrações.",
    ],
  },
  {
    title: "Alterações e contato",
    body: [
      "Estes termos podem ser atualizados para refletir novas funcionalidades, mudanças na operação da live ou ajustes legais e técnicos.",
      `Para dúvidas sobre estes termos, entre em contato pelo email de suporte: ${SUPPORT_EMAIL}.`,
      "Este texto não substitui revisão jurídica. Caso o site passe a lidar com pagamentos, dados sensíveis ou obrigações comerciais específicas, os termos devem ser revisados com orientação adequada.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6 px-4 sm:px-6 lg:px-8">
      <section className="panel surface-hero p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1
              className="text-4xl uppercase leading-[0.9] sm:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Termos de serviço
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--color-ink-soft)]">
              Regras básicas para usar o Pipetz e participar das experiências da live.
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
          <h2
            className="text-3xl uppercase leading-none sm:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {section.title}
          </h2>
          <div
            className={`mt-5 space-y-4 text-sm font-medium leading-7 sm:text-base ${
              index % 3 === 0 ? "text-[var(--color-ink-soft)]" : "text-[var(--color-accent-ink-soft)]"
            }`}
          >
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
          <Link
            href="/privacy"
            className="btn-brutal bg-[var(--color-mint)] px-5 py-3 text-xs text-[var(--color-accent-ink)]"
          >
            Política de privacidade
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
