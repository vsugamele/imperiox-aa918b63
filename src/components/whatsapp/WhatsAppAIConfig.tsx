import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Save, Loader2, Brain, Clock, Shield, Zap } from "lucide-react";

interface AIConfig {
  id?: string;
  project_id: string;
  enabled: boolean;
  personality: string;
  tone: string;
  max_tokens: number;
  escalation_keywords: string[];
  welcome_message: string;
  context_sources: string[];
  response_delay_seconds: number;
  business_hours_only: boolean;
  business_hours_start: string;
  business_hours_end: string;
}

const PERSONALITIES = [
  { id: "assistente", label: "Assistente Geral", desc: "Atendimento cordial e informativo" },
  { id: "vendedor", label: "Closer de Vendas", desc: "Foco em conversão e fechamento" },
  { id: "suporte", label: "Suporte Técnico", desc: "Resolução de dúvidas e problemas" },
  { id: "consultor", label: "Consultor Expert", desc: "Autoridade e recomendações" },
];

const TONES = [
  { id: "profissional", label: "Profissional" },
  { id: "casual", label: "Casual" },
  { id: "amigavel", label: "Amigável" },
  { id: "formal", label: "Formal" },
  { id: "urgente", label: "Urgente" },
];

const CONTEXT_OPTIONS = [
  { id: "briefing", label: "Briefing do Projeto" },
  { id: "avatar", label: "Avatar / Persona" },
  { id: "produtos", label: "Produtos & Preços" },
  { id: "faq", label: "FAQ / KB" },
  { id: "branding", label: "Tom de Marca" },
  { id: "copy_arsenal", label: "Arsenal de Copy" },
];

interface Props {
  projectId: string;
}

export default function WhatsAppAIConfig({ projectId }: Props) {
  const [config, setConfig] = useState<AIConfig>({
    project_id: projectId,
    enabled: false,
    personality: "assistente",
    tone: "profissional",
    max_tokens: 300,
    escalation_keywords: ["humano", "atendente", "pessoa", "falar com alguém"],
    welcome_message: "",
    context_sources: ["briefing", "avatar", "produtos", "faq"],
    response_delay_seconds: 3,
    business_hours_only: false,
    business_hours_start: "08:00",
    business_hours_end: "20:00",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [keywordsText, setKeywordsText] = useState("");

  useEffect(() => {
    loadConfig();
  }, [projectId]);

  const loadConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("imphq_wa_ai_config")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (data) {
      setConfig(data as any);
      setKeywordsText((data.escalation_keywords || []).join(", "));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const keywords = keywordsText.split(",").map(k => k.trim()).filter(Boolean);
    const payload = { ...config, escalation_keywords: keywords, updated_at: new Date().toISOString() };

    const { error } = config.id
      ? await supabase.from("imphq_wa_ai_config").update(payload).eq("id", config.id)
      : await supabase.from("imphq_wa_ai_config").insert(payload);

    if (error) toast.error("Erro ao salvar: " + error.message);
    else { toast.success("Configuração do AI salva!"); loadConfig(); }
    setSaving(false);
  };

  const toggleContext = (id: string) => {
    setConfig(prev => ({
      ...prev,
      context_sources: prev.context_sources.includes(id)
        ? prev.context_sources.filter(s => s !== id)
        : [...prev.context_sources, id],
    }));
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Carregando configuração IA...</div>;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-5 w-5 text-primary" />
          WhatsApp Autônomo (IA)
          <Badge variant={config.enabled ? "default" : "secondary"} className="text-[10px]">
            {config.enabled ? "ATIVO" : "DESATIVADO"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30">
          <div>
            <p className="text-sm font-medium">Ativar Autoresponder IA</p>
            <p className="text-[11px] text-muted-foreground">A IA responde automaticamente mensagens recebidas usando contexto do projeto</p>
          </div>
          <Switch checked={config.enabled} onCheckedChange={v => setConfig(p => ({ ...p, enabled: v }))} />
        </div>

        {/* Personality & Tone */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Brain className="h-3 w-3" /> Personalidade
            </Label>
            <Select value={config.personality} onValueChange={v => setConfig(p => ({ ...p, personality: v }))}>
              <SelectTrigger className="bg-secondary/50 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERSONALITIES.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-medium">{p.label}</span>
                    <span className="text-muted-foreground ml-1 text-[10px]">— {p.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Tom de Voz</Label>
            <Select value={config.tone} onValueChange={v => setConfig(p => ({ ...p, tone: v }))}>
              <SelectTrigger className="bg-secondary/50 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONES.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Context sources */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Zap className="h-3 w-3" /> Fontes de Contexto
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {CONTEXT_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => toggleContext(opt.id)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                  config.context_sources.includes(opt.id)
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-secondary/30 border-border/30 text-muted-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Welcome message */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1">Mensagem de Boas-Vindas (opcional)</Label>
          <Textarea
            value={config.welcome_message}
            onChange={e => setConfig(p => ({ ...p, welcome_message: e.target.value }))}
            placeholder="Olá! 👋 Sou o assistente virtual. Como posso ajudar?"
            className="min-h-[50px] text-xs bg-secondary/30"
          />
        </div>

        {/* Escalation keywords */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Shield className="h-3 w-3" /> Palavras de Escalação (separe por vírgula)
          </Label>
          <Input
            value={keywordsText}
            onChange={e => setKeywordsText(e.target.value)}
            placeholder="humano, atendente, pessoa, falar com alguém"
            className="text-xs bg-secondary/30"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Quando o lead usar essas palavras, a IA para e marca para atendimento humano.
          </p>
        </div>

        {/* Business hours & delay */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Delay da Resposta (seg)
            </Label>
            <Input
              type="number"
              min={0}
              max={30}
              value={config.response_delay_seconds}
              onChange={e => setConfig(p => ({ ...p, response_delay_seconds: parseInt(e.target.value) || 3 }))}
              className="text-xs bg-secondary/30"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Max Tokens</Label>
            <Input
              type="number"
              min={50}
              max={1000}
              value={config.max_tokens}
              onChange={e => setConfig(p => ({ ...p, max_tokens: parseInt(e.target.value) || 300 }))}
              className="text-xs bg-secondary/30"
            />
          </div>
        </div>

        {/* Business hours */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/20">
          <div className="flex items-center gap-2">
            <Switch
              checked={config.business_hours_only}
              onCheckedChange={v => setConfig(p => ({ ...p, business_hours_only: v }))}
            />
            <span className="text-xs">Apenas horário comercial</span>
          </div>
          {config.business_hours_only && (
            <div className="flex items-center gap-1 text-xs">
              <Input
                value={config.business_hours_start}
                onChange={e => setConfig(p => ({ ...p, business_hours_start: e.target.value }))}
                className="w-16 h-7 text-[10px] bg-secondary/30"
              />
              <span className="text-muted-foreground">até</span>
              <Input
                value={config.business_hours_end}
                onChange={e => setConfig(p => ({ ...p, business_hours_end: e.target.value }))}
                className="w-16 h-7 text-[10px] bg-secondary/30"
              />
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2" size="sm">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar Configuração
        </Button>
      </CardContent>
    </Card>
  );
}
