import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { routeKey } from "@/lib/navigation";

/**
 * UX1.1: registra cada tela aberta (rota normalizada) em imphq_page_views. A mesma rota não conta de novo antes de 30 s
 * (recarregar ou voltar). Falha de rede é ignorada: medir nunca atrapalha usar.
 */
export function usePageViewTracking() {
  const { pathname } = useLocation();
  const last = useRef<{ rota: string; at: number } | null>(null);
  useEffect(() => {
    const rota = routeKey(pathname);
    const now = Date.now();
    if (last.current && last.current.rota === rota && now - last.current.at < 30_000) return;
    last.current = { rota, at: now };
    void Promise.resolve(supabase.from("imphq_page_views").insert({ rota })).catch(() => undefined);
  }, [pathname]);
}
