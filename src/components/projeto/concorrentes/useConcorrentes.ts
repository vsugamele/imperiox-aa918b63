import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Competitor, COMPETITOR_COLORS } from "@/components/projeto/concorrentes/types";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { objectFields, jsonText } from "@/lib/json-fields";

function toCompetitor(row: Tables<"imphq_competitors">): Competitor {
  const strings = (v: Json): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return { ...row, canais_keywords: strings(row.canais_keywords), stack_tecnologico: strings(row.stack_tecnologico), paginas_funil: strings(row.paginas_funil) };
}

function importFields(raw: Record<string, unknown>): Record<string, Json> {
  const result: Record<string, Json> = {};
  for (const key of ["url", "ponto_forte", "fraqueza", "nicho", "sub_nicho", "publico_alvo", "mecanismo_unico", "headline", "hook", "cta", "oferta_principal", "preco", "garantia", "bonus", "trafego_est", "insights"]) {
    if (typeof raw[key] === "string" && raw[key]) result[key] = raw[key];
  }
  for (const key of ["score_escala", "score_max"]) {
    if (typeof raw[key] === "number" && Number.isFinite(raw[key])) result[key] = Math.round(raw[key]);
  }
  for (const key of ["canais_keywords", "stack_tecnologico", "paginas_funil"]) {
    const value = raw[key];
    if (Array.isArray(value) && value.every((v): v is string => typeof v === "string")) result[key] = value;
  }
  if (typeof raw.ads_ativos === "boolean") result.ads_ativos = raw.ads_ativos;
  return result;
}

export function useConcorrentes(projectId: string) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const timers = useRef<Record<string, NodeJS.Timeout>>({});

  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("imphq_competitors")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at");
    if (error) { toast.error("Erro ao carregar concorrentes"); return; }
    setCompetitors((data || []).map(toCompetitor));
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addCompetitor = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login primeiro"); return; }
    const color = COMPETITOR_COLORS[competitors.length % COMPETITOR_COLORS.length];
    const { data, error } = await supabase
      .from("imphq_competitors")
      .insert({ project_id: projectId, user_id: user.id, name: "Novo Concorrente", color })
      .select()
      .single();
    if (error) { toast.error("Erro ao adicionar"); return; }
    setCompetitors(prev => [...prev, toCompetitor(data)]);
    toast.success("Concorrente adicionado");
  }, [projectId, competitors.length]);

  const removeCompetitor = useCallback(async (id: string) => {
    const { error } = await supabase.from("imphq_competitors").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    setCompetitors(prev => prev.filter(c => c.id !== id));
    toast.success("Concorrente removido");
  }, []);

  const updateField = useCallback((id: string, field: string, value: Json) => {
    setCompetitors(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    const key = `${id}-${field}`;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      const { error } = await supabase
        .from("imphq_competitors")
        .update({ [field]: value })
        .eq("id", id);
      if (error) toast.error("Erro ao salvar");
    }, 800);
  }, []);

  const uploadScreenshot = useCallback(async (id: string, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${projectId}/${id}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("competitor-screenshots")
      .upload(path, file, { upsert: true });
    if (upErr) { toast.error("Erro no upload"); return; }
    const { data: { publicUrl } } = supabase.storage
      .from("competitor-screenshots")
      .getPublicUrl(path);
    updateField(id, "screenshot_url", publicUrl);
    toast.success("Screenshot enviado");
  }, [projectId, updateField]);

  const importCompetitors = useCallback(async (parsed: Record<string, unknown>[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login primeiro"); return; }

    let imported = 0;
    let updated = 0;

    for (const rawComp of parsed) {
      const comp = importFields(rawComp);
      const compName = jsonText(rawComp.name) || "Concorrente importado";

      // Check if competitor with same name already exists (case-insensitive)
      const existing = competitors.find(
        c => c.name.toLowerCase().trim() === compName.toLowerCase().trim()
      );

      const fields = [
        "url", "ponto_forte", "fraqueza", "nicho", "sub_nicho", "publico_alvo",
        "mecanismo_unico", "score_escala", "score_max", "headline", "hook", "cta",
        "oferta_principal", "preco", "garantia", "bonus", "trafego_est", "ads_ativos",
        "insights", "canais_keywords", "stack_tecnologico", "paginas_funil"
      ];

      if (existing) {
        // MERGE: update only non-empty fields
        const updates: Record<string, Json> = {};
        for (const f of fields) {
          if (comp[f] !== undefined && comp[f] !== "" && comp[f] !== null) {
            // Don't overwrite if existing has data and new is empty
            const existingVal = objectFields(existing)[f];
            if (!existingVal || existingVal === "" || (Array.isArray(existingVal) && existingVal.length === 0)) {
              updates[f] = (f === "score_escala" || f === "score_max") && typeof comp[f] === "number" ? Math.round(comp[f]) : comp[f];
            } else if (typeof comp[f] === "string" && comp[f].length > (typeof existingVal === "string" ? existingVal.length : 0)) {
              updates[f] = comp[f];
            }
          }
        }

        // Also populate canais_principais for merge
        if (Array.isArray(comp.canais_keywords) && comp.canais_keywords.length && !updates.canais_principais) {
          const existing_cp = existing.canais_principais;
          if (!existing_cp) {
            updates.canais_principais = (comp.canais_keywords as string[]).join(", ");
          }
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from("imphq_competitors")
            .update(updates)
            .eq("id", existing.id);
          if (!error) {
            setCompetitors(prev => prev.map(c => c.id === existing.id ? { ...c, ...updates } : c));
            updated++;
          }
        }
      } else {
        // INSERT new competitor
        const color = COMPETITOR_COLORS[(competitors.length + imported) % COMPETITOR_COLORS.length];
        const row: TablesInsert<"imphq_competitors"> & Record<string, Json> = {
          project_id: projectId,
          user_id: user.id,
          name: compName,
          color,
        };

        for (const f of fields) {
      if (comp[f] !== undefined && comp[f] !== "" && comp[f] !== null) {
            // Round integer fields to prevent float rejection
            if ((f === "score_escala" || f === "score_max") && typeof comp[f] === "number") {
              row[f] = Math.round(comp[f]);
            } else {
              row[f] = comp[f];
            }
          }
        }

        // Populate canais_principais from canais_keywords
        if (Array.isArray(comp.canais_keywords) && comp.canais_keywords.length) {
          row.canais_principais = (comp.canais_keywords as string[]).join(", ");
        }

        const { data, error } = await supabase
          .from("imphq_competitors")
          .insert(row)
          .select()
          .single();

        if (error) {
          console.error("Erro ao importar concorrente:", compName, error);
        } else if (data) {
          setCompetitors(prev => [...prev, toCompetitor(data)]);
          imported++;
        }
      }
    }

    const messages: string[] = [];
    if (imported > 0) messages.push(`${imported} novo(s)`);
    if (updated > 0) messages.push(`${updated} atualizado(s)`);

    if (messages.length > 0) {
      toast.success(`Concorrentes: ${messages.join(", ")}`);
    } else {
      toast.error("Nenhuma alteração realizada");
    }
  }, [projectId, competitors]);

  return { competitors, loading, addCompetitor, removeCompetitor, updateField, uploadScreenshot, importCompetitors };
}
