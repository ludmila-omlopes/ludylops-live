"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Trophy } from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";

import styles from "./hub-home.module.css";

type Person = { name: string; points: number };
type Message = { id: string; name: string; text: string; fresh: boolean };
type Token = { id: string; name: string; from: { x: number; y: number }; to: { x: number; y: number } };

const REWARD = 45;
const PEOPLE: Person[] = [
  { name: "leo.m", points: 1240 },
  { name: "bia_joga", points: 1185 },
  { name: "carol_s", points: 1160 },
  { name: "rafa.ttv", points: 1120 },
];
const LINES = [
  "Esse chefe não passa de hoje",
  "Bora, Mari!",
  "Qual é esse microfone?",
  "Sugeri Hades II na comunidade",
  "Primeira vez aqui, adorei",
  "Mais uma tentativa!",
  "Tá tudo na página do canal",
  "Que jogada",
];
const FIRST_MESSAGES: Message[] = [
  { id: "m-a", name: "bia_joga", text: "Bora, Mari!", fresh: false },
  { id: "m-b", name: "carol_s", text: "Que jogada", fresh: false },
  { id: "m-c", name: "rafa.ttv", text: "Mais uma tentativa!", fresh: false },
];

// Each chat message drops points that fly to the viewer in the ranking, which reorders itself.
// Runs only while visible; with reduced motion it stays as a still example.
export function ChatRanking() {
  const reduce = useReducedMotion();
  const flowRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const tick = useRef(0);
  const inView = useInView(flowRef, { amount: 0.35 });
  const [people, setPeople] = useState(PEOPLE);
  const [messages, setMessages] = useState(FIRST_MESSAGES);
  const [tokens, setTokens] = useState<Token[]>([]);

  useEffect(() => {
    if (reduce || !inView) return;
    const timer = window.setInterval(() => {
      const i = tick.current++;
      const name = PEOPLE[(i * 3 + 1) % PEOPLE.length].name;
      setMessages((current) => [...current, { id: `m-${i}`, name, text: LINES[i % LINES.length], fresh: true }].slice(-7));

      const flow = flowRef.current?.getBoundingClientRect();
      const chat = chatRef.current?.getBoundingClientRect();
      const row = rows.current.get(name)?.getBoundingClientRect();
      if (!flow || !chat || !row) return;
      setTokens((current) => [
        ...current,
        {
          id: `t-${i}`,
          name,
          from: { x: chat.left - flow.left + 20, y: chat.bottom - flow.top - 40 },
          to: { x: row.right - flow.left - 110, y: row.top - flow.top + row.height / 2 - 14 },
        },
      ]);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [reduce, inView]);

  function land(token: Token) {
    setTokens((current) => current.filter((item) => item.id !== token.id));
    setPeople((current) => current.map((person) => (person.name === token.name ? { ...person, points: person.points + REWARD } : person)));
  }

  const ranking = [...people].sort((a, b) => b.points - a.points);

  return (
    <div ref={flowRef} className={styles.flow} aria-hidden="true">
      <div className={`${styles.card} ${styles.pane}`}>
        <div className={styles.paneHead}>
          <span>Chat da live</span>
          <MessageCircle />
        </div>
        <div ref={chatRef} className={styles.chat}>
          {messages.map((message) => (
            <motion.p
              key={message.id}
              layout={!reduce}
              className={styles.msg}
              initial={message.fresh && !reduce ? { opacity: 0, y: 12 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <b>{message.name}</b>
              {message.text}
            </motion.p>
          ))}
        </div>
      </div>
      <div className={`${styles.card} ${styles.pane}`}>
        <div className={styles.paneHead}>
          <span>Ranking do canal</span>
          <Trophy />
        </div>
        <div className={styles.ranking}>
          {ranking.map((person, index) => (
            <motion.div
              key={person.name}
              layout={!reduce}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className={styles.rk}
              ref={(node) => {
                if (node) rows.current.set(person.name, node);
                else rows.current.delete(person.name);
              }}
            >
              <span className={`${styles.rkPos} ${index === 0 ? styles.rkFirst : ""}`}>{index + 1}</span>
              <b>{person.name}</b>
              <span className={styles.rkPts}>{person.points.toLocaleString("pt-BR")} pts</span>
            </motion.div>
          ))}
        </div>
      </div>
      {tokens.map((token) => (
        <motion.span
          key={token.id}
          className={styles.token}
          initial={{ x: token.from.x, y: token.from.y, opacity: 0, scale: 0.8 }}
          animate={{ x: token.to.x, y: token.to.y, opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
          onAnimationComplete={() => land(token)}
        >
          +{REWARD}
        </motion.span>
      ))}
    </div>
  );
}
