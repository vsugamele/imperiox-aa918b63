import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Loader2, Brain, Database, UserCircle, Wrench, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MENTES_DATA } from "@/data/mentesData";
import { SKILLS_DATA } from "@/data/skillsData";

// Modelos Gateway sempre disponíveis (rápidos, recomendados pra uso síncrono)
const GATEWAY_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "⚡ Gemini 3 Flash", desc: "Rápido e eficiente", via: "gateway", tier: "cheap" },
  { id: "google/gemini-3.1-pro-preview", label: "🧠 Gemini 3.1 Pro", desc: "Raciocínio avançado (lento)", via: "gateway", tier: "premium" },
  { id: "google/gemini-2.5-pro", label: "🔬 Gemini 2.5 Pro", desc: "Contexto grande (lento)", via: "gateway", tier: "premium" },
  { id: "google/gemini-2.5-flash", label: "⚡ Gemini 2.5 Flash", desc: "Bom custo-benefício", via: "gateway", tier: "cheap" },
  { id: "openai/gpt-5.2", label: "🚀 GPT-5.2", desc: "Mais poderoso OpenAI (lento)", via: "gateway", tier: "premium" },
  { id: "openai/gpt-5", label: "💪 GPT-5", desc: "Poderoso e preciso (lento)", via: "gateway", tier: "premium" },
  { id: "openai/gpt-5-mini", label: "⚡ GPT-5 Mini", desc: "Rápido e econômico", via: "gateway", tier: "cheap" },
  { id: "openai/gpt-5-nano", label: "💨 GPT-5 Nano", desc: "Ultra rápido", via: "gateway", tier: "cheap" },
  { id: "google/gemini-2.5-flash-lite", label: "💨 Gemini Flash Lite", desc: "Mais barato", via: "gateway", tier: "cheap" },
];

const SLOW_MODEL_HINTS = ["opus", "pro", "r1", "gpt-5.2", "gpt-5.4", "gpt-5.5", "deepseek", "405b", "70b"];
const isSlowModel = (id: string) => SLOW_MODEL_HINTS.some((h) => id.toLowerCase().includes(h));

interface OpenRouterModel {
  id: string;
  name: string;
  context: number;
  tier: "free" | "cheap" | "mid" | "premium";
  description?: string;
}

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
  const [model, setModel] = useState(GATEWAY_MODELS[0].id);
  const [generating, setGenerating] = useState(false);
  const [selectedMente, setSelectedMente] = useState<string>("none");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [orModels, setOrModels] = useState<OpenRouterModel[]>([]);
  const [orSearch, setOrSearch] = useState("");
  const [forceAsync, setForceAsync] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  // Lazy-load OpenRouter catalog quando abrir o diálogo
  useEffect(() => {
    if (!open || orModels.length > 0) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("openrouter-models");
        if (error) throw error;
        setOrModels(data?.models || []);
      } catch (e) {
        console.warn("OpenRouter models fetch falhou", e);
      }
    })();
  }, [open]);

  const filteredOr = useMemo(() => {
    const q = orSearch.toLowerCase().trim();
    const base = q ? orModels.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)) : orModels;
    return base.slice(0, 80);
  }, [orModels, orSearch]);

  const getOpenRouterKey = (): string | null => {
    try {
      const raw = localStorage.getItem("imphq_api_keys");
      if (!raw) return null;
      const keys = JSON.parse(raw);
      return keys.openrouter || null;
    } catch { return null; }
  };

  const isOpenRouter = !model.startsWith("google/") && !model.startsWith("openai/");
  const shouldUseAsync = forceAsync || isSlowModel(model);

  const pollJob = async (jobId: string): Promise<any> => {
    const start = Date.now();
    const MAX_MS = 8 * 60 * 1000; // 8 minutos
    while (Date.now() - start < MAX_MS) {
      await new Promise((r) => setTimeout(r, 3000));
      const { data: job } = await supabase
        .from("imphq_ai_jobs")
        .select("status,result,error")
        .eq("id", jobId)
        .maybeSingle();
      if (!job) continue;
      setJobStatus(job.status);
      if (job.status === "ready") return job.result;
      if (job.status === "failed") throw new Error(job.error || "Job falhou");
    }
    throw new Error("Timeout: job demorou mais de 8 minutos");
  };

  const handleGenerate = async () => {
    if (isOpenRouter) {
      const orKey = getOpenRouterKey();
      if (!orKey) {
        toast.error("Chave OpenRouter não configurada. Vá em Configurações → APIs & Keys.");
        return;
      }
    }

    setGenerating(true);
    setJobStatus(null);
    setOpen(false);
    try {
      const bodyPayload: Record<string, any> = { project_id: projectId, action, model, ...extraBody };
      if (isOpenRouter) bodyPayload.openrouter_key = getOpenRouterKey();
      if (selectedMente && selectedMente !== "none") bodyPayload.mente_id = selectedMente;
      if (selectedSkills.length > 0) bodyPayload.skill_slugs = selectedSkills;

      if (shouldUseAsync) {
        // Cria job e dispara worker
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sessão expirada");
        const { data: job, error: jobErr } = await supabase
          .from("imphq_ai_jobs")
          .insert({
            user_id: user.id,
            project_id: projectId,
            action,
            model,
            payload: bodyPayload,
            status: "queued",
          })
          .select("id")
          .single();
        if (jobErr || !job) throw jobErr || new Error("Falha ao criar job");

        toast.info("Gerando em background — pode levar alguns minutos.", { duration: 5000 });
        await supabase.functions.invoke("ai-job-runner", { body: { job_id: job.id } });
        const result = await pollJob(job.id);
        onResult(result);
        toast.success("Geração concluída!");
      } else {
        const { data, error } = await supabase.functions.invoke("openflow-ai", { body: bodyPayload });
        if (error) throw error;
        onResult(data);
      }
    } catch (err: any) {
      if (err?.message?.includes("429") || err?.status === 429) toast.error("Rate limit excedido.");
      else if (err?.message?.includes("402") || err?.status === 402) toast.error("Créditos insuficientes.");
      else toast.error(err.message || "Erro ao gerar com IA");
    } finally {
      setGenerating(false);
      setJobStatus(null);
    }
  };

  const tierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      free: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      cheap: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      mid: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      premium: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    };
    return <Badge variant="outline" className={`text-[9px] px-1 py-0 ${colors[tier] || ""}`}>{tier}</Badge>;
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
        {generating ? (jobStatus ? `${jobStatus}…` : "Gerando...") : `🤖 ${label}`}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-secondary/40 backdrop-blur">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> Gerar com IA
            </DialogTitle>
            <DialogDescription>Escolha o modelo e contexto.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Modelo (Gateway — recomendado)</Label>
              <Select value={GATEWAY_MODELS.some(m => m.id === model) ? model : ""} onValueChange={setModel}>
                <SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecione um modelo gateway" /></SelectTrigger>
                <SelectContent>
                  {GATEWAY_MODELS.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-medium">{m.label}</span>
                      <span className="text-muted-foreground ml-1 text-xs">— {m.desc}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Ou escolha um modelo OpenRouter ({orModels.length} disponíveis)</Label>
              <div className="relative mb-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
                <Input value={orSearch} onChange={(e) => setOrSearch(e.target.value)} placeholder="Buscar (ex: claude, llama, mistral)…" className="h-8 pl-7 text-xs bg-secondary" />
              </div>
              <Select value={orModels.some(m => m.id === model) ? model : ""} onValueChange={setModel}>
                <SelectTrigger className="bg-secondary"><SelectValue placeholder={orModels.length ? "Selecione um modelo OpenRouter" : "Carregando catálogo…"} /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredOr.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-xs">{m.name}</span>
                        {tierBadge(m.tier)}
                        {m.context >= 100000 && <Badge variant="outline" className="text-[9px] px-1 py-0">{Math.round(m.context / 1000)}k</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                  {filteredOr.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhum modelo encontrado</div>}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">Modelo selecionado: <code className="text-primary">{model}</code></p>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/40 bg-secondary/60 p-2.5">
              <div>
                <Label className="text-xs font-medium">Modo background (async)</Label>
                <p className="text-[10px] text-muted-foreground">
                  {isSlowModel(model) ? "Auto-ativado: modelo lento" : "Use para gerações longas (>2min)"}
                </p>
              </div>
              <Switch checked={shouldUseAsync} onCheckedChange={setForceAsync} disabled={isSlowModel(model)} />
            </div>

            {showMenteSelector && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <UserCircle className="h-3 w-3" /> Personalidade (Mente IA)
                </Label>
                <Select value={selectedMente} onValueChange={setSelectedMente}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">🚫 Nenhuma</SelectItem>
                    {MENTES_DATA.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.icon} {m.nome} — <span className="text-muted-foreground text-xs">{m.spec}</span></SelectItem>
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
                {selectedSkills.length > 0 && <p className="text-[10px] text-primary mt-1">{selectedSkills.length} skill(s) selecionada(s)</p>}
              </div>
            )}

            {contextSources.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Database className="h-3 w-3" /> Contexto enviado
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {contextSources.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                </div>
              </div>
            )}

            {fieldsToFill.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Campos preenchidos</Label>
                <div className="flex flex-wrap gap-1.5">
                  {fieldsToFill.map(f => <Badge key={f} variant="outline" className="text-[10px] border-primary/30 text-primary">{f}</Badge>)}
                </div>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">⚠️ Apenas campos vazios serão preenchidos.</p>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleGenerate} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Gerar {shouldUseAsync && "(background)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
