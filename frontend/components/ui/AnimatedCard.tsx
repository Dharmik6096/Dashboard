"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function AnimatedCard({ children, className = "", style }: AnimatedCardProps) {
  const prefersReducedMotion = useReducedMotion();

  // Combine our standard panel class with hover-3d
  const combinedClassName = `panel hover-3d ${className}`.trim();

  if (prefersReducedMotion) {
    return (
      <div className={combinedClassName} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={combinedClassName}
      style={style}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
