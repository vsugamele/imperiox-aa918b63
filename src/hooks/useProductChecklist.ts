import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json, Tables } from "@/integrations/supabase/types";

export type ChecklistStatus = "todo" | "doing" | "done";
export type ChecklistPriority = "low" | "med" | "high";

export interface ChecklistItem {
  id: string;
  user_id: string;
  project_id: string;
  product_id: string | null;
  flow_blueprint_id: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: ChecklistPriority;
  due_date: string | null;
  status: ChecklistStatus;
  assigned_to: string | null;
  kanban_card_id: string | null;
  auto_generated: boolean;
  source: string | null;
  metadata: Json;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function parseChecklistItem(row: Tables<"imphq_funnel_checklist">): ChecklistItem {
  const { status, priority } = row;
  if (status !== "todo" && status !== "doing" && status !== "done") throw new Error("Status de checklist inválido");
  if (priority !== "low" && priority !== "med" && priority !== "high") throw new Error("Prioridade de checklist inválida");
  return { ...row, status, priority };
}

export function productKey(name?: string | null) {
  return (name || "").trim().toLowerCase() || null;
}

export function useProductChecklist(projectId: string | null) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!projectId) { setItems([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_funnel_checklist")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) console.warn(error.message);
    try { setItems((data || []).map(parseChecklistItem)); }
    catch (validationError) { toast.error(validationError instanceof Error ? validationError.message : "Checklist inválido"); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const add = useCallback(async (partial: Partial<ChecklistItem>) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !projectId) return;
    const { error, data } = await supabase
      .from("imphq_funnel_checklist")
      .insert({
        user_id: u.user.id,
        project_id: projectId,
        product_id: partial.product_id ?? null,
        title: partial.title || "Nova tarefa",
        description: partial.description ?? null,
        category: partial.category || "outros",
        priority: partial.priority || "med",
        due_date: partial.due_date ?? null,
        flow_blueprint_id: partial.flow_blueprint_id ?? null,
        auto_generated: partial.auto_generated ?? false,
        source: partial.source ?? null,
        metadata: partial.metadata ?? {},
      })
      .select()
      .single();
    if (error) { toast.error(error.message); return null; }
    await reload();
    return data ? parseChecklistItem(data) : null;
  }, [projectId, reload]);

  const update = useCallback(async (id: string, patch: Partial<ChecklistItem>) => {
    const { error } = await supabase.from("imphq_funnel_checklist").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("imphq_funnel_checklist").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await reload();
  }, [reload]);

  const toKanban = useCallback(async (item: ChecklistItem) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    // pega primeira coluna do projeto, ou cria fallback
    const { data: cols } = await supabase
      .from("imphq_kanban_columns")
      .select("id")
      .eq("project_id", item.project_id)
      .order("position", { ascending: true })
      .limit(1);
    const colId = (cols)?.[0]?.id;
    if (!colId) { toast.error("Crie ao menos uma coluna no Kanban do projeto"); return; }
    const { data: card, error } = await supabase
      .from("imphq_kanban_cards")
      .insert({
        column_id: colId,
        project_id: item.project_id,
        title: item.title,
        description: `[checklist:${item.id}] ${item.description || ""}${item.product_id ? `\n🛒 ${item.product_id}` : ""}`.trim(),
        due_date: item.due_date,
        priority: item.priority,
        tags: item.product_id ? [item.product_id] : null,
      })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    await update(item.id, { kanban_card_id: (card).id });
    toast.success("Tarefa enviada ao Kanban");
  }, [update]);

  return { items, loading, reload, add, update, remove, toKanban };
}
