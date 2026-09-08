import { errorMessage } from "@/lib/error-message";
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
  const latestValueRef = useRef<T>(value);
  latestValueRef.current = value;
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const runSave = useCallback((v: T): Promise<boolean> => {
    // A forced save must wait for older writes and its own database response.
    // Returning immediately while another write runs could close an unsaved editor.
    const task = saveQueueRef.current.then(async () => {
      if (v === lastSavedValueRef.current) {
        setError(null);
        setStatus(latestValueRef.current === v ? "idle" : "dirty");
        return true;
      }
      setStatus("saving");
      setError(null);
      try {
        await onSaveRef.current(v);
        lastSavedValueRef.current = v;
        setLastSavedAt(new Date());
        setStatus(latestValueRef.current === v ? "idle" : "dirty");
        return true;
      } catch (e: unknown) {
        setError(errorMessage(e) || "Erro ao salvar");
        setStatus("error");
        return false;
      }
    });
    saveQueueRef.current = task;
    return task;
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
      if (status === "dirty" || status === "saving" || status === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status, enabled]);

  const forceSave = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    return runSave(value).then((saved) => saved && latestValueRef.current === value);
  }, [value, runSave]);

  // Sync baseline when parent replaces value with a fresh loaded record
  const resetBaseline = useCallback((v: T) => {
    lastSavedValueRef.current = v;
    setStatus("idle");
    setError(null);
  }, []);

  return { status, error, lastSavedAt, forceSave, resetBaseline };
}
