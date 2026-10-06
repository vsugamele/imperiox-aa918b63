import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildAiFeed, type ActionRow, type FeedbackRow, type FeedItem, type KnowledgeRow, type SaleRow, type WaMessageRow } from "@shared/ai-feed";

const WINDOW_HOURS = 48;

/** O que a IA fez sozinha nas últimas 48h, com a revisão do time (se houver). Atualiza a cada minuto. */
export function useAiFeed() {
  return useQuery({
    queryKey: ["ai-feed"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<FeedItem[]> => {
      const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();
      const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const [aiRes, salesRes, kbRes, actRes] = await Promise.all([
        supabase.from("imphq_wa_messages").select("id, conversation_id, project_id, content, created_at, sent_by, direction")
          .eq("sent_by", "ai").eq("direction", "outgoing").gte("created_at", since).order("created_at", { ascending: false }).limit(100),
        supabase.from("imphq_vendas").select("id, project_id, nome, produto_nome, valor, status, data, created_at").gte("created_at", since7d).order("created_at", { ascending: false }).limit(300),
        supabase.from("imphq_wa_knowledge").select("id, project_id, pergunta, resposta, aprovada, triado_em, triagem").gte("triado_em", since).eq("aprovada", true).limit(100),
        supabase.from("imphq_ai_actions").select("id, projeto_id, kind, title, reason, status, created_at").eq("auto_executed", true).gte("created_at", since).limit(100),
      ]);
      for (const r of [aiRes, salesRes, kbRes, actRes]) if (r.error) throw r.error;
      const aiMessages = (aiRes.data ?? []) as WaMessageRow[];
      const convIds = [...new Set(aiMessages.map((m) => m.conversation_id).filter(Boolean))] as string[];
      const { data: incoming, error: inErr } = convIds.length
        ? await supabase.from("imphq_wa_messages").select("id, conversation_id, project_id, content, created_at, sent_by, direction")
          .in("conversation_id", convIds).eq("direction", "incoming").gte("created_at", new Date(Date.parse(since) - 86_400_000).toISOString()).limit(1000)
        : { data: [], error: null };
      if (inErr) throw inErr;
      const { data: feedback, error: fbErr } = await supabase.from("imphq_ai_feedback").select("item_kind, item_id, verdict, correcao").gte("created_at", new Date(Date.parse(since) - 86_400_000).toISOString());
      if (fbErr) throw fbErr;
      return buildAiFeed({
        aiMessages, incoming: (incoming ?? []) as WaMessageRow[], sales: (salesRes.data ?? []) as SaleRow[],
        knowledge: (kbRes.data ?? []) as KnowledgeRow[], actions: (actRes.data ?? []) as ActionRow[],
        feedback: (feedback ?? []) as FeedbackRow[], since,
      });
    },
  });
}

export interface FeedbackInput { item: FeedItem; verdict: "ok" | "diferente"; correcao?: string }

/**
 * Revisão do time. Resposta no WhatsApp: o wa-feedback-learn já existente aprende (👍 vira par no acervo; correção vira
 * resposta ou regra). Acervo com "faria diferente": a resposta sai do acervo. Tudo fica registrado em imphq_ai_feedback.
 */
export function useAiFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, verdict, correcao }: FeedbackInput) => {
      const texto = correcao?.trim() || null;
      if (verdict === "diferente" && !texto && item.kind !== "acervo") throw new Error("Escreva como você faria");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("imphq_ai_feedback").upsert({
        item_kind: item.kind, item_id: item.id, project_id: item.project_id, verdict, correcao: texto, actor: auth.user?.email ?? null,
      }, { onConflict: "item_kind,item_id" });
      if (error) throw error;
      if (item.kind === "resposta_wa") {
        const { error: fnErr } = await supabase.functions.invoke("wa-feedback-learn", {
          body: { message_id: item.id, feedback: verdict === "ok" ? "good" : "bad", correction: texto ?? undefined, project_id: item.project_id, correction_type: "auto" },
        });
        if (fnErr) throw fnErr;
      }
      if (item.kind === "acervo" && verdict === "diferente") {
        // Com texto: a resposta do acervo vira a do time. Sem texto: a resposta sai do acervo.
        const patch = texto ? { resposta: texto, aprovada: true } : { aprovada: false };
        const { error: kErr } = await supabase.from("imphq_wa_knowledge").update({ ...patch, answered: true, updated_at: new Date().toISOString() }).eq("id", item.id);
        if (kErr) throw kErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-feed"] }),
  });
}
