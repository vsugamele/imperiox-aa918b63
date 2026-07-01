import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useFlowHistory — undo/redo para qualquer estado serializável.
 *
 * Uso: wrappe o `onChange` da lista de ações.
 *   const history = useFlowHistory(acoes, onChange, { limit: 50 });
 *   history.push(novasAcoes);   // em vez de onChange direto
 *   history.undo() / history.redo()
 *
 * Atalhos Ctrl/Cmd+Z e Ctrl+Shift+Z são registrados automaticamente.
 */
export function useFlowHistory<T>(
  current: T,
  apply: (next: T) => void,
  opts: { limit?: number; enabled?: boolean } = {}
) {
  const { limit = 50, enabled = true } = opts;
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const lastSnapshot = useRef<string>(JSON.stringify(current));
  const [, forceRender] = useState(0);
  const refresh = useCallback(() => forceRender((n) => n + 1), []);

  // Quando estado externo muda (ex: load inicial), reseta histórico
  useEffect(() => {
    const snap = JSON.stringify(current);
    if (lastSnapshot.current === snap) return;
    // Só registra se foi mutação local; senão reseta
    if (past.current.length === 0) {
      lastSnapshot.current = snap;
    }
  }, [current]);

  const push = useCallback(
    (next: T) => {
      if (!enabled) {
        apply(next);
        return;
      }
      const prev = lastSnapshot.current;
      const snap = JSON.stringify(next);
      if (prev === snap) {
        apply(next);
        return;
      }
      past.current.push(JSON.parse(prev));
      if (past.current.length > limit) past.current.shift();
      future.current = [];
      lastSnapshot.current = snap;
      apply(next);
      refresh();
    },
    [apply, enabled, limit, refresh]
  );

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    const prev = past.current.pop()!;
    future.current.push(JSON.parse(lastSnapshot.current));
    lastSnapshot.current = JSON.stringify(prev);
    apply(prev);
    refresh();
  }, [apply, refresh]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    const next = future.current.pop()!;
    past.current.push(JSON.parse(lastSnapshot.current));
    lastSnapshot.current = JSON.stringify(next);
    apply(next);
    refresh();
  }, [apply, refresh]);

  const reset = useCallback(
    (value: T) => {
      past.current = [];
      future.current = [];
      lastSnapshot.current = JSON.stringify(value);
      refresh();
    },
    [refresh]
  );

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, undo, redo]);

  return {
    push,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    pastSize: past.current.length,
    futureSize: future.current.length,
  };
}
