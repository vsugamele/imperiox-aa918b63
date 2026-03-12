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

  return { competitors, loading, addCompetitor, removeCompetitor, updateField, uploadScreenshot };
}
