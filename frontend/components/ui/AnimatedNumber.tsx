"use client";

import { useEffect, useState } from "react";
import { useSpring, useReducedMotion } from "framer-motion";

interface AnimatedNumberProps {
  value: number | string | null | undefined;
  format?: (val: number) => string;
}

export function AnimatedNumber({ value, format = (v) => v.toFixed(0) }: AnimatedNumberProps) {
  const prefersReducedMotion = useReducedMotion();
  const [displayedValue, setDisplayedValue] = useState(
    typeof value === "number" ? format(value) : String(value ?? "")
  );

  const numValue = typeof value === "number" ? value : parseFloat(String(value));
  const isNumber = !isNaN(numValue) && typeof value === "number";

  const springValue = useSpring(isNumber ? numValue : 0, {
    stiffness: 100,
    damping: 30,
    mass: 1,
  });

  useEffect(() => {
    if (prefersReducedMotion || !isNumber) {
      setTimeout(() => setDisplayedValue(isNumber ? format(numValue) : String(value ?? "")), 0);
      return;
    }
    springValue.set(numValue);
  }, [value, springValue, prefersReducedMotion, format, isNumber, numValue]);

  useEffect(() => {
    if (prefersReducedMotion || !isNumber) return;
    
    return springValue.onChange((latest) => {
      setDisplayedValue(format(latest));
    });
  }, [springValue, format, prefersReducedMotion, isNumber]);

  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{displayedValue}</span>;
}
