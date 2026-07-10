import { useEffect, useRef, useState, useCallback } from "react";

export type SaveStatus = "idle" | "dirty" | "saving" | "error";

interface Options<T> {
  value: T;
  onSave: (value: T) => Promise<void> | void;
  /** Debounce in ms. Default 1500ms. */
  debounce?: number;
  /** Skip auto-save entirely (e.g. when nothing is being edited). */
  enabled?: boolean;
}

/**
 * Debounced auto-save with dirty tracking.
 * - Marks dirty on value change
 * - Fires save after `debounce` ms of silence
 * - Also saves on Ctrl/Cmd+S and window blur
 * - Blocks unload while dirty/saving
 */
export function useAutoSave<T>({ value, onSave, debounce = 1500, enabled = true }: Options<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const lastSavedValueRef = useRef<T>(value);
  const savingRef = useRef(false);
  const pendingRef = useRef<T | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const runSave = useCallback(async (v: T) => {
    if (savingRef.current) {
      pendingRef.current = v;
      return;
    }
    savingRef.current = true;
    setStatus("saving");
    setError(null);
    try {
      await onSaveRef.current(v);
      lastSavedValueRef.current = v;
      setLastSavedAt(new Date());
      if (pendingRef.current !== null && pendingRef.current !== v) {
        const next = pendingRef.current;
        pendingRef.current = null;
        savingRef.current = false;
        runSave(next);
        return;
      }
      pendingRef.current = null;
      setStatus("idle");
    } catch (e: any) {
      setError(e?.message || "Erro ao salvar");
      setStatus("error");
    } finally {
      savingRef.current = false;
    }
  }, []);

  // Detect changes → debounce → save
  useEffect(() => {
    if (!enabled) return;
    if (value === lastSavedValueRef.current) return;
    setStatus((s) => (s === "saving" ? s : "dirty"));
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      runSave(value);
    }, debounce);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [value, enabled, debounce, runSave]);

  // Ctrl/Cmd+S + blur
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (value !== lastSavedValueRef.current) runSave(value);
      }
    };
    const onBlur = () => {
      if (value !== lastSavedValueRef.current) runSave(value);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, [value, enabled, runSave]);

  // Block unload while dirty
  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status, enabled]);

  const forceSave = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (value !== lastSavedValueRef.current) return runSave(value);
    return Promise.resolve();
  }, [value, runSave]);

  // Sync baseline when parent replaces value with a fresh loaded record
  const resetBaseline = useCallback((v: T) => {
    lastSavedValueRef.current = v;
    setStatus("idle");
    setError(null);
  }, []);

  return { status, error, lastSavedAt, forceSave, resetBaseline };
}
