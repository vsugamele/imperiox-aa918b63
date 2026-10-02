import { useEffect, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

/** Número que conta até o valor novo e dá um pulo quando sobe (sem animação para quem pediu menos movimento). */
export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(0);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (from === value) return;
    if (value > from) setBump((b) => b + 1);
    if (reduceMotion) { setShown(value); return; }
    const controls = animate(from, value, { duration: 0.6, ease: "easeOut", onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [value, reduceMotion]);

  return (
    <motion.span key={bump} className={className} initial={bump && !reduceMotion ? { scale: 1.35 } : false} animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }} style={{ display: "inline-block" }}>
      {shown}
    </motion.span>
  );
}
