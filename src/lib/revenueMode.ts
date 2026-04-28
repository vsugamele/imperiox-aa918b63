import { useEffect, useState, useCallback } from "react";

export type RevenueMode = "bruto" | "liquido";

const STORAGE_KEY = "imphq:revenue-mode";
const EVT = "imphq:revenue-mode-change";

export function getStoredRevenueMode(): RevenueMode {
  if (typeof window === "undefined") return "bruto";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "liquido" ? "liquido" : "bruto";
}

export function setStoredRevenueMode(mode: RevenueMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent(EVT, { detail: mode }));
}

/** Hook reativo — atualiza qualquer componente quando o modo muda em qualquer lugar do app. */
export function useRevenueMode(): [RevenueMode, (m: RevenueMode) => void] {
  const [mode, setMode] = useState<RevenueMode>(() => getStoredRevenueMode());

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<RevenueMode>).detail;
      if (detail) setMode(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) setMode(e.newValue as RevenueMode);
    };
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((m: RevenueMode) => setStoredRevenueMode(m), []);
  return [mode, update];
}

/** Extrai o valor de receita correto de uma venda conforme o modo selecionado. */
export function getRevenue(
  venda: { valor?: number | null; valor_liquido?: number | null } | null | undefined,
  mode: RevenueMode,
): number {
  if (!venda) return 0;
  if (mode === "liquido") {
    return Number(venda.valor_liquido ?? venda.valor ?? 0);
  }
  return Number(venda.valor ?? 0);
}

/** Soma rápida de receita em uma lista de vendas. */
export function sumRevenue(
  vendas: Array<{ valor?: number | null; valor_liquido?: number | null }>,
  mode: RevenueMode,
): number {
  return vendas.reduce((acc, v) => acc + getRevenue(v, mode), 0);
}
