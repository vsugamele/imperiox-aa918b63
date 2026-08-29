import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Flame, AlertTriangle, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type TriageItem = {
  id: string;
  intent: string | null;
  sentiment: string | null;
  urgency: string | null;
  fit_score: number | null;
  raw_message: string | null;
  ai_response: string | null;
  escalated: boolean;
  created_at: string;
  lead_id: string | null;
  projeto_id: string | null;
};

const intentLabel: Record<string, string> = {
  compra_quente: "🔥 Compra quente",
  duvida: "❓ Dúvida",
  objecao: "🛡️ Objeção",
  suporte: "🛟 Suporte",
  saudacao: "👋 Saudação",
  off_topic: "💬 Off-topic",
};

const sentColor = (s: string | null) =>
  s === "negativo" ? "bg-red-500/15 text-red-400 border-red-500/30" :
  s === "positivo" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
  "bg-muted/30 text-muted-foreground border-border";

export function TriagemPanel() {
  const [items, setItems] = useState<TriageItem[]>([]);
  const [stats, setStats] = useState({ hoje: 0, escalados: 0, hotLeads: 0 });

  const load = async () => {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("imphq_wa_triage")
      .select("id, intent, sentiment, urgency, fit_score, raw_message, ai_response, escalated, created_at, lead_id, projeto_id")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(50);
    const arr = (data as any) || [];
    setItems(arr);
    setStats({
      hoje: arr.length,
      escalados: arr.filter((x: any) => x.escalated).length,
      hotLeads: arr.filter((x: any) => x.intent === "compra_quente").length,
    });
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl text-primary">🎯 Triagem IA</h2>
        <p className="text-xs text-muted-foreground mt-1">Toda mensagem recebida é classificada antes do bot responder. Casos críticos escalam para você.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 bg-secondary/40">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Hoje</p>
          <p className="text-2xl font-bold mt-1 flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" />{stats.hoje}</p>
        </Card>
        <Card className="p-4 bg-secondary/40">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Escalados</p>
          <p className="text-2xl font-bold mt-1 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-400" />{stats.escalados}</p>
        </Card>
        <Card className="p-4 bg-secondary/40">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Hot Leads</p>
          <p className="text-2xl font-bold mt-1 flex items-center gap-2"><Flame className="h-5 w-5 text-red-400" />{stats.hotLeads}</p>
        </Card>
      </div>

      <Card className="bg-secondary/40 p-0">
        <ScrollArea className="h-[500px]">
          <div className="divide-y divide-border">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Nenhuma triagem hoje. Conecte um WhatsApp e ative o chatbot autônomo.</p>
            ) : items.map((t) => (
              <div key={t.id} className="p-4 leading-7 hover:bg-secondary/20">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{intentLabel[t.intent || ""] || t.intent || "—"}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${sentColor(t.sentiment)}`}>{t.sentiment || "—"}</Badge>
                    {t.urgency === "high" && <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30">urgente</Badge>}
                    {t.escalated && <Badge className="text-[10px] bg-primary text-primary-foreground">ESCALADO</Badge>}
                    {t.fit_score != null && <span className="text-[10px] font-mono text-muted-foreground">fit {t.fit_score}</span>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 mt-1">"{t.raw_message}"</p>
                {t.ai_response && (
                  <p className="text-xs text-emerald-400 mt-2 pl-3 border-l-2 border-emerald-500/30">
                    💡 IA sugeriu: {t.ai_response.slice(0, 200)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
