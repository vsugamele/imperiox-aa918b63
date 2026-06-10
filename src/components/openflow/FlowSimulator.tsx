import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Play, Clock, MessageCircle, Mail, Zap, Tag, GitBranch,
  Mic, Send, Loader2, User, ChevronRight, AlertCircle, CheckCircle2,
  Bell, Unlock, Brain
} from "lucide-react";
import { toast } from "sonner";

interface Automacao {
  id: string;
  nome: string;
  trigger_tipo: string;
  acoes: any[];
  ativo: boolean;
  project_id?: string;
}

interface Props {
  automacoes: Automacao[];
  projects: { id: string; name: string }[];
}

const TRIGGER_LABELS: Record<string, string> = {
  lead_novo: "Novo Lead",
  compra_aprovada: "Compra Aprovada",
  carrinho_abandonado: "Carrinho Abandonado",
  pix_gerado: "Pix Gerado",
  inicio_checkout: "Início de Checkout",
  pagamento_recusado: "Pagamento Recusado",
  reembolso: "Reembolso",
  tag_adicionada: "Tag Adicionada",
};

function stepIcon(tipo: string) {
  const map: Record<string, any> = {
    whatsapp: <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />,
    email: <Mail className="h-3.5 w-3.5 text-blue-400" />,
    audio: <Mic className="h-3.5 w-3.5 text-rose-400" />,
    ia_message: <Zap className="h-3.5 w-3.5 text-purple-400" />,
    telegram: <Send className="h-3.5 w-3.5 text-sky-400" />,
    aguardar: <Clock className="h-3.5 w-3.5 text-amber-400" />,
    delay: <Clock className="h-3.5 w-3.5 text-amber-400" />,
    adicionar_tag: <Tag className="h-3.5 w-3.5 text-indigo-400" />,
    remover_tag: <Tag className="h-3.5 w-3.5 text-rose-400" />,
    condicao: <GitBranch className="h-3.5 w-3.5 text-violet-400" />,
    wait_event: <Clock className="h-3.5 w-3.5 text-cyan-400" />,
    ab_split: <GitBranch className="h-3.5 w-3.5 text-fuchsia-400" />,
    notify_operator: <Bell className="h-3.5 w-3.5 text-blue-400" />,
    abrir_conversa: <Unlock className="h-3.5 w-3.5 text-teal-400" />,
    gpt_prompt: <Brain className="h-3.5 w-3.5 text-green-400" />,
  };
  return map[tipo] || <Zap className="h-3.5 w-3.5 text-muted-foreground" />;
}

function renderStepPreview(step: any, lead: any) {
  const replacePlaceholders = (text: string) => {
    return (text || "")
      .replace(/\{\{nome\}\}/gi, lead.nome || "Lead")
      .replace(/\{\{name\}\}/gi, lead.nome || "Lead")
      .replace(/\{\{primeiro_nome\}\}/gi, (lead.nome || "Lead").split(" ")[0])
      .replace(/\{\{email\}\}/gi, lead.email || "")
      .replace(/\{\{phone\}\}/gi, lead.phone || "")
      .replace(/\{\{produto\}\}/gi, lead.produto || "")
      .replace(/\{\{valor\}\}/gi, lead.valor || "")
      .replace(/\{\{link\}\}/gi, lead.link || "[link de pagamento]");
  };

  if (step.tipo === "aguardar" || step.tipo === "delay") {
    const mins = step.delay_min || step.aguardar_min || step.minutos || 0;
    if (mins >= 1440) return `Aguardar ${Math.round(mins / 1440)} dia(s)`;
    if (mins >= 60) return `Aguardar ${Math.round(mins / 60)}h`;
    return `Aguardar ${mins} min`;
  }

  if (step.tipo === "adicionar_tag") return `Adicionar tag: "${step.tag || step.valor || ""}"`;
  if (step.tipo === "remover_tag") return `Remover tag: "${step.tag || step.valor || ""}"`;
  if (step.tipo === "condicao") return `Condição: ${step.condicao || step.condicao_tipo || ""}`;
  if (step.tipo === "wait_event" || step.tipo === "wait_until_event") return `Aguardar evento: "${step.event_name || 'não configurado'}" (timeout: ${step.timeout_min || 60}m)`;
  if (step.tipo === "ab_split") return `Divisão A/B: ${step.rota_a_porcentagem ?? 50}% Rota A (pular ${step.jump_steps ?? 1} se Rota B)`;
  if (step.tipo === "ia_message") return `IA conversacional — gera mensagem personalizada para ${lead.nome || "Lead"}`;
  if (step.tipo === "notify_operator") return `Notificar Atendente (${step.operator_name || "Todos"}): "${replacePlaceholders(step.template || "")}"`;
  if (step.tipo === "abrir_conversa") return `Abrir conversa no Inbox e pausar autoresponder de IA`;
  if (step.tipo === "gpt_prompt") return `Prompt GPT (${step.gpt_model || "gpt-4o"}): "${replacePlaceholders(step.template || "")}" -> Salvar em ${step.gpt_save_variable || "resumo"}`;

  const text = step.mensagem || step.corpo || step.assunto || step.text || step.content || "";
  return replacePlaceholders(text) || `[${step.tipo} — conteúdo não configurado]`;
}

function stepLabel(tipo: string) {
  const labels: Record<string, string> = {
    whatsapp: "WhatsApp",
    email: "Email",
    audio: "Áudio WA",
    ia_message: "IA Mensagem",
    telegram: "Telegram",
    aguardar: "Aguardar",
    delay: "Aguardar",
    adicionar_tag: "Adicionar Tag",
    remover_tag: "Remover Tag",
    condicao: "Condição",
    wait_event: "Espera de Evento",
    ab_split: "Divisão A/B",
    notify_operator: "Notificar Atendente",
    abrir_conversa: "Abrir Conversa",
    gpt_prompt: "Executar Prompt GPT",
  };
  return labels[tipo] || tipo;
}

export function FlowSimulator({ automacoes, projects }: Props) {
  const [selectedAutoId, setSelectedAutoId] = useState("");
  const [triggerEvento, setTriggerEvento] = useState("compra_aprovada");
  const [leadSearch, setLeadSearch] = useState("");
  const [foundLeads, setFoundLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const selectedAuto = automacoes.find(a => a.id === selectedAutoId);

  const searchLeads = async () => {
    if (!leadSearch.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("imphq_leads")
      .select("id, nome, phone, email, status, score, tags, data")
      .or(`nome.ilike.%${leadSearch}%,phone.ilike.%${leadSearch}%,email.ilike.%${leadSearch}%`)
      .limit(5);
    setFoundLeads(data || []);
    setSearching(false);
    if ((data || []).length === 0) toast.info("Nenhum lead encontrado");
  };

  const simulate = () => {
    if (!selectedAuto) { toast.error("Selecione um fluxo"); return; }
    setSimulating(true);
    setSimResult(null);

    setTimeout(() => {
      const lead = selectedLead || {
        nome: "Maria Exemplo",
        email: "maria@exemplo.com",
        phone: "11999999999",
        produto: "Produto Demo",
        valor: "R$ 197",
        link: "https://checkout.exemplo.com/pay",
      };

      const steps = (selectedAuto.acoes || []).map((step: any, idx: number) => ({
        index: idx + 1,
        tipo: step.tipo,
        label: stepLabel(step.tipo),
        preview: renderStepPreview(step, lead),
        raw: step,
      }));

      const totalDelay = steps
        .filter((s: any) => s.tipo === "aguardar" || s.tipo === "delay")
        .reduce((acc: number, s: any) => acc + (s.raw.delay_min || s.raw.aguardar_min || s.raw.minutos || 0), 0);

      const messageSteps = steps.filter((s: any) => ["whatsapp", "email", "audio", "ia_message", "telegram"].includes(s.tipo));

      setSimResult({
        auto: selectedAuto,
        trigger: triggerEvento,
        lead,
        steps,
        totalDelay,
        messageCount: messageSteps.length,
        stats: {
          total: steps.length,
          messages: messageSteps.length,
          delays: steps.filter((s: any) => s.tipo === "aguardar" || s.tipo === "delay").length,
          conditions: steps.filter((s: any) => s.tipo === "condicao").length,
          tags: steps.filter((s: any) => s.tipo === "adicionar_tag" || s.tipo === "remover_tag").length,
        }
      });
      setSimulating(false);
    }, 400);
  };

  return (
    <div className="space-y-4">
      {/* Config panel */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" /> Configurar Simulação
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Fluxo a simular</Label>
              <Select value={selectedAutoId} onValueChange={setSelectedAutoId}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue placeholder="Selecione um fluxo..." />
                </SelectTrigger>
                <SelectContent>
                  {automacoes.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.ativo ? "⚡" : "⏸"} {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Evento de gatilho</Label>
              <Select value={triggerEvento} onValueChange={setTriggerEvento}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lead selector */}
          <div>
            <Label className="text-xs">Lead real para prévia (opcional)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                className="h-8 text-sm flex-1"
                placeholder="Nome, email ou telefone..."
                value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchLeads()}
              />
              <Button size="sm" variant="outline" className="h-8" onClick={searchLeads} disabled={searching}>
                {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Buscar"}
              </Button>
            </div>

            {foundLeads.length > 0 && (
              <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
                {foundLeads.map(l => (
                  <button
                    key={l.id}
                    onClick={() => { setSelectedLead(l); setFoundLeads([]); }}
                    className={`w-full text-left px-3 py-2 rounded text-xs border transition-colors
                      ${selectedLead?.id === l.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card hover:border-primary/40 text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <span className="font-medium">{l.nome}</span>
                    <span className="ml-2 opacity-60">{l.phone || l.email}</span>
                    {l.status && <Badge variant="outline" className="ml-2 text-[9px]">{l.status}</Badge>}
                    {l.score && <span className="ml-1 text-[10px] text-primary">score {l.score}</span>}
                  </button>
                ))}
              </div>
            )}

            {selectedLead && (
              <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded bg-primary/5 border border-primary/20">
                <User className="h-3 w-3 text-primary shrink-0" />
                <span className="text-xs text-foreground font-medium">{selectedLead.nome}</span>
                <span className="text-xs text-muted-foreground">{selectedLead.phone || selectedLead.email}</span>
                <button
                  className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedLead(null)}
                >remover</button>
              </div>
            )}
          </div>

          <Button
            className="w-full h-8"
            onClick={simulate}
            disabled={!selectedAutoId || simulating}
          >
            {simulating
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Simulando...</>
              : <><Play className="h-3.5 w-3.5 mr-1.5" /> Simular Fluxo</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      {simResult && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Resultado da Simulação</CardTitle>
              <div className="flex gap-2">
                {simResult.auto.ativo
                  ? <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/25">Fluxo ativo</Badge>
                  : <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/25">Fluxo pausado</Badge>
                }
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {/* Header info */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Trigger:</span>
                <span className="text-foreground font-medium">{TRIGGER_LABELS[simResult.trigger] || simResult.trigger}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Lead:</span>
                <span className="text-foreground font-medium">{simResult.lead.nome}</span>
                {simResult.lead.email && <span className="text-muted-foreground">· {simResult.lead.email}</span>}
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Passos", value: simResult.stats.total, icon: ChevronRight },
                { label: "Mensagens", value: simResult.stats.messages, icon: MessageCircle },
                { label: "Delays", value: simResult.stats.delays, icon: Clock },
                { label: "Condições", value: simResult.stats.conditions, icon: GitBranch },
              ].map(s => (
                <div key={s.label} className="bg-muted/20 rounded p-2 text-center">
                  <p className="text-base font-semibold text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {simResult.totalDelay > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Tempo total de espera: {simResult.totalDelay >= 1440
                  ? `${Math.round(simResult.totalDelay / 1440)} dia(s)`
                  : simResult.totalDelay >= 60
                    ? `${Math.round(simResult.totalDelay / 60)}h`
                    : `${simResult.totalDelay} min`}
              </p>
            )}

            <Separator />

            {/* Steps timeline */}
            {simResult.steps.length === 0 ? (
              <div className="text-center py-4">
                <AlertCircle className="h-6 w-6 text-amber-400 mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">Este fluxo não tem ações configuradas.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground mb-3">Jornada do lead:</p>
                {simResult.steps.map((step: any, idx: number) => (
                  <div key={idx} className="flex gap-3">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted/40 border border-border text-[10px] text-muted-foreground shrink-0">
                        {step.index}
                      </div>
                      {idx < simResult.steps.length - 1 && (
                        <div className="w-px h-full bg-border/40 mt-1 min-h-3" />
                      )}
                    </div>

                    {/* Step card */}
                    <div className={`flex-1 rounded-lg border p-2.5 mb-1 ${
                      step.tipo === "aguardar" || step.tipo === "delay"
                        ? "border-amber-500/20 bg-amber-500/5"
                        : step.tipo === "condicao"
                          ? "border-violet-500/20 bg-violet-500/5"
                          : step.tipo === "wait_event"
                            ? "border-cyan-500/20 bg-cyan-500/5"
                            : step.tipo === "ab_split"
                              ? "border-fuchsia-500/20 bg-fuchsia-500/5"
                              : step.tipo === "adicionar_tag" || step.tipo === "remover_tag"
                                ? "border-indigo-500/20 bg-indigo-500/5"
                                : step.tipo === "ia_message"
                                  ? "border-purple-500/20 bg-purple-500/5"
                                  : "border-border/60 bg-muted/10"
                    }`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        {stepIcon(step.tipo)}
                        <span className="text-[11px] font-medium text-foreground">{step.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                        {step.preview}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Final */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 shrink-0">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    </div>
                  </div>
                  <div className="flex-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                    <p className="text-xs text-emerald-400 font-medium">Fluxo concluído</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {simResult.stats.messages} mensagem{simResult.stats.messages !== 1 ? "s" : ""} enviada{simResult.stats.messages !== 1 ? "s" : ""} para {simResult.lead.nome}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
