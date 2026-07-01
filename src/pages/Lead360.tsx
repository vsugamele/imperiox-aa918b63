import { useParams, Link } from "react-router-dom";
import { useLead360, type Lead360Event } from "@/hooks/useLead360";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MousePointerClick, Eye, FileText, MessageCircle, DollarSign, Bot, Sparkles, Loader2, Copy } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

const ICONS: Record<Lead360Event["kind"], any> = {
  click: MousePointerClick,
  event: Eye,
  form_response: FileText,
  wa_message: MessageCircle,
  venda: DollarSign,
  ai_action: Bot,
  prediction: Sparkles,
};

const COLORS: Record<Lead360Event["kind"], string> = {
  click: "text-blue-400",
  event: "text-muted-foreground",
  form_response: "text-amber-400",
  wa_message: "text-emerald-400",
  venda: "text-yellow-400",
  ai_action: "text-purple-400",
  prediction: "text-pink-400",
};

const KIND_LABEL: Record<Lead360Event["kind"], string> = {
  click: "Clique",
  event: "Evento",
  form_response: "Resposta de form",
  wa_message: "WhatsApp",
  venda: "Venda",
  ai_action: "Ação IA",
  prediction: "Predição",
};

export default function Lead360Page() {
  const { id } = useParams();
  const { data, isLoading, error } = useLead360(id);
  const [aiInput, setAiInput] = useState("Redija mensagem de WhatsApp curta para reengajar este lead.");
  const [aiOut, setAiOut] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const lead = data?.lead;
  const timeline = data?.timeline || [];

  async function runCopyEngine() {
    if (!lead) return;
    setAiLoading(true);
    setAiOut("");
    try {
      const { data: res, error } = await supabase.functions.invoke("copy-engine", {
        body: {
          intent: "campanha_wa",
          input: aiInput,
          context: { project_id: lead.projeto_id, lead_id: String(lead.id) },
        },
      });
      if (error) throw error;
      setAiOut((res as any)?.content || "(sem resposta)");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar");
    } finally {
      setAiLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando Lead 360°…
      </div>
    );
  }
  if (error || !lead) {
    return (
      <div className="p-8">
        <p className="text-destructive">Lead não encontrado.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/leads"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/leads"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-3xl font-serif">{lead.nome || lead.email || "Lead sem nome"}</h1>
            <p className="text-sm text-muted-foreground">{lead.email} · {lead.phone}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {lead.status && <Badge variant="secondary">{lead.status}</Badge>}
          {lead.score != null && <Badge>Score {lead.score}</Badge>}
        </div>
      </div>

      <KpiStrip timeline={timeline} />

      <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr,360px] gap-6">
        {/* Identidade */}
        <Card>
          <CardHeader><CardTitle className="text-base">Identidade</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Origem" value={lead.origem} />
            <Field label="Estágio" value={lead.estagio} />
            <Field label="Plataforma" value={lead.plataforma} />
            <Field label="Último produto" value={lead.ultimo_produto} />
            <Field label="UTM source" value={lead.utm_source} />
            <Field label="UTM campaign" value={lead.utm_campaign} />
            <Field label="Criado em" value={lead.created_at && format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader><CardTitle className="text-base">Timeline ({timeline.length})</CardTitle></CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
            ) : (
              <ol className="relative border-l border-border space-y-4 pl-6">
                {timeline.map((ev, i) => {
                  const Icon = ICONS[ev.kind] || Eye;
                  return (
                    <li key={i} className="relative">
                      <span className={`absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full bg-secondary ${COLORS[ev.kind]}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{KIND_LABEL[ev.kind]}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(ev.at), "dd/MM HH:mm", { locale: ptBR })}</span>
                      </div>
                      <p className="text-sm mt-1 leading-6">{summarize(ev)}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* IA */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Ações IA</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={aiInput} onChange={(e) => setAiInput(e.target.value)} rows={3} />
            <Button onClick={runCopyEngine} disabled={aiLoading} className="w-full">
              {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Gerar mensagem WA
            </Button>
            {aiOut && (
              <div className="space-y-2">
                <div className="rounded-md bg-secondary/40 p-3 text-sm leading-7 whitespace-pre-wrap">{aiOut}</div>
                <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => { navigator.clipboard.writeText(aiOut); toast.success("Copiado"); }}>
                  <Copy className="h-3.5 w-3.5" /> Copiar mensagem
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{String(value)}</p>
    </div>
  );
}

function KpiStrip({ timeline }: { timeline: Lead360Event[] }) {
  const vendas = timeline.filter((e) => e.kind === "venda");
  const totalReceita = vendas.reduce((s, e) => s + Number(e.data?.valor || 0), 0);
  const vendasOk = vendas.filter((e) => ["aprovado", "approved", "paid"].includes(String(e.data?.status || "").toLowerCase()));
  const msgs = timeline.filter((e) => e.kind === "wa_message").length;
  const cliques = timeline.filter((e) => e.kind === "click").length;
  const ultimo = timeline[0];
  const origem = timeline.slice().reverse().find((e) => e.kind === "click");
  const utmSrc = origem?.data?.utm_source || "—";
  const utmCamp = origem?.data?.utm_campaign || "";

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Kpi label="Receita" value={`R$ ${totalReceita.toFixed(2)}`} sub={`${vendasOk.length}/${vendas.length} aprovadas`} />
      <Kpi label="Mensagens WA" value={String(msgs)} />
      <Kpi label="Cliques" value={String(cliques)} />
      <Kpi label="Origem" value={String(utmSrc)} sub={String(utmCamp).slice(0, 40)} />
      <Kpi label="Última atividade" value={ultimo ? format(new Date(ultimo.at), "dd/MM HH:mm", { locale: ptBR }) : "—"} sub={ultimo?.kind || ""} />
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base font-semibold mt-0.5 truncate">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

function summarize(ev: Lead360Event): string {
  const d = ev.data || {};
  switch (ev.kind) {
    case "click": return `${d.utm_source || "?"} · ${d.utm_campaign || "—"}${d.page_url ? ` · ${d.page_url}` : ""}`;
    case "event": return `${d.event_type || "evento"}${d.page_url ? ` · ${d.page_url}` : ""}`;
    case "form_response": return `Form ${d.form_id || ""}`;
    case "wa_message": return `${d.from_me ? "→" : "←"} ${d.body || "(mídia)"}`;
    case "venda": return `${d.produto || "Venda"} · R$ ${Number(d.valor || 0).toFixed(2)} · ${d.status || ""}`;
    case "ai_action": return `${d.action_type || "ação"} · ${d.status || ""}${d.summary ? ` — ${d.summary}` : ""}`;
    case "prediction": return `Score ${d.score ?? "?"} · ${d.next_action || ""}`;
    default: return JSON.stringify(d).slice(0, 200);
  }
}
