import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  conversationId: string;
}

export default function ConversationIntelCard({ conversationId }: Props) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = async (force = false) => {
    if (!conversationId) return;
    if (!force) {
      const { data } = await supabase
        .from("imphq_wa_conversations")
        .select("ai_summary, ai_summary_updated_at, intent_tags")
        .eq("id", conversationId)
        .maybeSingle();
      if (data) {
        setSummary(data.ai_summary || "");
        setTags(data.intent_tags || []);
        setUpdatedAt(data.ai_summary_updated_at || null);
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
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  return (
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
  );
}
