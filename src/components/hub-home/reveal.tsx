"use client";

import { motion, useReducedMotion } from "framer-motion";

// Content blocks rise into place the first time they enter the viewport.
export function Reveal({
  as = "div",
  children,
  className,
  delay = 0,
}: {
  as?: "div" | "li" | "details";
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
}
