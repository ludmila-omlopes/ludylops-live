import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clapperboard,
  Gamepad2,
  House,
  Link2,
  ListOrdered,
  Mic,
  Plus,
  Quote,
  ShoppingBag,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

import { PLATFORM_NAME } from "@/lib/creators/platform";
import type { ThemeMode } from "@/lib/theme";

import { ChatRanking } from "./chat-ranking";
import { hubFont, hubMono } from "./fonts";
import { HubHeaderActions } from "./hub-header-actions";
import styles from "./hub-home.module.css";
import { Reveal } from "./reveal";

import "@/app/estudio-theme.css";

const CREATE_PATH = "/criar-area";

// Example community used across the page (illustrative data, not a real channel).
const GAMES = [
  { title: "Hollow Knight: Silksong", by: "bia_joga", art: "linear-gradient(135deg, #2b3a55, #6d82b0)", votes: 24, queued: true },
  { title: "Stardew Valley", by: "rafa.ttv", art: "linear-gradient(135deg, #4a3a12, #b08a2e)", votes: 17, queued: false },
  { title: "Hades II", by: "leo.m", art: "linear-gradient(135deg, #123a30, #3f9c80)", votes: 9, queued: false },
  { title: "Celeste", by: "carol_s", art: "linear-gradient(135deg, #4a2418, #b0603f)", votes: 6, queued: false },
  { title: "Outer Wilds", by: "nina.gg", art: "linear-gradient(135deg, #2a2440, #6b5aa0)", votes: 4, queued: false },
];
const LEADERS = [
  { name: "leo.m", points: 1240, share: 100 },
  { name: "bia_joga", points: 980, share: 79 },
  { name: "carol_s", points: 875, share: 70 },
];
const FEATURES = [
  { icon: Gamepad2, title: "Indicação de jogos", detail: "fila de sugestões" },
  { icon: Clapperboard, title: "Vídeos para react", detail: "fila de vídeos" },
  { icon: Link2, title: "Links de afiliado", detail: "link identificado" },
  { icon: Trophy, title: "Pontos e ranking", detail: "ranking do chat" },
  { icon: Zap, title: "Streamer.bot e OBS", detail: "!pontos · !quote" },
];
const STEPS = [
  { title: "Crie sua comunidade", body: "Escolha o nome, o endereço, as cores e o template da página." },
  { title: "Escolha os recursos", body: "Links de afiliado, indicação de jogos, vídeos para react e o que mais a sua live pedir." },
  { title: "Divulgue o link", body: "Na bio, na descrição dos vídeos e no chat, sempre que perguntarem." },
];
const QUESTIONS = [
  { q: "Preciso saber programar?", a: "Não. Você escolhe o nome, o endereço, as cores e os recursos, e a comunidade fica pronta para divulgar." },
  { q: "Posso usar meus links de afiliado?", a: "Pode. Em cada produto você escolhe entre o link da loja e o seu link de afiliado. Quando é de afiliado, o seu público vê essa informação." },
  { q: "Meu público precisa criar conta?", a: "Para ver suas indicações, não. Para participar, como sugerir jogos e vídeos, basta entrar com a conta Google." },
  { q: "Como faço para entrar?", a: "O acesso está em beta fechado. Entre com a sua conta Google e solicite sua participação. Assim que o pedido for aprovado, você cria a sua comunidade." },
];
// Feature icons that drift around the headline: position, tilt and entrance delay.
const TILES = [
  { icon: Gamepad2, big: true, style: { left: "9%", top: 178, "--rot": "-9deg", "--d": "0.15s", "--fx": "-30px" } },
  { icon: Clapperboard, style: { left: "27%", top: 56, "--rot": "7deg", "--d": "0.25s", "--dy": "-6px" } },
  { icon: Trophy, accent: true, style: { right: "27%", top: 48, "--rot": "-6deg", "--d": "0.3s", "--dx": "-5px" } },
  { icon: ShoppingBag, big: true, style: { right: "9%", top: 186, "--rot": "8deg", "--d": "0.2s", "--fx": "30px", "--dx": "-4px" } },
  { icon: Zap, style: { left: "16%", top: 440, "--rot": "6deg", "--d": "0.4s", "--dy": "6px" } },
  { icon: Link2, style: { right: "16%", top: 448, "--rot": "-8deg", "--d": "0.45s", "--dy": "7px" } },
];

function Brand() {
  return (
    <Link href="/inicio" className={styles.brand}>
      <span className={styles.brandMark}>
        <Users aria-hidden="true" />
      </span>
      {PLATFORM_NAME}
    </Link>
  );
}

function CreateLink() {
  return (
    <Link href={CREATE_PATH} className={`${styles.btn} ${styles.btnPrimary}`}>
      Criar minha comunidade <ArrowRight className={styles.icon} aria-hidden="true" />
    </Link>
  );
}

function Stage({ host }: { host: string }) {
  return (
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.stageBar}>
        <span className={styles.dots}>
          <i />
          <i />
          <i />
        </span>
        <span className={styles.url}>
          {host}/c/<b>canal-da-mari</b>
        </span>
        <span />
      </div>
      <div className={styles.stageBody}>
        <div className={styles.stageSide}>
          <div className={styles.who}>
            <span className={styles.avatar}>M</span>
            <span>
              <b>Canal da Mari</b>
              <small>terças e sextas</small>
            </span>
          </div>
          <div className={styles.sideNav}>
            <span><House aria-hidden="true" />Início</span>
            <span className={styles.sideOn}><Gamepad2 aria-hidden="true" />Jogos<em>12</em></span>
            <span><Clapperboard aria-hidden="true" />Vídeos<em>8</em></span>
            <span><ShoppingBag aria-hidden="true" />Produtos<em>6</em></span>
            <span><Trophy aria-hidden="true" />Ranking</span>
            <span><Quote aria-hidden="true" />Frases</span>
          </div>
        </div>
        <div className={styles.stageMain}>
          <div className={styles.panelHead}>
            <b>Jogos sugeridos</b>
            <span className={styles.seg}>
              <span className={styles.segOn}>Mais votados</span>
              <span>Novos</span>
            </span>
          </div>
          <div className={styles.card}>
            {GAMES.map((game) => (
              <div key={game.title} className={styles.row}>
                <span className={styles.thumb} style={{ background: game.art }}>
                  <Gamepad2 />
                </span>
                <span className={styles.grow}>
                  <b>{game.title}</b>
                  <span className={styles.meta}>por {game.by}</span>
                </span>
                <span className={styles.votes}>
                  <ThumbsUp />
                  {game.votes}
                </span>
                <span className={`${styles.chip} ${game.queued ? styles.chipOn : ""}`}>{game.queued ? "Na fila" : "Nova"}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.stageRight}>
          <div>
            <div className={styles.panelHead}>
              <b>Ranking do chat</b>
              <span className={styles.meta}>esta semana</span>
            </div>
            <div className={styles.card}>
              {LEADERS.map((leader, i) => (
                <div key={leader.name} className={styles.row}>
                  <span className={`${styles.rankN} ${i === 0 ? styles.rankFirst : ""}`}>0{i + 1}</span>
                  <span className={styles.grow}>
                    <b>{leader.name}</b>
                    <span className={`${styles.bar} ${i === 0 ? "" : styles.barDim}`}>
                      <i style={{ width: `${leader.share}%` }} />
                    </span>
                  </span>
                  <span className={styles.votes}>{leader.points.toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className={styles.panelHead}>
              <b>Em destaque</b>
            </div>
            <div className={styles.card}>
              <div className={styles.row}>
                <span className={`${styles.thumb} ${styles.thumbPlain}`}>
                  <Mic />
                </span>
                <span className={styles.grow}>
                  <b>Microfone USB</b>
                  <span className={styles.meta}>Amazon</span>
                </span>
                <span className={styles.chip}>Afiliado</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Checklist({ items, className }: { items: string[]; className: string }) {
  return (
    <ul className={className}>
      {items.map((item) => (
        <li key={item}>
          <Check aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function HubHome({ host, initialTheme }: { host: string; initialTheme: ThemeMode | null }) {
  return (
    <div className={`hub-scope ${styles.root} ${hubFont.variable} ${hubMono.variable}`}>
      <header className={styles.nav}>
        <div className={`${styles.wrap} ${styles.navInner}`}>
          <Brand />
          <nav className={styles.navLinks} aria-label="Principal">
            <a href="#recursos">Recursos</a>
            <a href="#pontos">Pontos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#perguntas">Perguntas</a>
          </nav>
          <HubHeaderActions initialTheme={initialTheme} createHref={CREATE_PATH} />
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.grid} aria-hidden="true" />
          <div className={styles.floats} aria-hidden="true">
            {TILES.map(({ icon: Icon, big, accent, style }, i) => (
              <span
                key={i}
                className={`${styles.tile}${big ? ` ${styles.tileBig}` : ""}${accent ? ` ${styles.tileAccent}` : ""}`}
                style={style as React.CSSProperties}
              >
                <Icon />
              </span>
            ))}
          </div>
          <div className={styles.wrap}>
            <h1 className={styles.heroTitle}>Um ponto de encontro para a sua comunidade.</h1>
            <p className={styles.lede}>
              Indicações de jogos, vídeos para react e links de afiliado num só lugar, com a cara do seu canal.
            </p>
            <div className={styles.heroActions}>
              <CreateLink />
              <a href="#recursos" className={`${styles.btn} ${styles.btnGhost}`}>
                Ver os recursos
              </a>
            </div>
            <p className={styles.heroNote}>Beta fechado: entre com o Google e peça acesso.</p>
          </div>
          <div className={styles.wrap}>
            <Stage host={host} />
          </div>
        </section>

        <section className={styles.sec} id="recursos" aria-labelledby="recursos-titulo">
          <div className={styles.wrap}>
            <h2 id="recursos-titulo" className={styles.h2}>
              Tudo o que a sua comunidade pede, num lugar só.
            </h2>
            <p className={styles.sub}>Comece pelos links de afiliado e ligue o resto quando a sua live pedir.</p>
            <Reveal className={styles.strip}>
              {FEATURES.map(({ icon: Icon, title, detail }) => (
                <div key={title}>
                  <Icon aria-hidden="true" />
                  <span>
                    <b>{title}</b>
                    <span className={styles.meta}>{detail}</span>
                  </span>
                </div>
              ))}
            </Reveal>
            <Checklist
              className={styles.checks}
              items={[
                "Seu público vê suas indicações sem criar conta.",
                "Link de afiliado sempre identificado.",
                "Três templates com as cores do seu canal.",
              ]}
            />
          </div>
        </section>

        <section className={styles.sec} aria-labelledby="jogos-titulo">
          <div className={`${styles.wrap} ${styles.split}`}>
            <Reveal className={styles.stack}>
              <div className={styles.card} aria-hidden="true">
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>
                    <Gamepad2 />
                    Sugestão de bia_joga
                  </span>
                  <span className={`${styles.chip} ${styles.chipOn}`}>24 votos</span>
                </div>
                <div className={styles.row}>
                  <span className={styles.thumb} style={{ background: GAMES[0].art }}>
                    <Gamepad2 />
                  </span>
                  <span className={styles.grow}>
                    <b>{GAMES[0].title}</b>
                    <span className={styles.meta}>metroidvania · 1 a 2 lives</span>
                  </span>
                </div>
                <div className={`${styles.row} ${styles.actionsRow}`}>
                  <span className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>Recusar</span>
                  <span className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>Colocar na fila</span>
                </div>
              </div>
              <span className={styles.connector} aria-hidden="true" />
              <span className={styles.pill} aria-hidden="true">
                <ListOrdered />
                Próximo jogo da live <span className={styles.kbd}>1º da fila</span>
              </span>
            </Reveal>
            <div>
              <h2 id="jogos-titulo" className={styles.h2}>
                O chat sugere. Você escolhe o próximo jogo.
              </h2>
              <p className={styles.sub}>Seu público sugere e vota. Você decide o que entra na fila da live.</p>
              <Checklist
                className={styles.list}
                items={["Votos do público em cada sugestão", "Fila visível para toda a comunidade", "Nada entra sem a sua aprovação"]}
              />
            </div>
          </div>
        </section>

        <section className={styles.sec} id="pontos" aria-labelledby="pontos-titulo">
          <div className={`${styles.wrap} ${styles.split} ${styles.splitRev}`}>
            <ChatRanking />
            <div>
              <h2 id="pontos-titulo" className={styles.h2}>
                Quem participa do chat sobe no ranking.
              </h2>
              <p className={styles.sub}>
                Com o Streamer.bot, cada mensagem no chat da live rende pontos, e o ranking se atualiza sozinho.
              </p>
              <Checklist
                className={styles.list}
                items={["Pontos por participação no chat", "Comandos !pontos e !quote no chat", "Resgates e overlays no OBS"]}
              />
            </div>
          </div>
        </section>

        <section className={styles.sec} aria-labelledby="produtos-titulo">
          <div className={`${styles.wrap} ${styles.split}`}>
            <Reveal>
              <div className={`${styles.card} ${styles.prod}`} aria-hidden="true">
                <span className={styles.prodPhoto}>
                  <Mic />
                </span>
                <div>
                  <b>Microfone USB</b>
                  <span className={styles.meta}>Setup · Amazon</span>
                  <q>Uso em todas as gravações. O som mudou da água para o vinho.</q>
                  <div className={styles.prodFoot}>
                    <span className={`${styles.chip} ${styles.chipOn}`}>
                      <Link2 />
                      Link afiliado
                    </span>
                    <span className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>Ver produto</span>
                  </div>
                </div>
              </div>
            </Reveal>
            <div>
              <h2 id="produtos-titulo" className={styles.h2}>
                Os produtos que você usa, com o seu link.
              </h2>
              <p className={styles.sub}>
                Cada indicação leva o motivo da escolha. Quando o link é de afiliado, o seu público fica sabendo.
              </p>
              <Checklist
                className={styles.list}
                items={["Imagem buscada pelo link do produto", "Link da loja ou de afiliado", "Fica em rascunho até você publicar"]}
              />
            </div>
          </div>
        </section>

        <section className={styles.sec} id="como-funciona" aria-labelledby="passos-titulo">
          <div className={styles.wrap}>
            <h2 id="passos-titulo" className={styles.h2}>
              Sua comunidade no ar em três passos.
            </h2>
            <ol className={styles.steps}>
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <span className={styles.stepN} aria-hidden="true">
                    0{i + 1}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
            <div className={styles.stepsFoot}>
              <CreateLink />
            </div>
          </div>
        </section>

        <section className={styles.sec} id="perguntas" aria-labelledby="perguntas-titulo">
          <div className={`${styles.wrap} ${styles.faqWrap}`}>
            <h2 id="perguntas-titulo" className={styles.h2}>
              Perguntas frequentes
            </h2>
            <div className={styles.faq}>
              {QUESTIONS.map((item, i) => (
                <details key={item.q} open={i === 0}>
                  <summary>
                    {item.q}
                    <Plus aria-hidden="true" />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.final} id="comecar" aria-labelledby="final-titulo">
          <div className={styles.grid} aria-hidden="true" />
          <div className={styles.wrap}>
            <h2 id="final-titulo" className={styles.finalTitle}>
              Sua comunidade merece um endereço próprio.
            </h2>
            <p className={styles.sub}>O acesso está em beta fechado. Solicite sua participação com a sua conta Google.</p>
            <div className={styles.finalActions}>
              <CreateLink />
              <a href="#recursos" className={`${styles.btn} ${styles.btnGhost}`}>
                Ver os recursos
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerInner}`}>
          <Brand />
          <span>Beta fechado</span>
          <nav aria-label="Rodapé">
            <Link href="/terms">Termos</Link>
            <Link href="/privacy">Privacidade</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
