// Logger condicional — silencia em produção, sempre passa errors (sanitizados).
// Use ao invés de console.* em src/**.
import { redact } from "./redact";

const DEV = import.meta.env.DEV || import.meta.env.VITE_DEBUG_LOGS === "true";

function fmt(args: unknown[]): unknown[] {
  return args.map((a) => (typeof a === "object" && a !== null ? redact(a) : a));
}

export const logger = {
  log: (...args: unknown[]) => {
    if (DEV) console.log(...fmt(args));
  },
  info: (...args: unknown[]) => {
    if (DEV) console.info(...fmt(args));
  },
  warn: (...args: unknown[]) => {
    if (DEV) console.warn(...fmt(args));
  },
  debug: (...args: unknown[]) => {
    if (DEV) console.debug(...fmt(args));
  },
  error: (...args: unknown[]) => {
    // Errors sempre passam, mas sanitizados para não vazar tokens/PII.
    console.error(...fmt(args));
  },
};

export default logger;
