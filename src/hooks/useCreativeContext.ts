import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CreativeContext {
  avatar: string;
  branding: string;
  winners: string;
  loading: boolean;
}

/**
 * Puxa contexto rico do projeto para enriquecer prompts de criativos:
 * - Avatar (dores/desejos/objeções do briefing)
 * - Branding (tom de voz, cores, fontes)
 * - Top 3 criativos vencedores (CTR > 2%)
 */
export function useCreativeContext(projectId?: string): CreativeContext {
  const [ctx, setCtx] = useState<CreativeContext>({
    avatar: "", branding: "", winners: "", loading: true,
  });

  useEffect(() => {
    if (!projectId) {
      setCtx({ avatar: "", branding: "", winners: "", loading: false });
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const [{ data: proj }, { data: ads }] = await Promise.all([
          supabase.from("imphq_projects").select("data").eq("id", projectId).maybeSingle() as any,
          supabase.from("imphq_meta_ads_insights").select("ad_name, ctr, conversions")
            .eq("project_id", projectId).order("ctr", { ascending: false }).limit(3) as any,
        ]);

        const d: any = (() => {
          const raw = proj?.data;
          if (!raw) return {};
          return typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
        })();
        const briefing = d?.briefing || d || {};
        const avatar = formatAvatar(briefing);
        const branding = formatBranding(briefing);
        const winners = (ads || [])
          .filter((a: any) => (a.ctr ?? 0) > 0.02)
          .map((a: any) => `• ${a.ad_name} (CTR ${(a.ctr * 100).toFixed(2)}%)`)
          .join("\n") || "";

        if (!cancel) setCtx({ avatar, branding, winners, loading: false });
      } catch {
        if (!cancel) setCtx({ avatar: "", branding: "", winners: "", loading: false });
      }
    })();
    return () => { cancel = true; };
  }, [projectId]);

  return ctx;
}

function formatAvatar(b: any): string {
  const a = b?.avatar || b?.publico_alvo || {};
  if (typeof a === "string") return a.slice(0, 800);
  const parts: string[] = [];
  if (a?.descricao || a?.descricao_avatar) parts.push(`Quem é: ${a.descricao || a.descricao_avatar}`);
  if (a?.dores || b?.dores) parts.push(`Dores: ${pickList(a?.dores || b?.dores)}`);
  if (a?.desejos || b?.desejos) parts.push(`Desejos: ${pickList(a?.desejos || b?.desejos)}`);
  if (a?.objecoes || b?.objecoes) parts.push(`Objeções: ${pickList(a?.objecoes || b?.objecoes)}`);
  return parts.join("\n").slice(0, 1200);
}

function formatBranding(b: any): string {
  const br = b?.branding || b?.identidade || {};
  if (typeof br === "string") return br.slice(0, 400);
  const parts: string[] = [];
  if (br?.tom_de_voz || br?.tom) parts.push(`Tom: ${br.tom_de_voz || br.tom}`);
  if (br?.paleta || br?.cores) parts.push(`Cores: ${pickList(br.paleta || br.cores)}`);
  if (br?.fonte || br?.tipografia) parts.push(`Tipografia: ${br.fonte || br.tipografia}`);
  if (br?.estilo) parts.push(`Estilo: ${br.estilo}`);
  return parts.join("\n").slice(0, 600);
}

function pickList(v: any): string {
  if (!v) return "—";
  if (Array.isArray(v)) return v.slice(0, 6).map((x) => typeof x === "string" ? x : JSON.stringify(x)).join("; ");
  if (typeof v === "string") return v.slice(0, 400);
  return JSON.stringify(v).slice(0, 400);
}
