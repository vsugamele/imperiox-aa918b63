import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, Brain, Database, UserCircle, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MENTES_DATA } from "@/data/mentesData";
import { SKILLS_DATA } from "@/data/skillsData";

const MODELS = [
  // --- Lovable Gateway (Gemini + GPT) ---
  { id: "google/gemini-3-flash-preview", label: "⚡ Gemini 3 Flash", desc: "Rápido e eficiente", via: "gateway" },
  { id: "google/gemini-3.1-pro-preview", label: "🧠 Gemini 3.1 Pro", desc: "Raciocínio avançado", via: "gateway" },
  { id: "google/gemini-2.5-pro", label: "🔬 Gemini 2.5 Pro", desc: "Contexto grande + multimodal", via: "gateway" },
  { id: "google/gemini-2.5-flash", label: "⚡ Gemini 2.5 Flash", desc: "Bom custo-benefício", via: "gateway" },
  { id: "openai/gpt-5.2", label: "🚀 GPT-5.2", desc: "Mais poderoso OpenAI", via: "gateway" },
  { id: "openai/gpt-5", label: "💪 GPT-5", desc: "Poderoso e preciso", via: "gateway" },
  { id: "openai/gpt-5-mini", label: "⚡ GPT-5 Mini", desc: "Rápido e econômico", via: "gateway" },
  // --- OpenRouter (Claude, DeepSeek, Llama) ---
  { id: "anthropic/claude-opus-4", label: "🟣 Claude Opus 4", desc: "Mais poderoso Anthropic", via: "openrouter" },
  { id: "anthropic/claude-sonnet-4", label: "🟣 Claude Sonnet 4", desc: "Rápido e inteligente", via: "openrouter" },
  { id: "anthropic/claude-3.5-sonnet", label: "🟣 Claude 3.5 Sonnet", desc: "Versão estável anterior", via: "openrouter" },
  { id: "deepseek/deepseek-r1", label: "🔵 DeepSeek R1", desc: "Raciocínio profundo, custo baixo", via: "openrouter" },
  { id: "meta-llama/llama-4-maverick", label: "🦙 Llama 4 Maverick", desc: "Meta open-source, rápido", via: "openrouter" },
  // --- Lite ---
  { id: "openai/gpt-5-nano", label: "💨 GPT-5 Nano", desc: "Ultra rápido, tarefas simples", via: "gateway" },
  { id: "google/gemini-2.5-flash-lite", label: "💨 Gemini Flash Lite", desc: "Mais barato", via: "gateway" },
];

interface AIGenerateButtonProps {
  projectId: string;
  action: string;
  onResult: (data: any) => void;
  contextSources?: string[];
  fieldsToFill?: string[];
  label?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "outline" | "default" | "secondary" | "ghost";
  className?: string;
  extraBody?: Record<string, any>;
  showMenteSelector?: boolean;
  showSkillSelector?: boolean;
}

export function AIGenerateButton({
  projectId,
  action,
  onResult,
  contextSources = [],
  fieldsToFill = [],
  label = "Completar com IA",
  size = "sm",
  variant = "outline",
  className = "",
  extraBody = {},
  showMenteSelector = false,
  showSkillSelector = false,
}: AIGenerateButtonProps) {
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState(MODELS[0].id);
  const [generating, setGenerating] = useState(false);
  const [selectedMente, setSelectedMente] = useState<string>("none");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const getOpenRouterKey = (): string | null => {
    try {
      const raw = localStorage.getItem("imphq_api_keys");
      if (!raw) return null;
      const keys = JSON.parse(raw);
      return keys.openrouter || null;
    } catch { return null; }
  };

  const handleGenerate = async () => {
    const selectedModel = MODELS.find(m => m.id === model);
    const isOpenRouter = selectedModel?.via === "openrouter";
    
    // Check if OpenRouter key exists for OpenRouter models
    if (isOpenRouter) {
      const orKey = getOpenRouterKey();
      if (!orKey) {
        toast.error("Chave OpenRouter não configurada. Vá em Configurações → APIs & Keys e adicione sua API Key do OpenRouter.");
        return;
      }
    }

    setGenerating(true);
    setOpen(false);
    try {
      const bodyPayload: Record<string, any> = { project_id: projectId, action, model, ...extraBody };
      
      // Send OpenRouter key for non-gateway models
      if (isOpenRouter) {
        bodyPayload.openrouter_key = getOpenRouterKey();
      }

      // Send mente_id if selected
      if (selectedMente && selectedMente !== "none") {
        bodyPayload.mente_id = selectedMente;
      }

      // Send selected skills
      if (selectedSkills.length > 0) {
        bodyPayload.skill_slugs = selectedSkills;
      }

      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: bodyPayload,
      });
      if (error) throw error;
      onResult(data);
    } catch (err: any) {
      if (err?.message?.includes("429") || err?.status === 429) {
        toast.error("Rate limit excedido. Tente novamente em alguns segundos.");
      } else if (err?.message?.includes("402") || err?.status === 402) {
        toast.error("Créditos insuficientes. Adicione créditos no workspace.");
      } else {
        toast.error(err.message || "Erro ao gerar com IA");
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={`gap-1.5 ${className}`}
        onClick={() => setOpen(true)}
        disabled={generating}
      >
        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {generating ? "Gerando..." : `🤖 ${label}`}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> Gerar com IA
            </DialogTitle>
            <DialogDescription>Escolha o modelo e veja quais dados serão usados como contexto.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Modelo de IA</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-medium">{m.label}</span>
                      <Badge variant={m.via === "gateway" ? "secondary" : "outline"} className="ml-2 text-[9px] px-1 py-0">
                        {m.via === "gateway" ? "Gateway" : "OpenRouter"}
                      </Badge>
                      <span className="text-muted-foreground ml-1 text-xs">— {m.desc}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showMenteSelector && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <UserCircle className="h-3 w-3" /> Personalidade (Mente IA)
                </Label>
                <Select value={selectedMente} onValueChange={setSelectedMente}>
                  <SelectTrigger className="bg-secondary">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">🚫 Nenhuma — tom neutro</SelectItem>
                    {MENTES_DATA.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <span>{m.icon} {m.nome}</span>
                        <span className="text-muted-foreground ml-1 text-xs">— {m.spec}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showSkillSelector && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Wrench className="h-3 w-3" /> Skills a aplicar
                </Label>
                <div className="max-h-[140px] overflow-y-auto space-y-1.5 border border-border rounded-md p-2 bg-secondary/30">
                  {SKILLS_DATA.map(skill => (
                    <label key={skill.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-secondary/50 rounded px-1 py-0.5">
                      <Checkbox
                        checked={selectedSkills.includes(skill.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedSkills(prev => [...prev, skill.id]);
                          else setSelectedSkills(prev => prev.filter(s => s !== skill.id));
                        }}
                      />
                      <span>{skill.icone} {skill.nome}</span>
                      <span className="text-[9px] text-muted-foreground ml-auto">{skill.categoria}</span>
                    </label>
                  ))}
                </div>
                {selectedSkills.length > 0 && (
                  <p className="text-[10px] text-primary mt-1">{selectedSkills.length} skill(s) selecionada(s)</p>
                )}
              </div>
            )}

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Database className="h-3 w-3" /> Dados usados como contexto
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {contextSources.map(s => (
                    <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {fieldsToFill.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Campos que serão preenchidos</Label>
                <div className="flex flex-wrap gap-1.5">
                  {fieldsToFill.map(f => (
                    <Badge key={f} variant="outline" className="text-[10px] border-primary/30 text-primary">{f}</Badge>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">⚠️ Apenas campos vazios serão preenchidos. Dados existentes não serão sobrescritos.</p>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleGenerate} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
