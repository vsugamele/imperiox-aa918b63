import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Competitor, COMPETITOR_COLORS } from "./types";

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
    setCompetitors((data as any[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addCompetitor = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login primeiro"); return; }
    const color = COMPETITOR_COLORS[competitors.length % COMPETITOR_COLORS.length];
    const { data, error } = await supabase
      .from("imphq_competitors")
      .insert({ project_id: projectId, user_id: user.id, name: "Novo Concorrente", color } as any)
      .select()
      .single();
    if (error) { toast.error("Erro ao adicionar"); return; }
    setCompetitors(prev => [...prev, data as any]);
    toast.success("Concorrente adicionado");
  }, [projectId, competitors.length]);

  const removeCompetitor = useCallback(async (id: string) => {
    const { error } = await supabase.from("imphq_competitors").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    setCompetitors(prev => prev.filter(c => c.id !== id));
    toast.success("Concorrente removido");
  }, []);

  const updateField = useCallback((id: string, field: string, value: any) => {
    setCompetitors(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    const key = `${id}-${field}`;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      const { error } = await supabase
        .from("imphq_competitors")
        .update({ [field]: value } as any)
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

  const importCompetitors = useCallback(async (parsed: Record<string, any>[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login primeiro"); return; }

    let imported = 0;
    let updated = 0;

    for (const comp of parsed) {
      const compName = comp.name || "Concorrente importado";

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
        const updates: Record<string, any> = {};
        for (const f of fields) {
          if (comp[f] !== undefined && comp[f] !== "" && comp[f] !== null) {
            // Don't overwrite if existing has data and new is empty
            const existingVal = (existing as any)[f];
            if (!existingVal || existingVal === "" || (Array.isArray(existingVal) && existingVal.length === 0)) {
              updates[f] = comp[f];
            } else if (typeof comp[f] === "string" && comp[f].length > (existingVal?.length || 0)) {
              // Prefer longer text values
              updates[f] = comp[f];
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from("imphq_competitors")
            .update(updates as any)
            .eq("id", existing.id);
          if (!error) {
            setCompetitors(prev => prev.map(c => c.id === existing.id ? { ...c, ...updates } : c));
            updated++;
          }
        }
      } else {
        // INSERT new competitor
        const color = COMPETITOR_COLORS[(competitors.length + imported) % COMPETITOR_COLORS.length];
        const row: Record<string, any> = {
          project_id: projectId,
          user_id: user.id,
          name: compName,
          color,
        };

        for (const f of fields) {
          if (comp[f] !== undefined && comp[f] !== "" && comp[f] !== null) {
            row[f] = comp[f];
          }
        }

        const { data, error } = await supabase
          .from("imphq_competitors")
          .insert(row as any)
          .select()
          .single();

        if (!error && data) {
          setCompetitors(prev => [...prev, data as any]);
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
