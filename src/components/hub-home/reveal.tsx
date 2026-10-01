"use client";

import { motion, useReducedMotion } from "framer-motion";

// Content blocks rise into place the first time they enter the viewport. The starting
// state is the same on the server and the client (reduced motion is only known in the
// browser); with reduced motion the block simply appears.
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
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={reduce ? { duration: 0 } : { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
}
