"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

import styles from "./hub-home.module.css";

const MAX_SHIFT = 4;

function clamp(value: number) {
  return Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, value));
}

// The primary call to action leans a few pixels toward the pointer, as hover feedback.
export function Magnetic({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 320, damping: 34 });
  const springY = useSpring(y, { stiffness: 320, damping: 34 });

  function handleMove(event: React.PointerEvent<HTMLSpanElement>) {
    if (reduce || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(clamp((event.clientX - rect.left - rect.width / 2) * 0.06));
    y.set(clamp((event.clientY - rect.top - rect.height / 2) * 0.1));
  }

  function handleLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.span
      className={`${styles.magnetic} ${className}`}
      style={reduce ? undefined : { x: springX, y: springY }}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {children}
    </motion.span>
  );
}
