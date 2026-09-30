"use client";

import { useRef, useState } from "react";
import { Gamepad2, Play, ShoppingBag } from "lucide-react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";

import styles from "./hub-home.module.css";
import { useMediaQuery } from "./use-media-query";

const CHANNELS = [
  { name: "Canal da Mari", initial: "M", color: "#ff7ac6", ink: "#2a0f1d", kind: "react e reviews" },
  { name: "Oficina do Léo", initial: "L", color: "#2fb57c", ink: "#06200f", kind: "faça você mesmo" },
  { name: "Bia Joga", initial: "B", color: "#6f8dff", ink: "#0b1640", kind: "lives de jogos" },
];

// While the section stays pinned, the same community changes channel, name and colors,
// showing that every creator keeps their own identity. Below 961px it stays on the first channel.
export function IdentityScroll() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const desktop = useMediaQuery("(min-width: 961px)");
  const pinned = desktop && !reduce;
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const stops = [0, 0.3, 0.42, 0.62, 0.74, 1];
  const color = useTransform(scrollYProgress, stops, [0, 0, 1, 1, 2, 2].map((i) => CHANNELS[i].color));
  const ink = useTransform(scrollYProgress, stops, [0, 0, 1, 1, 2, 2].map((i) => CHANNELS[i].ink));
  const visible = [
    useTransform(scrollYProgress, [0.3, 0.38], [1, 0]),
    useTransform(scrollYProgress, [0.34, 0.42, 0.62, 0.7], [0, 1, 1, 0]),
    useTransform(scrollYProgress, [0.66, 0.74], [0, 1]),
  ];

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (!pinned) return;
    const index = progress < 0.36 ? 0 : progress < 0.68 ? 1 : 2;
    setActive((current) => (current === index ? current : index));
  });

  const current = pinned ? active : 0;

  return (
    <section ref={ref} className={styles.identity} aria-labelledby="identidade-titulo" style={pinned ? { height: "260vh" } : undefined}>
      <div className={styles.identitySticky} style={pinned ? { position: "sticky", top: 0, height: "100dvh" } : undefined}>
        <div className={styles.identityInner}>
          <div>
            <h2 id="identidade-titulo" className={styles.blockTitle}>
              Com a cara de cada canal.
            </h2>
            <p className={styles.sub}>O mesmo ponto de encontro, com o nome, as cores e os recursos que combinam com cada criador.</p>
            <ul className={styles.whoList}>
              {CHANNELS.map((channel, i) => (
                <li key={channel.name} className={i === current ? styles.whoOn : undefined}>
                  <i className={styles.whoDot} style={{ background: channel.color }} aria-hidden="true" />
                  {channel.name}, {channel.kind}
                </li>
              ))}
            </ul>
          </div>
          <motion.div
            className={`${styles.glass} ${styles.idcard}`}
            style={pinned ? ({ "--c": color, "--ci": ink } as unknown as React.CSSProperties) : undefined}
            aria-hidden="true"
          >
            <div className={styles.band}>
              <div className={styles.stack}>
                {CHANNELS.map((channel, i) => (
                  <motion.span key={channel.name} className={styles.idAvatar} style={pinned ? { opacity: visible[i] } : { opacity: i === 0 ? 1 : 0 }}>
                    {channel.initial}
                  </motion.span>
                ))}
              </div>
              <div className={`${styles.stack} ${styles.idNames}`}>
                {CHANNELS.map((channel, i) => (
                  <motion.span key={channel.name} style={pinned ? { opacity: visible[i] } : { opacity: i === 0 ? 1 : 0 }}>
                    {channel.name}
                  </motion.span>
                ))}
              </div>
            </div>
            <div className={styles.idBody}>
              <div className={styles.li}>
                <span className={styles.liThumb}><Play /></span>
                <span><b>Vídeos para react</b><small>12 na fila</small></span>
                <span className={styles.chip}>Ativo</span>
              </div>
              <div className={styles.li}>
                <span className={styles.liThumb}><ShoppingBag /></span>
                <span><b>Links de afiliado</b><small>Setup completo</small></span>
                <span className={styles.chip}>Ativo</span>
              </div>
              <div className={styles.li}>
                <span className={styles.liThumb}><Gamepad2 /></span>
                <span><b>Indicação de jogos</b><small>Fila aberta</small></span>
                <span className={styles.chip}>Ativo</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
