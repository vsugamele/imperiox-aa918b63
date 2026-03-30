import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Clock, Mail, MessageCircle, Send, Sparkles, ChevronUp, ChevronDown } from "lucide-react";

const ACAO_TIPOS = [
  { value: "email", label: "Email (Resend)", icon: Mail, emoji: "✉️", color: "border-blue-500/40 bg-blue-500/5" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, emoji: "💬", color: "border-emerald-500/40 bg-emerald-500/5" },
  { value: "telegram", label: "Telegram", icon: Send, emoji: "📨", color: "border-sky-500/40 bg-sky-500/5" },
  { value: "aguardar", label: "Aguardar", icon: Clock, emoji: "⏱", color: "border-amber-500/40 bg-amber-500/5" },
];

const TRIGGERS_MAP: Record<string, { label: string; icon: string }> = {
  carrinho_abandonado: { label: "Carrinho Abandonado", icon: "🛒" },
  compra_aprovada: { label: "Compra Aprovada", icon: "✅" },
  lead_novo: { label: "Novo Lead", icon: "👤" },
  reembolso: { label: "Reembolso", icon: "↩️" },
  aguardando_pagamento: { label: "Aguardando Pagamento / Pix Gerado", icon: "💰" },
  inicio_checkout: { label: "Início de Checkout", icon: "🛍️" },
};

export interface Acao {
  tipo: string;
  template: string;
  delay_min: number;
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
}

export function FlowEditor({ triggerTipo, acoes, onChange, onGenerateAI, isGenerating, templates = [] }: FlowEditorProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

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
      {/* AI Generate Button */}
      {onGenerateAI && (
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerateAI}
          disabled={isGenerating}
          className="w-full mb-3 border-primary/30 text-primary hover:bg-primary/10"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {isGenerating ? "Gerando narrativa…" : "🤖 Gerar Narrativa com IA"}
        </Button>
      )}

      {/* Trigger Node (fixed) */}
      <div className="flex flex-col items-center">
        <div className="w-full max-w-md border-2 border-primary/30 bg-primary/5 rounded-lg p-3 text-center">
          <span className="text-xl">{trigger.icon}</span>
          <p className="text-sm font-semibold text-foreground mt-1">{trigger.label}</p>
          <Badge variant="outline" className="text-[9px] mt-1">TRIGGER</Badge>
        </div>

        {/* Connector */}
        <SVGConnector />

        {/* Add first action */}
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

        return (
          <div key={idx} className="flex flex-col items-center">
            <div
              className={`w-full max-w-md border rounded-lg p-3 transition-all cursor-pointer ${meta.color} ${isExpanded ? "ring-1 ring-primary/40" : ""}`}
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{meta.emoji}</span>
                  <span className="text-xs font-medium text-foreground">{meta.label}</span>
                  {isAguardar && acao.delay_min > 0 && (
                    <Badge variant="secondary" className="text-[9px]">{acao.delay_min} min</Badge>
                  )}
                  {!isAguardar && acao.template && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                      {acao.template.slice(0, 40)}…
                    </span>
                  )}
                  {!isAguardar && acao.delay_min > 0 && (
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
                      <Label className="text-[10px]">{isAguardar ? "Tempo (min)" : "Delay (min)"}</Label>
                      <Input
                        type="number"
                        value={acao.delay_min}
                        onChange={e => updateAcao(idx, "delay_min", parseInt(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  {!isAguardar && (
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px]">Mensagem / Template</Label>
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
                      </div>
                      <Textarea
                        value={acao.template}
                        onChange={e => updateAcao(idx, "template", e.target.value)}
                        className="text-xs min-h-[70px] mt-1"
                        placeholder="Olá {{nome}}, notamos que você..."
                      />
                    </div>
                  )}
                  <div className="flex justify-end">
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
