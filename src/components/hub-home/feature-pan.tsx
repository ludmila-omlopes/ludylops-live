"use client";

import { Children, createContext, useContext, useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  stagger,
  useAnimate,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

import styles from "./hub-home.module.css";
import { useMediaQuery } from "./use-media-query";

// "inview": the panel plays its demo when it scrolls into view (stacked layout).
// boolean: the horizontal track decides when each panel is centered.
const PlayContext = createContext<boolean | "inview">("inview");

function usePlay(ref: React.RefObject<Element | null>) {
  const mode = useContext(PlayContext);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  return mode === "inview" ? inView : mode;
}

// Features pass sideways one at a time while the page scrolls down, with a progress bar
// naming the current one. Below 961px, or with reduced motion, the panels simply stack.
export function FeaturePan({
  heading,
  labels,
  children,
}: {
  heading: React.ReactNode;
  labels: string[];
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const desktop = useMediaQuery("(min-width: 961px)");
  const enabled = desktop && !reduce;
  const [distance, setDistance] = useState(0);
  const [active, setActive] = useState(0);
  const [played, setPlayed] = useState<boolean[]>(() => labels.map((_, i) => i === 0));
  const travel = useMotionValue(0);
  const { scrollYProgress } = useScroll({ target: outerRef, offset: ["start start", "end end"] });
  const x = useTransform(() => -scrollYProgress.get() * travel.get());

  useEffect(() => {
    const track = trackRef.current;
    if (!enabled || !track) return;
    const observer = new ResizeObserver(() => {
      const next = Math.max(0, track.scrollWidth - window.innerWidth);
      travel.set(next);
      setDistance(next);
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [enabled, travel]);

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (!enabled) return;
    const index = Math.min(labels.length - 1, Math.round(progress * (labels.length - 1)));
    setActive((current) => (current === index ? current : index));
    setPlayed((current) => (current[index] ? current : current.map((value, i) => value || i === index)));
  });

  const pinned = enabled && distance > 0;

  return (
    <section
      ref={outerRef}
      id="recursos"
      className={styles.pan}
      aria-labelledby="recursos-titulo"
      style={pinned ? { height: `calc(100dvh + ${distance}px)` } : undefined}
    >
      <div className={styles.panSticky} style={pinned ? { position: "sticky", top: 0, height: "100dvh" } : undefined}>
        <div className={styles.panHead}>
          {heading}
          <div className={styles.stepsBar} aria-hidden="true">
            {labels.map((label, i) => (
              <span key={label} className={pinned && i === active ? styles.stepsOn : undefined}>
                {label}
              </span>
            ))}
          </div>
        </div>
        <motion.div ref={trackRef} className={styles.panTrack} style={pinned ? { x } : undefined}>
          {Children.map(children, (child, i) => (
            <PlayContext.Provider value={pinned ? played[i] : "inview"}>{child}</PlayContext.Provider>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// Counts up from zero the first time its panel plays.
export function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const play = usePlay(ref);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!play || reduce || !node) return;
    const controls = animate(0, to, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (value) => {
        node.textContent = Math.round(value).toLocaleString("pt-BR");
      },
    });
    return () => controls.stop();
  }, [play, reduce, to]);

  return <span ref={ref}>{to.toLocaleString("pt-BR")}</span>;
}

// Its children slide in, one after another, the first time the panel plays.
export function PlayIn({ children, className, from = "side" }: { children: React.ReactNode; className?: string; from?: "side" | "below" }) {
  const [scope, run] = useAnimate<HTMLDivElement>();
  const play = usePlay(scope);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!play || reduce || !scope.current) return;
    const items = Array.from(scope.current.children);
    const offset = from === "side" ? { x: [24, 0] } : { y: [30, 0], scale: [0.96, 1] };
    run(items, { opacity: [0, 1], ...offset }, { duration: 0.6, delay: stagger(0.09), ease: [0.16, 1, 0.3, 1] });
  }, [play, reduce, run, scope, from]);

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}

// The affiliate label lands like a stamp when its panel plays.
export function StampIn({ children, className }: { children: React.ReactNode; className: string }) {
  const [scope, run] = useAnimate<HTMLSpanElement>();
  const play = usePlay(scope);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!play || reduce || !scope.current) return;
    run(scope.current, { scale: [1.8, 1], rotate: [-16, -4], opacity: [0, 1] }, { duration: 0.6, delay: 0.2, type: "spring", bounce: 0.45 });
  }, [play, reduce, run, scope]);

  return (
    <span ref={scope} className={className}>
      {children}
    </span>
  );
}
