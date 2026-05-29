import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, Clock, Mail, MessageCircle, Send, Sparkles, ChevronUp, ChevronDown, GitBranch, SaveAll, Variable, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CONDICAO_TIPOS = [
  { value: "nao_abriu_email", label: "Não abriu email" },
  { value: "nao_respondeu_whatsapp", label: "Não respondeu WhatsApp" },
  { value: "nao_clicou_link", label: "Não clicou no link" },
  { value: "clicou_link", label: "Clicou no link" },
  { value: "abriu_email", label: "Abriu email" },
  { value: "respondeu_whatsapp", label: "Respondeu WhatsApp" },
];

const ACAO_TIPOS = [
  { value: "email", label: "Email (Resend)", icon: Mail, emoji: "✉️", color: "border-blue-500/40 bg-blue-500/5" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, emoji: "💬", color: "border-emerald-500/40 bg-emerald-500/5" },
  { value: "telegram", label: "Telegram", icon: Send, emoji: "📨", color: "border-sky-500/40 bg-sky-500/5" },
  { value: "aguardar", label: "Aguardar", icon: Clock, emoji: "⏱", color: "border-amber-500/40 bg-amber-500/5" },
  { value: "condicao", label: "Condição (Se…)", icon: GitBranch, emoji: "🔀", color: "border-violet-500/40 bg-violet-500/5" },
];

const TRIGGERS_MAP: Record<string, { label: string; icon: string; group: string }> = {
  // Lead
  lead_novo: { label: "Novo Lead", icon: "👤", group: "Lead" },
  inicio_checkout: { label: "Início de Checkout", icon: "🛍️", group: "Lead" },
  // Pagamento - pendente
  carrinho_abandonado: { label: "Carrinho Abandonado", icon: "🛒", group: "Pagamento" },
  aguardando_pagamento: { label: "Aguardando Pagamento / Pix Gerado", icon: "💰", group: "Pagamento" },
  boleto_gerado: { label: "Boleto Gerado", icon: "📄", group: "Pagamento" },
  pagamento_recusado: { label: "Pagamento Recusado", icon: "❌", group: "Pagamento" },
  pagamento_expirado: { label: "Pagamento Expirado (Pix/Boleto)", icon: "⌛", group: "Pagamento" },
  // Pagamento - aprovado / pós-venda
  compra_aprovada: { label: "Compra Aprovada", icon: "✅", group: "Pós-venda" },
  primeiro_acesso: { label: "Primeiro Acesso", icon: "🎉", group: "Pós-venda" },
  upsell_aprovado: { label: "Upsell Aprovado", icon: "⬆️", group: "Pós-venda" },
  orderbump_aprovado: { label: "Orderbump Aprovado", icon: "🎁", group: "Pós-venda" },
  // Retenção / Churn
  reembolso: { label: "Reembolso", icon: "↩️", group: "Retenção" },
  chargeback: { label: "Chargeback", icon: "⚠️", group: "Retenção" },
  compra_cancelada: { label: "Compra Cancelada", icon: "🚫", group: "Retenção" },
  assinatura_cancelada: { label: "Assinatura Cancelada", icon: "💔", group: "Retenção" },
  assinatura_renovada: { label: "Assinatura Renovada", icon: "🔄", group: "Retenção" },
  trial_iniciado: { label: "Trial Iniciado", icon: "🆓", group: "Retenção" },
  tag_adicionada: { label: "Tag Adicionada", icon: "🏷️", group: "Lead" },
};

const DYNAMIC_VARS = [
  { var: "{{nome}}", label: "Nome" },
  { var: "{{email}}", label: "Email" },
  { var: "{{produto}}", label: "Produto" },
  { var: "{{valor}}", label: "Valor" },
  { var: "{{telefone}}", label: "Telefone" },
  { var: "{{link}}", label: "Link" },
];

export interface Acao {
  tipo: string;
  template: string;
  delay_min: number;
  condicao_tipo?: string;
  condicao_tempo_min?: number;
  provider_id?: string;
}

export interface WaProvider {
  id: string;
  provider: string;
  instance_name?: string;
  twilio_from?: string;
  project_id?: string;
}

export interface ProjectTemplate {
  label: string;
  content: string;
  source: string;
}

interface FlowEditorProps {
  triggerTipo: string;
  acoes: Acao[];
  onChange: (acoes: Acao[]) => void;
  onGenerateAI?: () => void;
  isGenerating?: boolean;
  templates?: ProjectTemplate[];
  providers?: WaProvider[];
  projectId?: string;
  onTemplateSaved?: () => void;
}

export function FlowEditor({ triggerTipo, acoes, onChange, onGenerateAI, isGenerating, templates = [], providers = [], projectId, onTemplateSaved }: FlowEditorProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  const saveAsTemplate = async (acao: Acao) => {
    if (!acao.template?.trim()) { toast.error("Escreva uma mensagem antes de salvar"); return; }
    setSavingTemplate(true);
    try {
      const name = acao.template.split(/\s+/).slice(0, 5).join(" ");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("imphq_wa_templates").insert({
        name,
        content: acao.template,
        category: acao.tipo || "whatsapp",
        project_id: projectId || null,
        user_id: user?.id,
      } as any);
      if (error) throw error;
      toast.success("Template salvo!");
      onTemplateSaved?.();
    } catch (e: any) {
      toast.error("Erro ao salvar template: " + (e?.message || ""));
    } finally {
      setSavingTemplate(false);
    }
  };

  const insertVariable = (idx: number, variable: string) => {
    const updated = [...acoes];
    updated[idx] = { ...updated[idx], template: (updated[idx].template || "") + variable };
    onChange(updated);
  };

  const renderPreview = (text: string) => {
    return text
      .replace(/\{\{nome\}\}/g, "João Silva")
      .replace(/\{\{email\}\}/g, "joao@email.com")
      .replace(/\{\{produto\}\}/g, "Curso Premium")
      .replace(/\{\{valor\}\}/g, "R$ 297,00")
      .replace(/\{\{telefone\}\}/g, "(11) 99999-9999");
  };

  const trigger = TRIGGERS_MAP[triggerTipo] || { label: triggerTipo, icon: "⚡" };

  const addAcao = (insertAt?: number) => {
    const newAcao: Acao = { tipo: "email", template: "", delay_min: 0 };
    if (insertAt !== undefined) {
      const updated = [...acoes];
      updated.splice(insertAt + 1, 0, newAcao);
      onChange(updated);
      setExpandedIdx(insertAt + 1);
    } else {
      onChange([...acoes, newAcao]);
      setExpandedIdx(acoes.length);
    }
  };

  const removeAcao = (idx: number) => {
    onChange(acoes.filter((_, i) => i !== idx));
    setExpandedIdx(null);
  };

  const updateAcao = (idx: number, field: string, value: any) => {
    const updated = [...acoes];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const moveAcao = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= acoes.length) return;
    const updated = [...acoes];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    onChange(updated);
    setExpandedIdx(target);
  };

  const acaoMeta = (tipo: string) => ACAO_TIPOS.find(t => t.value === tipo) || ACAO_TIPOS[0];

  return (
    <div className="space-y-2">
      {onGenerateAI && (
        <Button variant="outline" size="sm" onClick={onGenerateAI} disabled={isGenerating} className="w-full mb-3 border-primary/30 text-primary hover:bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {isGenerating ? "Gerando narrativa…" : "🤖 Gerar Narrativa com IA"}
        </Button>
      )}

      {/* Trigger Node */}
      <div className="flex flex-col items-center">
        <div className="w-full max-w-md border-2 border-primary/30 bg-primary/5 rounded-lg p-3 text-center">
          <span className="text-xl">{trigger.icon}</span>
          <p className="text-sm font-semibold text-foreground mt-1">{trigger.label}</p>
          <Badge variant="outline" className="text-[9px] mt-1">TRIGGER</Badge>
        </div>
        <SVGConnector />
        {acoes.length === 0 && (
          <Button variant="ghost" size="sm" onClick={() => addAcao()} className="text-muted-foreground hover:text-primary">
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar ação
          </Button>
        )}
      </div>

      {/* Action Nodes */}
      {acoes.map((acao, idx) => {
        const meta = acaoMeta(acao.tipo);
        const isExpanded = expandedIdx === idx;
        const isAguardar = acao.tipo === "aguardar";
        const isCondicao = acao.tipo === "condicao";
        const showPreview = previewIdx === idx;

        return (
          <div key={idx} className="flex flex-col items-center">
            <div
              className={`w-full max-w-md border rounded-lg p-3 transition-all cursor-pointer ${meta.color} ${isExpanded ? "ring-1 ring-primary/40" : ""} ${isCondicao ? "border-l-4 border-l-violet-500" : ""}`}
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{meta.emoji}</span>
                  <span className="text-xs font-medium text-foreground">{meta.label}</span>
                  {isCondicao && acao.condicao_tipo && (
                    <Badge variant="secondary" className="text-[9px]">
                      {CONDICAO_TIPOS.find(c => c.value === acao.condicao_tipo)?.label || acao.condicao_tipo}
                      {acao.condicao_tempo_min ? ` (${acao.condicao_tempo_min}min)` : ""}
                    </Badge>
                  )}
                  {isAguardar && acao.delay_min > 0 && (
                    <Badge variant="secondary" className="text-[9px]">{acao.delay_min} min</Badge>
                  )}
                  {!isAguardar && !isCondicao && acao.template && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                      {acao.template.slice(0, 40)}…
                    </span>
                  )}
                  {!isAguardar && !isCondicao && acao.delay_min > 0 && (
                    <Badge variant="secondary" className="text-[9px]">+{acao.delay_min}min</Badge>
                  )}
                </div>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); moveAcao(idx, -1); }} disabled={idx === 0}>
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); moveAcao(idx, 1); }} disabled={idx === acoes.length - 1}>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Expanded Edit */}
              {isExpanded && (
                <div className="mt-3 space-y-2 border-t border-border/30 pt-3" onClick={e => e.stopPropagation()}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Tipo</Label>
                      <Select value={acao.tipo} onValueChange={v => updateAcao(idx, "tipo", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ACAO_TIPOS.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">{isAguardar ? "Tempo (min)" : isCondicao ? "Verificar após (min)" : "Delay (min)"}</Label>
                      <Input
                        type="number"
                        value={isCondicao ? (acao.condicao_tempo_min || 0) : acao.delay_min}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          if (isCondicao) updateAcao(idx, "condicao_tempo_min", val);
                          else updateAcao(idx, "delay_min", val);
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Condition-specific fields */}
                  {isCondicao && (
                    <div>
                      <Label className="text-[10px]">Condição</Label>
                      <Select value={acao.condicao_tipo || ""} onValueChange={v => updateAcao(idx, "condicao_tipo", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar condição..." /></SelectTrigger>
                        <SelectContent>
                          {CONDICAO_TIPOS.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[9px] text-muted-foreground mt-1">
                        Se a condição for verdadeira, o fluxo continua para o próximo nó.
                      </p>
                    </div>
                  )}

                  {/* Provider selector for WhatsApp */}
                  {acao.tipo === "whatsapp" && providers.length > 0 && (
                    <div>
                      <Label className="text-[10px]">Sessão WhatsApp</Label>
                      <Select value={acao.provider_id || ""} onValueChange={v => updateAcao(idx, "provider_id", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecionar número..." />
                        </SelectTrigger>
                        <SelectContent>
                          {providers.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.provider === "hub_local" ? "📱" : p.provider === "evolution" ? "🟢" : "🔵"} {p.display_name || p.instance_name || p.twilio_from || p.id.slice(0, 12)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Message/template for email/whatsapp/telegram */}
                  {!isAguardar && !isCondicao && (
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px]">Mensagem / Template</Label>
                        <div className="flex items-center gap-1">
                          {templates.length > 0 && (
                            <Select onValueChange={v => {
                              const tpl = templates.find(t => t.content === v);
                              if (tpl) updateAcao(idx, "template", tpl.content);
                            }}>
                              <SelectTrigger className="h-6 w-[140px] text-[10px] border-primary/30">
                                <SelectValue placeholder="📋 Usar Template" />
                              </SelectTrigger>
                              <SelectContent>
                                {templates.map((t, ti) => (
                                  <SelectItem key={ti} value={t.content}>
                                    <span className="text-[10px]">{t.source}: {t.label}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setPreviewIdx(showPreview ? null : idx)}
                                >
                                  {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Preview da mensagem</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      <Textarea
                        value={acao.template}
                        onChange={e => updateAcao(idx, "template", e.target.value)}
                        className="text-xs min-h-[70px] mt-1"
                        placeholder="Olá {{nome}}, notamos que você..."
                      />
                      {/* Char count */}
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-[9px] ${(acao.template?.length || 0) > 1000 ? "text-destructive" : "text-muted-foreground"}`}>
                          {acao.template?.length || 0} caracteres
                        </span>
                      </div>
                      {/* Dynamic variable buttons */}
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <Variable className="h-3 w-3 text-muted-foreground" />
                        {DYNAMIC_VARS.map(v => (
                          <Button
                            key={v.var}
                            variant="outline"
                            size="sm"
                            className="h-5 text-[9px] px-1.5 border-primary/20 text-primary hover:bg-primary/10"
                            onClick={() => insertVariable(idx, v.var)}
                          >
                            {v.label}
                          </Button>
                        ))}
                      </div>
                      {/* Preview panel */}
                      {showPreview && acao.template && (
                        <div className="mt-2 p-2 rounded bg-secondary/80 border border-border text-xs whitespace-pre-wrap">
                          <p className="text-[9px] text-muted-foreground mb-1 font-medium">👁 Preview:</p>
                          {renderPreview(acao.template)}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between">
                    {!isAguardar && !isCondicao && acao.template?.trim() && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={() => saveAsTemplate(acao)} disabled={savingTemplate}>
                        <SaveAll className="h-3 w-3 mr-1" /> Salvar Template
                      </Button>
                    )}
                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs" onClick={() => removeAcao(idx)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Remover
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Connector + Insert Button */}
            <SVGConnector />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addAcao(idx)}
              className="text-muted-foreground hover:text-primary h-6 text-[10px] px-2"
            >
              <Plus className="h-3 w-3 mr-0.5" /> Inserir
            </Button>
            {idx < acoes.length - 1 && <SVGConnector />}
          </div>
        );
      })}

      {/* Final Add */}
      {acoes.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={() => addAcao()} className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Nó
          </Button>
        </div>
      )}
    </div>
  );
}

function SVGConnector() {
  return (
    <svg width="2" height="28" className="my-0.5">
      <line x1="1" y1="0" x2="1" y2="28" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="4 3" opacity="0.4">
        <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1.5s" repeatCount="indefinite" />
      </line>
    </svg>
  );
}
