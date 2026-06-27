import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProductHealth {
  produto: string;
  receita: number;
  vendas: number;
  ticket: number;
  spend: number;
  roas: number;
  cpa: number;
  ctr_medio: number; // %
  checkouts: number;
  checkout_rate: number; // vendas / checkouts (%)
  score: number; // 0-100
  tier: "alta" | "media" | "baixa";
}

export interface ProductHealthData {
  produtos: ProductHealth[];
  totals: { receita: number; spend: number; vendas: number; roas: number };
  loading: boolean;
  refresh: () => void;
}

function norm(s?: string | null) {
  return (s || "").trim().toLowerCase();
}

function scoreOf(p: { roas: number; cpa: number; ticket: number; checkout_rate: number }): number {
  // ROAS peso 40, checkout rate peso 25, ticket peso 15, CPA inverse peso 20
  const roasS = Math.max(0, Math.min(40, (p.roas / 3) * 40)); // ROAS 3x = full
  const crS = Math.max(0, Math.min(25, (p.checkout_rate / 30) * 25)); // 30% = full
  const tkS = Math.max(0, Math.min(15, (p.ticket / 1000) * 15));
  const cpaPenalty = p.cpa > 0 && p.ticket > 0 ? Math.max(0, Math.min(20, 20 - (p.cpa / Math.max(p.ticket, 1)) * 20)) : 10;
  return Math.round(roasS + crS + tkS + cpaPenalty);
}

export function useProductHealth(projectId: string, days: number = 30): ProductHealthData {
  const [state, setState] = useState<ProductHealthData>({
    produtos: [], totals: { receita: 0, spend: 0, vendas: 0, roas: 0 }, loading: true, refresh: () => {},
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!projectId) {
      setState(s => ({ ...s, produtos: [], loading: false, refresh: () => setTick(t => t + 1) }));
      return;
    }
    let cancel = false;
    (async () => {
      setState(s => ({ ...s, loading: true, refresh: () => setTick(t => t + 1) }));
      const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();
      const sinceDate = sinceIso.slice(0, 10);

      const [vendasRes, adsRes] = await Promise.all([
        supabase
          .from("imphq_vendas")
          .select("valor, valor_liquido, status, produto_nome")
          .eq("project_id", projectId)
          .gte("data_venda", sinceIso)
          .limit(5000),
        supabase
          .from("imphq_ads_spend")
          .select("spend, valor, ctr, checkouts_iniciados, init_checkout, campanha")
          .eq("project_id", projectId)
          .gte("data_ref", sinceDate)
          .limit(5000),
      ]);

      if (cancel) return;

      const byProd: Record<string, ProductHealth> = {};
      for (const v of (vendasRes.data || []) as any[]) {
        const st = (v.status || "").toLowerCase();
        if (!st.includes("aprov") && !st.includes("paid")) continue;
        const key = norm(v.produto_nome);
        if (!key) continue;
        const valor = Number(v.valor_liquido ?? v.valor) || 0;
        const cur = byProd[key] || {
          produto: v.produto_nome, receita: 0, vendas: 0, ticket: 0,
          spend: 0, roas: 0, cpa: 0, ctr_medio: 0, checkouts: 0, checkout_rate: 0,
          score: 0, tier: "baixa" as const,
        };
        cur.receita += valor;
        cur.vendas += 1;
        byProd[key] = cur;
      }

      // Ads: tentamos casar pelo nome da campanha (contém produto)
      const ctrSamples: Record<string, number[]> = {};
      let spendTotal = 0;
      for (const a of (adsRes.data || []) as any[]) {
        const spend = Number(a.spend ?? a.valor) || 0;
        spendTotal += spend;
        const camp = norm(a.campanha);
        const checkouts = Number(a.checkouts_iniciados ?? a.init_checkout) || 0;
        let matched = false;
        for (const k of Object.keys(byProd)) {
          if (camp && camp.includes(k.slice(0, Math.min(k.length, 12)))) {
            byProd[k].spend += spend;
            byProd[k].checkouts += checkouts;
            (ctrSamples[k] ||= []).push(Number(a.ctr) || 0);
            matched = true;
            break;
          }
        }
        if (!matched && Object.keys(byProd).length === 1) {
          // single product fallback
          const k = Object.keys(byProd)[0];
          byProd[k].spend += spend;
          byProd[k].checkouts += checkouts;
          (ctrSamples[k] ||= []).push(Number(a.ctr) || 0);
        }
      }

      const produtos = Object.entries(byProd).map(([k, p]) => {
        const ctrs = ctrSamples[k] || [];
        const ctr_medio = ctrs.length ? ctrs.reduce((s, x) => s + x, 0) / ctrs.length : 0;
        const ticket = p.vendas ? p.receita / p.vendas : 0;
        const roas = p.spend > 0 ? p.receita / p.spend : 0;
        const cpa = p.vendas > 0 ? p.spend / p.vendas : 0;
        const checkout_rate = p.checkouts > 0 ? (p.vendas / p.checkouts) * 100 : 0;
        const score = scoreOf({ roas, cpa, ticket, checkout_rate });
        const tier: ProductHealth["tier"] = score >= 70 ? "alta" : score >= 40 ? "media" : "baixa";
        return { ...p, ticket, roas, cpa, ctr_medio, checkout_rate, score, tier };
      }).sort((a, b) => b.receita - a.receita);

      const receita = produtos.reduce((s, p) => s + p.receita, 0);
      const vendas = produtos.reduce((s, p) => s + p.vendas, 0);
      const roasTotal = spendTotal > 0 ? receita / spendTotal : 0;

      setState({
        produtos,
        totals: { receita, spend: spendTotal, vendas, roas: roasTotal },
        loading: false,
        refresh: () => setTick(t => t + 1),
      });
    })();

    return () => { cancel = true; };
  }, [projectId, days, tick]);

  return state;
}
