"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

import styles from "./hub-home.module.css";

// The example community starts tilted and straightens as it scrolls into view,
// bringing the product into focus right below the headline.
export function StageTilt({ children, className }: { children: React.ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.92", "start 0.18"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.88, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);

  return (
    <div ref={ref} className={styles.stage} aria-hidden="true">
      <motion.div className={className} style={reduce ? undefined : { rotateX, scale, y }}>
        {children}
      </motion.div>
    </div>
  );
}
