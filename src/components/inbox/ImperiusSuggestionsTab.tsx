import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Flame, Clock, RefreshCw, MessageSquare, DollarSign,
  TrendingDown, ExternalLink, Loader2, Brain,
} from "lucide-react";
import { toast } from "sonner";

// ── Tipos ────────────────────────────────────────────────────────────────────
type SuggestionKind =
  | "pix_pending"        // PIX/Boleto gerado, sem venda paga
  | "hot_cooling"        // Hot lead sem outbound recente
  | "awaiting_reply"     // Cliente esperando há tempo
  | "pitch_no_buy"       // Pitch enviado sem compra
  | "post_sale"          // Pós-venda sem follow-up
  ;

interface Suggestion {
  id: string;                 // chave única
  kind: SuggestionKind;
  priority: number;           // 0-100
  lead_id?: string | null;
  conversation_id?: string | null;
  project_id?: string | null;
  contact_name: string;
  phone?: string | null;
  title: string;              // ex: "Reabordar PIX gerado há 3h"
  reason: string;             // contexto
  suggested_action: string;   // ação concreta
  context: Record<string, any>;
  created_at: string;         // referência do evento
}

// ── Heurísticas ──────────────────────────────────────────────────────────────
async function buildSuggestions(): Promise<Suggestion[]> {
  const now = Date.now();
  const hAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
  const out: Suggestion[] = [];

  // 1. PIX/Boleto gerado há 2-48h sem venda aprovada
  const { data: intents } = await supabase
    .from("imphq_vendas")
    .select("id, project_id, lead_id, status, last_intent_at, valor, produto_nome, comprador_nome, comprador_telefone, created_at")
    .neq("status", "aprovado")
    .gte("last_intent_at", hAgo(48))
    .lt("last_intent_at", hAgo(2))
    .order("last_intent_at", { ascending: false })
    .limit(30);

  (intents || []).forEach((v: any) => {
    const hoursAgo = Math.round((now - new Date(v.last_intent_at).getTime()) / 3600_000);
    out.push({
      id: `pix-${v.id}`,
      kind: "pix_pending",
      priority: 95 - hoursAgo,
      lead_id: v.lead_id,
      project_id: v.project_id,
      contact_name: v.comprador_nome || "Lead",
      phone: v.comprador_telefone,
      title: `PIX/Boleto gerado há ${hoursAgo}h sem pagamento`,
      reason: `${v.produto_nome || "Produto"} · R$ ${v.valor || 0}`,
      suggested_action: "Reabordar com urgência sutil (escassez/garantia)",
      context: v,
      created_at: v.last_intent_at,
    });
  });

  // 2. Hot leads (score>80) das últimas 24h sem outbound nas últimas 4h
  const { data: hot } = await supabase
    .from("imphq_leads")
    .select("id, nome, phone, score, project_id, criado_em, data")
    .gt("score", 80)
    .gte("criado_em", hAgo(24))
    .order("score", { ascending: false })
    .limit(30);

  for (const lead of hot || []) {
    const phone = (lead as any).phone?.replace(/\D/g, "");
    if (!phone) continue;
    const { data: lastMsg } = await supabase
      .from("imphq_wa_messages")
      .select("created_at, direction")
      .ilike("from_number", `%${phone.slice(-10)}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastTs = lastMsg ? new Date(lastMsg.created_at).getTime() : 0;
    if (lastTs && now - lastTs < 4 * 3600_000) continue;
    out.push({
      id: `hot-${lead.id}`,
      kind: "hot_cooling",
      priority: Math.min(90, (lead.score || 80)),
      lead_id: lead.id,
      project_id: (lead as any).project_id,
      contact_name: lead.nome || "Lead quente",
      phone: (lead as any).phone,
      title: `Lead quente esfriando · score ${lead.score}`,
      reason: `Sem contato há ${lastTs ? Math.round((now - lastTs) / 3600_000) + "h" : "muito tempo"}`,
      suggested_action: "Mensagem pessoal de retomada + oferta principal",
      context: lead,
      created_at: lead.criado_em,
    });
  }

  // 3. Conversas abertas com último inbound > 1h e sem outbound depois
  const { data: convs } = await supabase
    .from("imphq_wa_conversations")
    .select("id, project_id, lead_id, contact_name, phone, last_message_at, last_inbound_at, last_outbound_at, ai_paused")
    .neq("status", "closed")
    .lt("last_inbound_at", hAgo(1))
    .gte("last_inbound_at", hAgo(24))
    .order("last_inbound_at", { ascending: false })
    .limit(30);

  (convs || []).forEach((c: any) => {
    const inboundT = new Date(c.last_inbound_at).getTime();
    const outboundT = c.last_outbound_at ? new Date(c.last_outbound_at).getTime() : 0;
    if (outboundT > inboundT) return;
    const hoursAgo = Math.round((now - inboundT) / 3600_000);
    out.push({
      id: `await-${c.id}`,
      kind: "awaiting_reply",
      priority: 85 - hoursAgo * 2,
      lead_id: c.lead_id,
      conversation_id: c.id,
      project_id: c.project_id,
      contact_name: c.contact_name || c.phone,
      phone: c.phone,
      title: `Cliente aguarda resposta há ${hoursAgo}h`,
      reason: c.ai_paused ? "IA pausada — humano deve assumir" : "Sem resposta automática registrada",
      suggested_action: "Responder agora ou reativar IA",
      context: c,
      created_at: c.last_inbound_at,
    });
  });

  // 4. Pitch enviado sem compra (followup stage ativo)
  const { data: pitches } = await supabase
    .from("imphq_wa_conversations")
    .select("id, project_id, lead_id, contact_name, phone, last_pitch_at, last_pitch_produto, pitch_followup_stage")
    .not("last_pitch_at", "is", null)
    .gte("last_pitch_at", hAgo(72))
    .lt("last_pitch_at", hAgo(24))
    .in("pitch_followup_stage", [0, 1, 2])
    .limit(30);

  (pitches || []).forEach((p: any) => {
    const hoursAgo = Math.round((now - new Date(p.last_pitch_at).getTime()) / 3600_000);
    out.push({
      id: `pitch-${p.id}`,
      kind: "pitch_no_buy",
      priority: 70 - Math.floor(hoursAgo / 6),
      lead_id: p.lead_id,
      conversation_id: p.id,
      project_id: p.project_id,
      contact_name: p.contact_name || p.phone,
      phone: p.phone,
      title: `Pitch há ${hoursAgo}h sem compra — stage ${p.pitch_followup_stage}`,
      reason: `Produto: ${p.last_pitch_produto || "—"}`,
      suggested_action: hoursAgo > 48 ? "Oferecer downsell ou parcelamento" : "Tratar objeção principal",
      context: p,
      created_at: p.last_pitch_at,
    });
  });

  // Dedup por lead_id+kind, ordena por prioridade
  const seen = new Set<string>();
  return out
    .filter((s) => {
      const k = `${s.kind}-${s.lead_id || s.conversation_id || s.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 25);
}

// ── UI ───────────────────────────────────────────────────────────────────────
const KIND_META: Record<SuggestionKind, { icon: any; color: string; label: string }> = {
  pix_pending:    { icon: DollarSign,   color: "text-emerald-400 border-emerald-500/30", label: "PIX pendente" },
  hot_cooling:    { icon: Flame,        color: "text-orange-400 border-orange-500/30",   label: "Hot esfriando" },
  awaiting_reply: { icon: Clock,        color: "text-amber-400 border-amber-500/30",     label: "Aguardando" },
  pitch_no_buy:   { icon: TrendingDown, color: "text-rose-400 border-rose-500/30",       label: "Pitch s/ compra" },
  post_sale:      { icon: MessageSquare,color: "text-sky-400 border-sky-500/30",         label: "Pós-venda" },
};

export default function ImperiusSuggestionsTab() {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiTexts, setAiTexts] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await buildSuggestions();
      setItems(data);
    } catch (e: any) {
      toast.error("Falha ao carregar sugestões: " + (e?.message || e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (items || []).forEach((s) => { c[s.kind] = (c[s.kind] || 0) + 1; });
    return c;
  }, [items]);

  async function generateAiCopy(s: Suggestion) {
    setAiLoading(s.id);
    try {
      const { data, error } = await supabase.functions.invoke("imperius-copilot", {
        body: {
          mode: "next_action_copy",
          context: {
            contact_name: s.contact_name,
            kind: s.kind,
            title: s.title,
            reason: s.reason,
            suggested_action: s.suggested_action,
            project_id: s.project_id,
            extra: s.context,
          },
        },
      });
      if (error) throw error;
      const txt = (data as any)?.message || (data as any)?.text || "—";
      setAiTexts((prev) => ({ ...prev, [s.id]: txt }));
    } catch (e: any) {
      // Fallback heurístico
      const fallback = `Oi ${s.contact_name?.split(" ")[0] || ""}, tudo bem? ${s.suggested_action}`;
      setAiTexts((prev) => ({ ...prev, [s.id]: fallback }));
      toast.message("Usando rascunho local (IA indisponível)");
    } finally {
      setAiLoading(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  }

  function openConversation(s: Suggestion) {
    if (s.phone) {
      const p = s.phone.replace(/\D/g, "");
      window.open(`https://wa.me/${p}`, "_blank");
    } else if (s.lead_id) {
      window.location.href = `/leads?id=${s.lead_id}`;
    }
  }

  if (loading && !items) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="h-7 w-7 text-primary animate-spin" />
        <span className="text-xs text-muted-foreground">Imperius analisando o pipeline...</span>
      </div>
    );
  }

  if (items && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-6">
        <Sparkles className="h-12 w-12 text-muted-foreground/30" />
        <div>
          <p className="font-display text-lg text-foreground/70">Tudo sob controle</p>
          <p className="text-sm text-muted-foreground mt-1">
            Nenhuma ação urgente sugerida agora. Imperius continua monitorando.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Recalcular
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          {items?.length || 0} próximas ações sugeridas por Imperius
        </h2>
        <div className="flex items-center gap-2">
          {Object.entries(counts).map(([k, v]) => {
            const meta = KIND_META[k as SuggestionKind];
            const Icon = meta?.icon || Sparkles;
            return (
              <Badge key={k} variant="outline" className={`text-[10px] ${meta?.color || ""}`}>
                <Icon className="h-3 w-3 mr-1" />
                {meta?.label || k} · {v}
              </Badge>
            );
          })}
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5 h-7" disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Atualizar
          </Button>
        </div>
      </div>

      <div className="space-y-2.5">
        {(items || []).map((s) => {
          const meta = KIND_META[s.kind];
          const Icon = meta.icon;
          return (
            <Card key={s.id} className="bg-secondary/40 border-border card-hover-gold">
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${meta.color}`}>
                        <Icon className="h-3 w-3 mr-1" />
                        {meta.label}
                      </Badge>
                      <span className="font-semibold text-foreground">{s.contact_name}</span>
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                        prioridade {s.priority}
                      </Badge>
                    </div>
                    <div className="text-sm text-foreground/85 mt-1.5 leading-6">{s.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-6">
                      {s.reason} · <span className="text-foreground/70">{s.suggested_action}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5"
                      onClick={() => openConversation(s)}>
                      <ExternalLink className="h-3 w-3" /> Abrir
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5"
                      disabled={aiLoading === s.id}
                      onClick={() => generateAiCopy(s)}>
                      {aiLoading === s.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Sparkles className="h-3 w-3 text-primary" />}
                      Rascunho IA
                    </Button>
                  </div>
                </div>

                {aiTexts[s.id] && (
                  <div className="bg-background/50 border border-border/60 rounded-md p-3 text-xs leading-6 text-foreground/85 whitespace-pre-wrap">
                    {aiTexts[s.id]}
                    <div className="flex justify-end mt-2 gap-2">
                      <Button size="sm" variant="ghost" className="text-[10px] h-6"
                        onClick={() => copyToClipboard(aiTexts[s.id])}>
                        Copiar
                      </Button>
                      {s.phone && (
                        <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1"
                          onClick={() => {
                            const p = s.phone!.replace(/\D/g, "");
                            const url = `https://wa.me/${p}?text=${encodeURIComponent(aiTexts[s.id])}`;
                            window.open(url, "_blank");
                          }}>
                          <MessageSquare className="h-3 w-3" /> Enviar no WA
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
