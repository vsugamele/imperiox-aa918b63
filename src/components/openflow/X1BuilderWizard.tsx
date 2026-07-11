import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditableTagList } from "@/components/projeto/EditableTagList";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, ArrowRight, ArrowLeft, Rocket } from "lucide-react";
import type { Acao } from "./FlowEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: { id: string; name: string }[];
  onCreated: (automacaoId: string) => void;
}

const STEPS = ["Gatilho", "Gancho", "Qualificação", "Oferta", "Follow-up"];

export function X1BuilderWizard({ open, onOpenChange, projects, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Passo 1 — Gatilho
  const [nome, setNome] = useState("Aquisição X1 — WhatsApp");
  const [projectId, setProjectId] = useState<string>("");
  const [triggerMode, setTriggerMode] = useState<"whatsapp_mensagem_recebida" | "whatsapp_palavra_chave">("whatsapp_palavra_chave");
  const [keywords, setKeywords] = useState<string[]>(["quero", "info", "preço"]);
  const [matchMode, setMatchMode] = useState<"any" | "all" | "exact" | "regex">("any");

  // Passo 2 — Gancho
  const [gancho, setGancho] = useState(
    "Oi {{nome}}! 👋 Vi que você demonstrou interesse. Posso te fazer 2 perguntinhas rápidas pra ver se faz sentido pra você?"
  );

  // Passo 3 — Qualificação (IA)
  const [iaPrompt, setIaPrompt] = useState(
    "Você é o vendedor consultivo do {{produto}}. Faça UMA pergunta de qualificação por vez (situação atual, principal dificuldade, urgência). Se o lead mandar áudio, escute e responda no contexto. Se mandar foto, analise. Tom humano e curto."
  );

  // Passo 4 — Oferta
  const [audioRoteiro, setAudioRoteiro] = useState(
    "Apresentação curta (60-90s) do {{produto}} focada na dor que o lead acabou de descrever. Tom consultivo, sem hype."
  );
  const [linkCheckout, setLinkCheckout] = useState("");
  const [cta, setCta] = useState("{{nome}}, separei sua condição especial: {{link}}\nQualquer dúvida me chama aqui. 🚀");

  // Passo 5 — Follow-up
  const [followUpMin, setFollowUpMin] = useState(720);
  const [followUp, setFollowUp] = useState("Oi {{nome}}, ainda dá tempo de garantir a condição de hoje. Posso reservar?");

  const canNext = () => {
    if (step === 0) return nome.trim().length >= 4 && (triggerMode === "whatsapp_mensagem_recebida" || keywords.length > 0);
    if (step === 1) return gancho.trim().length > 0;
    if (step === 2) return iaPrompt.trim().length > 0;
    if (step === 3) return cta.trim().length > 0;
    return true;
  };

  const buildAcoes = (): Acao[] => [
    { id: crypto.randomUUID(), tipo: "whatsapp", template: gancho, delay_min: 1 },
    { id: crypto.randomUUID(), tipo: "wait_reply", template: "", delay_min: 0, timeout_min: 60 } as Acao,
    {
      id: crypto.randomUUID(), tipo: "ia_message", template: iaPrompt, delay_min: 0,
      ia_vision: true, ia_voice_response: false, questioning_strategy: "consultivo_progressivo",
    } as Acao,
    { id: crypto.randomUUID(), tipo: "wait_reply", template: "", delay_min: 0, timeout_min: 120 } as Acao,
    {
      id: crypto.randomUUID(), tipo: "qualify_lead", template: "", delay_min: 0,
      lead_score: 60, lead_tags: "qualificado-x1", lead_stage: "qualificacao",
    } as Acao,
    {
      id: crypto.randomUUID(), tipo: "whatsapp",
      template: "Show, {{nome}}! Faz sentido. Deixa eu te mandar um áudio rapidinho 🎙️", delay_min: 0,
    },
    { id: crypto.randomUUID(), tipo: "audio", template: audioRoteiro, delay_min: 0 } as Acao,
    { id: crypto.randomUUID(), tipo: "aguardar", template: "", delay_min: 2 },
    { id: crypto.randomUUID(), tipo: "wait_reply", template: "", delay_min: 0, timeout_min: 180 } as Acao,
    {
      id: crypto.randomUUID(), tipo: "ia_message",
      template: "Identifique a objeção principal (preço, tempo, ceticismo, decisão de outro). Responda UMA objeção por mensagem. Se não houver objeção, ofereça o link: {{link}}",
      delay_min: 0, ia_vision: true,
    } as Acao,
    {
      id: crypto.randomUUID(), tipo: "qualify_lead", template: "", delay_min: 0,
      lead_score: 85, lead_tags: "pronto-fechamento", lead_stage: "fechamento",
    } as Acao,
    {
      id: crypto.randomUUID(), tipo: "notify_operator",
      template: "Lead quente X1 pronto para fechamento — abordar agora.",
      delay_min: 0, operator_name: "comercial",
    } as Acao,
    { id: crypto.randomUUID(), tipo: "whatsapp", template: cta, delay_min: 0 },
    { id: crypto.randomUUID(), tipo: "aguardar", template: "", delay_min: followUpMin },
    { id: crypto.randomUUID(), tipo: "whatsapp", template: followUp, delay_min: 0 },
    { id: crypto.randomUUID(), tipo: "stop_on_event", template: "", delay_min: 0, stop_event_type: "compra_aprovada" } as Acao,
  ];

  const criar = async () => {
    setSaving(true);
    try {
      const trigger_tipo = keywords.length > 0 ? "whatsapp_palavra_chave" : "whatsapp_mensagem_recebida";
      const { data, error } = await supabase.from("imphq_automacoes").insert({
        id: crypto.randomUUID(),
        nome,
        trigger_tipo,
        project_id: projectId || null,
        acoes: buildAcoes() as any,
        ativo: true,
        prioridade: 8,
        link_checkout: linkCheckout || null,
        trigger_config: keywords.length > 0 ? { keywords, match_mode: matchMode } : null,
        flow_objective: "Aquisição X1 híbrida: qualificar, apresentar e converter via WhatsApp.",
      } as any).select("id").single();
      if (error) throw error;
      toast.success("Fluxo X1 criado! Abrindo editor…");
      onOpenChange(false);
      setStep(0);
      onCreated((data as any).id);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar fluxo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-secondary/40 backdrop-blur leading-7">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Novo Fluxo X1 (WhatsApp)
          </DialogTitle>
          <DialogDescription>
            Ads → WhatsApp → Venda em modelo híbrido (mensagens + IA). Passo {step + 1} de {STEPS.length}: <strong>{STEPS[step]}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 mb-2">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-white/10"}`} />
          ))}
        </div>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label>Nome do fluxo</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Projeto</Label>
                <Select value={projectId || "none"} onValueChange={v => setProjectId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todos</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Como o fluxo começa?</Label>
                <Select value={triggerMode} onValueChange={(v: any) => setTriggerMode(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp_palavra_chave">🔑 Palavra-chave no WhatsApp</SelectItem>
                    <SelectItem value="whatsapp_mensagem_recebida">💬 Qualquer mensagem no WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {triggerMode === "whatsapp_palavra_chave" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Palavras-chave</Label>
                    <Select value={matchMode} onValueChange={(v: any) => setMatchMode(v)}>
                      <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Contém qualquer uma</SelectItem>
                        <SelectItem value="all">Contém todas</SelectItem>
                        <SelectItem value="exact">Mensagem exata</SelectItem>
                        <SelectItem value="regex">Regex avançado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <EditableTagList tags={keywords} onChange={setKeywords} placeholder="quero, preço, info…" />
                  <p className="text-[10px] text-muted-foreground">Enter para adicionar. Sem diferença entre maiúsculas/minúsculas.</p>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <Label>Mensagem de abertura (gancho)</Label>
              <Textarea rows={5} value={gancho} onChange={e => setGancho(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">
                Curta, com pergunta que provoca resposta. Use <code>{"{{nome}}"}</code>, <code>{"{{produto}}"}</code>.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <Label>Prompt de qualificação (IA)</Label>
              <Textarea rows={6} value={iaPrompt} onChange={e => setIaPrompt(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">
                A IA vai conduzir a qualificação em UMA pergunta por vez, entendendo áudio e imagem.
              </p>
            </div>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label>Roteiro do áudio (IA lê e envia)</Label>
                <Textarea rows={4} value={audioRoteiro} onChange={e => setAudioRoteiro(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Link de checkout ({"{{link}}"})</Label>
                <Input value={linkCheckout} onChange={e => setLinkCheckout(e.target.value)} placeholder="https://pay.seudominio.com/…" />
              </div>
              <div className="space-y-2">
                <Label>CTA final</Label>
                <Textarea rows={3} value={cta} onChange={e => setCta(e.target.value)} />
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="space-y-2">
                <Label>Tempo até o follow-up (minutos)</Label>
                <Input type="number" min={10} value={followUpMin} onChange={e => setFollowUpMin(Number(e.target.value) || 720)} />
                <p className="text-[10px] text-muted-foreground">Padrão: 720min (12h). Sugestão: 60 = 1h · 1440 = 1 dia.</p>
              </div>
              <div className="space-y-2">
                <Label>Mensagem de follow-up</Label>
                <Textarea rows={3} value={followUp} onChange={e => setFollowUp(e.target.value)} />
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
                ✅ O fluxo será encerrado automaticamente quando a compra for aprovada (<code>stop_on_event</code>).
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Avançar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={criar} disabled={saving} className="bg-primary text-primary-foreground font-bold">
              <Rocket className="h-4 w-4 mr-1" /> {saving ? "Criando…" : "Criar fluxo X1"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
