import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  Gamepad2,
  Headphones,
  Keyboard,
  Link2,
  Mic,
  Play,
  Plus,
  ShoppingBag,
  Star,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { PLATFORM_NAME } from "@/lib/creators/platform";
import type { ThemeMode } from "@/lib/theme";

import { ChatRanking } from "./chat-ranking";
import { hubFont, hubMono } from "./fonts";
import { CountUp, FeaturePan, PlayIn, StampIn } from "./feature-pan";
import { HubHeaderActions } from "./hub-header-actions";
import styles from "./hub-home.module.css";
import { IdentityScroll } from "./identity-scroll";
import { Magnetic } from "./magnetic";
import { Reveal } from "./reveal";
import { StageTilt } from "./stage-tilt";

const CREATE_PATH = "/criar-area";
const TITLE_WORDS = ["Um", "ponto", "de", "encontro", "para", "a", "sua"];

// Example community used across the page (illustrative data, not a real channel).
const GAMES = [
  { title: "Hollow Knight: Silksong", by: "bia_joga", color: "#bfd0ff", status: "Na fila", supporters: 24 },
  { title: "Stardew Valley", by: "rafa.ttv", color: "#ffd35c", status: "Nova", supporters: 17 },
  { title: "Hades II", by: "leo.m", color: "#9fe3c9", status: "Nova", supporters: 9 },
  { title: "Celeste", by: "carol_s", color: "#ffb38a", status: "Nova", supporters: 6 },
];
const VIDEOS = [
  { title: "Trailer do novo jogo da série", short: "Trailer da série", by: "carol_s", status: "Próximo", art: "linear-gradient(135deg, #2b2340, #ff7ac6)" },
  { title: "Speedrun comentada em 12 minutos", short: "Speedrun comentada", by: "leo.m", status: "Nova", art: "linear-gradient(135deg, #10263a, #3fd0b8)" },
  { title: "Tier list dos chefes mais difíceis", short: "Tier list dos chefes", by: "bia_joga", status: "Nova", art: "linear-gradient(135deg, #2a1d0a, #ffb547)" },
  { title: "Review do setup de um fã", short: "Review do setup", by: "rafa.ttv", status: "Nova", art: "linear-gradient(135deg, #1b1f3a, #6f8dff)" },
];
const PRODUCTS: { name: string; store: string; link: string; color: string; icon: LucideIcon }[] = [
  { name: "Microfone USB", store: "Amazon", link: "Afiliado", color: "#3fd0b8", icon: Mic },
  { name: "Teclado mecânico", store: "Loja oficial", link: "Loja", color: "#ffd35c", icon: Keyboard },
  { name: "Headset sem fio", store: "Amazon", link: "Afiliado", color: "#9fb4ff", icon: Headphones },
];
const LEADERS = [
  { name: "leo.m", place: "1º lugar", points: 1240 },
  { name: "bia_joga", place: "2º lugar", points: 980 },
  { name: "carol_s", place: "3º lugar", points: 875 },
];
const STEPS = [
  { title: "Crie sua comunidade", body: "Escolha o nome, o endereço e as cores do seu canal." },
  { title: "Escolha os recursos", body: "Links de afiliado, indicação de jogos, vídeos para react e o que mais a sua live pedir." },
  { title: "Divulgue o link", body: "Na bio, na descrição dos vídeos e no chat, sempre que perguntarem." },
];
const QUESTIONS = [
  { q: "Preciso saber programar?", a: "Não. Você escolhe o nome, o endereço, as cores e os recursos, e a comunidade fica pronta para divulgar." },
  { q: "Posso usar meus links de afiliado?", a: "Pode. Em cada produto você escolhe entre o link da loja e o seu link de afiliado. Quando é de afiliado, o seu público vê essa informação." },
  { q: "Meu público precisa criar conta?", a: "Para ver suas indicações, não. Para participar, como sugerir jogos e vídeos, basta entrar com a conta Google." },
  { q: "Como faço para entrar?", a: "O acesso está em beta fechado. Entre com a sua conta Google e solicite sua participação. Assim que o pedido for aprovado, você cria a sua comunidade." },
];

function CreateButton({ className = "" }: { className?: string }) {
  return (
    <Magnetic className={className}>
      <Link href={CREATE_PATH} className={`${styles.btn} ${styles.btnPrimary}`}>
        Criar minha comunidade <ArrowRight className={styles.icon} aria-hidden="true" />
      </Link>
    </Magnetic>
  );
}

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

export function HubHome({ host, initialTheme }: { host: string; initialTheme: ThemeMode | null }) {
  const glass = styles.glass;

  return (
    <div className={`${styles.root} ${hubFont.variable} ${hubMono.variable}`}>
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
          <div className={styles.wrap}>
            <h1 className={styles.heroTitle}>
              {TITLE_WORDS.map((word, i) => (
                <span key={word}>
                  <span className={styles.word} style={{ "--i": i } as React.CSSProperties}>
                    {word}
                  </span>{" "}
                </span>
              ))}
              <span className={styles.word} style={{ "--i": TITLE_WORDS.length } as React.CSSProperties}>
                <span className={styles.hl}>comunidade</span>.
              </span>
            </h1>
            <p className={`${styles.lede} ${styles.fadeUp}`} style={{ "--d": "0.45s" } as React.CSSProperties}>
              Indicações de jogos, vídeos para react e links de afiliado num só lugar, com a cara do seu canal.
            </p>
            <div className={`${styles.actions} ${styles.fadeUp}`} style={{ "--d": "0.6s" } as React.CSSProperties}>
              <CreateButton />
              <a href="#recursos" className={`${styles.btn} ${styles.btnGhost}`}>
                Ver os recursos
              </a>
            </div>
          </div>

          <StageTilt className={`${glass} ${styles.stageInner}`}>
            <div className={styles.bar}>
              <span className={styles.dots}>
                <i />
                <i />
                <i />
              </span>
              <span className={`${styles.url} ${styles.well}`}>{host}/c/canal-da-mari</span>
              <span style={{ width: 46 }} />
            </div>
            <div className={styles.cover} />
            <div className={styles.profile}>
              <span className={styles.avatar}>M</span>
              <span>
                <b>Canal da Mari</b>
                <small>Lives de terça e sexta</small>
              </span>
            </div>
            <div className={styles.ptabs}>
              <span className={styles.ptabOn}>Início</span>
              <span>Jogos</span>
              <span>Vídeos</span>
              <span>Produtos</span>
              <span>Ranking</span>
            </div>
            <div className={styles.pgrid}>
              <div className={`${styles.box} ${styles.well}`}>
                <p className={styles.boxTitle}>
                  <Gamepad2 aria-hidden="true" />
                  Jogos sugeridos
                </p>
                {GAMES.slice(0, 3).map((game, i) => (
                  <div key={game.title} className={styles.li}>
                    <span className={styles.liThumb} style={{ background: game.color }}>
                      <Gamepad2 aria-hidden="true" />
                    </span>
                    <span>
                      <b>{game.title}</b>
                      <small>por {game.by}</small>
                    </span>
                    <span className={`${styles.chip} ${i === 0 ? styles.chipOn : ""}`}>{game.status}</span>
                  </div>
                ))}
              </div>
              <div className={`${styles.box} ${styles.well}`}>
                <p className={styles.boxTitle}>
                  <Clapperboard aria-hidden="true" />
                  Vídeos para react
                </p>
                {VIDEOS.slice(0, 3).map((video, i) => (
                  <div key={video.title} className={styles.li}>
                    <span className={styles.liThumb} style={{ background: video.art, color: "#fff" }}>
                      <Play aria-hidden="true" />
                    </span>
                    <span>
                      <b>{video.short}</b>
                      <small>por {video.by}</small>
                    </span>
                    <span className={`${styles.chip} ${i === 0 ? styles.chipOn : ""}`}>{video.status}</span>
                  </div>
                ))}
              </div>
              <div className={`${styles.box} ${styles.well}`}>
                <p className={styles.boxTitle}>
                  <ShoppingBag aria-hidden="true" />
                  Meus produtos
                </p>
                {PRODUCTS.map((product) => {
                  const Icon = product.icon;
                  return (
                    <div key={product.name} className={styles.li}>
                      <span className={styles.liThumb} style={{ background: product.color }}>
                        <Icon aria-hidden="true" />
                      </span>
                      <span>
                        <b>{product.name}</b>
                        <small>{product.store}</small>
                      </span>
                      <span className={styles.chip}>{product.link}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </StageTilt>
        </section>

        <FeaturePan
          heading={
            <h2 id="recursos-titulo" className={styles.blockTitle}>
              Tudo o que a sua comunidade pede, num lugar só.
            </h2>
          }
          labels={["Jogos", "Vídeos", "Links", "Pontos", "Streamer.bot"]}
        >
          <article className={`${glass} ${styles.fp}`}>
            <div>
              <span className={styles.fpIcon}><Gamepad2 aria-hidden="true" /></span>
              <h3>Indicação de jogos</h3>
              <p>Seu público sugere o próximo jogo da live e você decide o que entra na fila.</p>
            </div>
            <PlayIn className={`${styles.fpVis} ${styles.well}`}>
              {GAMES.map((game) => (
                <div key={game.title} className={styles.li} aria-hidden="true">
                  <span className={styles.liThumb} style={{ background: game.color }}>
                    <Gamepad2 aria-hidden="true" />
                  </span>
                  <span>
                    <b>{game.title}</b>
                    <small>por {game.by}</small>
                  </span>
                  <span className={styles.count}>
                    <ThumbsUp aria-hidden="true" />
                    <CountUp to={game.supporters} />
                  </span>
                </div>
              ))}
            </PlayIn>
          </article>

          <article className={`${glass} ${styles.fp}`}>
            <div>
              <span className={styles.fpIcon}><Clapperboard aria-hidden="true" /></span>
              <h3>Vídeos para react</h3>
              <p>As sugestões de vídeo chegam numa fila só. Você assiste na ordem que quiser e nada se perde no chat.</p>
            </div>
            <PlayIn className={`${styles.fpVis} ${styles.well} ${styles.thumbs}`} from="below">
              {VIDEOS.map((video) => (
                <div key={video.title} className={styles.thumb} aria-hidden="true">
                  <div className={styles.thumbImg} style={{ background: video.art }}>
                    <Play aria-hidden="true" />
                  </div>
                  <b>{video.title}</b>
                </div>
              ))}
            </PlayIn>
          </article>

          <article className={`${glass} ${styles.fp}`}>
            <div>
              <span className={styles.fpIcon}><Link2 aria-hidden="true" /></span>
              <h3>Lista de links de afiliado</h3>
              <p>Os produtos que você usa, com o seu link e o motivo de cada indicação. Quando o link é de afiliado, o seu público fica sabendo.</p>
            </div>
            <div className={`${styles.fpVis} ${styles.well}`} aria-hidden="true">
              <div className={styles.prod}>
                <span className={styles.prodPhoto}><Mic aria-hidden="true" /></span>
                <div>
                  <b>Microfone USB</b>
                  <q>Uso em todas as gravações. O som mudou da água para o vinho.</q>
                  <StampIn className={styles.stamp}>
                    <Link2 aria-hidden="true" />
                    Link afiliado
                  </StampIn>
                </div>
              </div>
            </div>
          </article>

          <article className={`${glass} ${styles.fp}`}>
            <div>
              <span className={styles.fpIcon}><Trophy aria-hidden="true" /></span>
              <h3>Pontos e ranking</h3>
              <p>Quem participa ganha pontos e aparece no ranking do canal.</p>
            </div>
            <PlayIn className={`${styles.fpVis} ${styles.well}`}>
              {LEADERS.map((leader, i) => (
                <div key={leader.name} className={styles.li} aria-hidden="true">
                  <span className={styles.liThumb} style={{ background: i === 0 ? "var(--accent)" : "var(--surface-2)", color: "var(--ink)" }}>
                    {i === 0 ? <Trophy aria-hidden="true" /> : <Star aria-hidden="true" />}
                  </span>
                  <span>
                    <b>{leader.name}</b>
                    <small>{leader.place}</small>
                  </span>
                  <span className={styles.count}>
                    <CountUp to={leader.points} />
                    &nbsp;pts
                  </span>
                </div>
              ))}
            </PlayIn>
          </article>

          <article className={`${glass} ${styles.fp}`}>
            <div>
              <span className={styles.fpIcon}><Zap aria-hidden="true" /></span>
              <h3>Streamer.bot e OBS</h3>
              <p>Pontos, resgates e overlays funcionando sozinhos durante a live. Frases marcantes guardadas para a comunidade relembrar.</p>
            </div>
            <PlayIn className={`${styles.fpVis} ${styles.well} ${styles.cmd}`} from="below">
              <p aria-hidden="true"><span className={styles.cmdUser}>bia_joga:</span> !pontos</p>
              <p aria-hidden="true" className={styles.cmdBot}>Canal da Mari: bia_joga tem 980 pontos.</p>
              <p aria-hidden="true"><span className={styles.cmdUser}>leo.m:</span> !quote</p>
              <p aria-hidden="true" className={styles.cmdBot}>Canal da Mari: “Esse chefe não passa de hoje.”</p>
            </PlayIn>
          </article>
        </FeaturePan>

        <section className={styles.block} id="pontos" aria-labelledby="pontos-titulo">
          <div className={styles.wrap}>
            <h2 id="pontos-titulo" className={styles.blockTitle}>
              Quem participa do chat sobe no ranking.
            </h2>
            <p className={styles.sub}>
              Com o Streamer.bot, cada mensagem no chat da live rende pontos na comunidade, e o ranking se atualiza sozinho.
            </p>
            <ChatRanking />
          </div>
        </section>

        <IdentityScroll />

        <section className={styles.block} id="como-funciona" aria-labelledby="passos-titulo">
          <div className={`${styles.wrap} ${styles.how}`}>
            <div>
              <h2 id="passos-titulo" className={styles.blockTitle}>
                Sua comunidade no ar em três passos.
              </h2>
              <CreateButton className={styles.howCta} />
            </div>
            <ol className={styles.howList}>
              {STEPS.map((step, i) => (
                <Reveal key={step.title} as="li" className={`${glass} ${styles.howItem}`} delay={i * 0.08}>
                  <span className={styles.howNum} aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.block} id="perguntas" aria-labelledby="perguntas-titulo" style={{ paddingTop: 0 }}>
          <div className={styles.wrap}>
            <h2 id="perguntas-titulo" className={styles.blockTitle}>
              Perguntas frequentes
            </h2>
            <div className={styles.faq}>
              {QUESTIONS.map((item, i) => (
                <Reveal key={item.q} className={`${glass} ${styles.faqItem}`} delay={i * 0.06}>
                  <details>
                    <summary>
                      {item.q}
                      <Plus aria-hidden="true" />
                    </summary>
                    <p>{item.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.final} id="comecar" aria-labelledby="final-titulo">
          <div className={styles.wrap}>
            <h2 id="final-titulo" className={styles.finalTitle}>
              Sua comunidade merece um endereço próprio.
            </h2>
            <p>O acesso está em beta fechado. Solicite sua participação com a sua conta Google.</p>
            <CreateButton className={styles.finalAction} />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerInner}`}>
          <div>
            <Brand />
            <p>Um ponto de encontro para a sua comunidade.</p>
          </div>
          <div>
            <h3>Recursos</h3>
            <ul>
              <li>Indicação de jogos</li>
              <li>Vídeos para react</li>
              <li>Links de afiliado</li>
              <li>Pontos e ranking</li>
            </ul>
          </div>
          <div>
            <h3>Comece</h3>
            <ul>
              <li><a href="#como-funciona">Como funciona</a></li>
              <li><a href="#perguntas">Perguntas frequentes</a></li>
              <li><Link href={CREATE_PATH}>Criar minha comunidade</Link></li>
            </ul>
          </div>
          <div>
            <h3>Legal</h3>
            <ul>
              <li><Link href="/privacy">Privacidade</Link></li>
              <li><Link href="/terms">Termos</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
