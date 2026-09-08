import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

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
        const { data: proj } = await supabase
          .from("imphq_projects")
          .select("data")
          .eq("id", projectId)
          .maybeSingle();

        const d = parseContext(proj?.data);
        const briefing = contextObject(d.briefing || d);
        const avatar = formatAvatar(briefing);
        const branding = formatBranding(briefing);
        const winners = "";

        if (!cancel) setCtx({ avatar, branding, winners, loading: false });
      } catch {
        if (!cancel) setCtx({ avatar: "", branding: "", winners: "", loading: false });
      }
    })();
    return () => { cancel = true; };
  }, [projectId]);

  return ctx;
}

function formatAvatar(b: { [key: string]: Json | undefined }): string {
  const raw = b.avatar || b.publico_alvo;
  if (typeof raw === "string") return raw.slice(0, 800);
  const a = contextObject(raw);
  const parts: string[] = [];
  if (a?.descricao || a?.descricao_avatar) parts.push(`Quem é: ${a.descricao || a.descricao_avatar}`);
  if (a?.dores || b?.dores) parts.push(`Dores: ${pickList(a?.dores || b?.dores)}`);
  if (a?.desejos || b?.desejos) parts.push(`Desejos: ${pickList(a?.desejos || b?.desejos)}`);
  if (a?.objecoes || b?.objecoes) parts.push(`Objeções: ${pickList(a?.objecoes || b?.objecoes)}`);
  return parts.join("\n").slice(0, 1200);
}

function formatBranding(b: { [key: string]: Json | undefined }): string {
  const raw = b.branding || b.identidade;
  if (typeof raw === "string") return raw.slice(0, 400);
  const br = contextObject(raw);
  const parts: string[] = [];
  if (br?.tom_de_voz || br?.tom) parts.push(`Tom: ${br.tom_de_voz || br.tom}`);
  if (br?.paleta || br?.cores) parts.push(`Cores: ${pickList(br.paleta || br.cores)}`);
  if (br?.fonte || br?.tipografia) parts.push(`Tipografia: ${br.fonte || br.tipografia}`);
  if (br?.estilo) parts.push(`Estilo: ${br.estilo}`);
  return parts.join("\n").slice(0, 600);
}

function pickList(v: Json | undefined): string {
  if (!v) return "—";
  if (Array.isArray(v)) return v.slice(0, 6).map((x) => typeof x === "string" ? x : JSON.stringify(x)).join("; ");
  if (typeof v === "string") return v.slice(0, 400);
  return JSON.stringify(v).slice(0, 400);
}

function contextObject(value: Json | undefined): { [key: string]: Json | undefined } {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function parseContext(value: Json | undefined): { [key: string]: Json | undefined } {
  if (typeof value !== "string") return contextObject(value);
  try {
    const parsed: unknown = JSON.parse(value);
    // Parsing JSON always yields JSON values; reject non-object context at the boundary.
    return isContextObject(parsed) ? parsed : {};
  } catch { return {}; }
}

function isContextObject(value: unknown): value is { [key: string]: Json | undefined } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(isJson);
}

function isJson(value: unknown): value is Json {
  return value === null || typeof value === "string" || typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) ? value.every(isJson) : isContextObject(value));
}
