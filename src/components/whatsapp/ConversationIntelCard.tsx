import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, Loader2, AlertTriangle, Target, Heart, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  conversationId: string;
}

interface HandoffSummary {
  status?: string;
  dor?: string;
  proxima_acao?: string;
  score?: string;
  contexto?: string;
}

const intentLabel: Record<string, string> = {
  descoberta: "🔍 Descoberta",
  consideracao: "🤔 Considerando",
  decisao: "⚖️ Decisão",
  objecao: "🛑 Objeção",
  pronto_para_comprar: "🔥 Pronto p/ comprar",
  suporte: "🛠️ Suporte",
  saudacao: "👋 Saudação",
  outro: "💬 Outro",
};

const emotionEmoji: Record<string, string> = {
  animado: "😄",
  curioso: "🤓",
  cetico: "🤨",
  frustrado: "😤",
  ansioso: "😬",
  neutro: "😐",
  comprador: "🤑",
};

export default function ConversationIntelCard({ conversationId }: Props) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [currentIntent, setCurrentIntent] = useState<string | null>(null);
  const [handoffSummary, setHandoffSummary] = useState<HandoffSummary | null>(null);
  const [handoffAt, setHandoffAt] = useState<string | null>(null);
  const [emotional, setEmotional] = useState<string | null>(null);
  const [lastObjection, setLastObjection] = useState<string | null>(null);

  const loadEmotional = async (lid: string) => {
    const { data } = await supabase
      .from("imphq_wa_lead_memories")
      .select("emotional_state, last_objection, created_at")
      .eq("lead_id", lid)
      .eq("memory_type", "emotional_snapshot")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setEmotional((data as any).emotional_state || null);
      setLastObjection((data as any).last_objection || null);
    }
  };

  const load = async (force = false) => {
    if (!conversationId) return;
    if (!force) {
      const { data } = await supabase
        .from("imphq_wa_conversations")
        .select("ai_summary, ai_summary_updated_at, intent_tags, current_intent, intent_updated_at, handoff_summary, handoff_at, lead_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (data) {
        setSummary(data.ai_summary || "");
        setTags(data.intent_tags || []);
        setUpdatedAt(data.ai_summary_updated_at || null);
        setCurrentIntent((data as any).current_intent || null);
        setHandoffSummary(((data as any).handoff_summary as HandoffSummary) || null);
        setHandoffAt((data as any).handoff_at || null);
        const lid = (data as any).lead_id || null;
        if (lid) loadEmotional(lid);
        if (data.ai_summary) return;
      }
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wa-conv-intel", {
        body: { conversation_id: conversationId, force },
      });
      if (!error && data) {
        setSummary(data.summary || "");
        setTags(data.intent_tags || []);
        setUpdatedAt(new Date().toISOString());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSummary(""); setTags([]); setUpdatedAt(null);
    setCurrentIntent(null); setHandoffSummary(null); setHandoffAt(null);
    setEmotional(null); setLastObjection(null);
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const scoreColor = handoffSummary?.score === "quente" ? "bg-red-500/20 text-red-300 border-red-500/40"
    : handoffSummary?.score === "morno" ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
    : "bg-blue-500/20 text-blue-300 border-blue-500/40";

  return (
    <div className="space-y-2">
      {handoffSummary && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              Handoff para humano
            </div>
            {handoffSummary.score && (
              <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${scoreColor}`}>
                {handoffSummary.score}
              </Badge>
            )}
          </div>
          {handoffSummary.contexto && (
            <p className="text-xs leading-5 text-foreground/90">{handoffSummary.contexto}</p>
          )}
          <div className="grid gap-1 pt-1 text-[11px] text-foreground/80">
            {handoffSummary.dor && <div><span className="text-amber-300/80">Dor:</span> {handoffSummary.dor}</div>}
            {handoffSummary.proxima_acao && <div><span className="text-amber-300/80">Próxima ação:</span> {handoffSummary.proxima_acao}</div>}
          </div>
          {handoffAt && (
            <p className="text-[10px] text-amber-200/60 pt-0.5">
              {formatDistanceToNow(new Date(handoffAt), { addSuffix: true, locale: ptBR })}
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg border bg-secondary/40 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Inteligência da conversa
          </div>
          <Button
            size="sm" variant="ghost" className="h-6 px-2 text-xs"
            onClick={() => load(true)} disabled={loading}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </div>

        {(currentIntent || emotional) && (
          <div className="flex flex-wrap gap-1.5">
            {currentIntent && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 gap-1">
                <Target className="h-2.5 w-2.5" />
                {intentLabel[currentIntent] || currentIntent}
              </Badge>
            )}
            {emotional && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 gap-1">
                <Heart className="h-2.5 w-2.5" />
                {emotionEmoji[emotional] || ""} {emotional}
              </Badge>
            )}
          </div>
        )}

        {lastObjection && (
          <div className="text-[11px] text-foreground/70 border-l-2 border-amber-500/40 pl-2">
            <span className="text-amber-300/80">Última objeção:</span> {lastObjection}
          </div>
        )}

        {summary ? (
          <p className="text-xs leading-5 text-foreground/90 whitespace-pre-wrap">{summary}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {loading ? "Gerando resumo..." : "Clique para gerar resumo."}
          </p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] py-0 px-1.5">
                {t.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        )}

        {updatedAt && (
          <p className="text-[10px] text-muted-foreground">
            Atualizado {formatDistanceToNow(new Date(updatedAt), { addSuffix: true, locale: ptBR })}
          </p>
        )}
      </div>
    </div>
  );
}
