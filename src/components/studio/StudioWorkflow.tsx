import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Play, Save, CheckCircle2, XCircle, Image as ImageIcon, Video, Mic, ArrowDown, Download } from "lucide-react";
import { toast } from "sonner";
import { WORKFLOW_TEMPLATES, type WorkflowStep } from "@/data/studio/workflowTemplates";

const KIND_ICON = { image: ImageIcon, video: Video, audio: Mic } as const;

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  "image:openrouter": [
    { value: "google/gemini-3-flash-image-preview", label: "Gemini 3.1 Flash (Nano Banana 2)" },
    { value: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image" },
    { value: "recraft/recraft-v4-pro", label: "Recraft V4 Pro" },
  ],
  "image:kie": [
    { value: "gpt-image-2", label: "GPT Image 2" },
    { value: "nano-banana", label: "Nano Banana" },
    { value: "nano-banana-2", label: "Nano Banana 2" },
    { value: "flux-kontext-pro", label: "Flux Kontext Pro" },
    { value: "flux-kontext-max", label: "Flux Kontext Max" },
    { value: "seedream-4", label: "Seedream 4" },
    { value: "ideogram-v3", label: "Ideogram V3" },
    { value: "qwen-image-edit", label: "Qwen Image Edit" },
  ],
  "image:luma": [{ value: "uni-1", label: "Luma uni-1" }],
  "video:openrouter": [
    { value: "bytedance/seedance-2.0-fast", label: "Seedance 2.0 Fast" },
    { value: "bytedance/seedance-2.0", label: "Seedance 2.0 Pro" },
  ],
  "video:kie": [
    { value: "seedance-2", label: "Seedance 2 (LIPSYNC)" },
    { value: "veo3-fast", label: "Veo 3 Fast" },
    { value: "veo3", label: "Veo 3" },
    { value: "veo3.1", label: "Veo 3.1" },
    { value: "sora-2", label: "Sora 2" },
    { value: "kling-2.1", label: "Kling 2.1" },
    { value: "runway-gen4", label: "Runway Gen-4" },
    { value: "hailuo-02", label: "Hailuo 02" },
    { value: "wan-2.2", label: "Wan 2.2" },
    { value: "pixverse-v5", label: "Pixverse V5" },
    { value: "minimax-video-01", label: "MiniMax 01" },
  ],
  "audio:elevenlabs": [{ value: "eleven_multilingual_v2", label: "ElevenLabs Multilingual v2" }],
};

const VOICES = [
  { value: "JBFqnCBsd6RMkjVDRZzb", label: "George (masc, narrador)" },
  { value: "EXAVITQu4vr4xnSDxMaL", label: "Sarah (fem, calma)" },
  { value: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam (masc, jovem)" },
  { value: "XB0fDUnXU5powFXDhCwa", label: "Charlotte (fem, suave)" },
  { value: "onwK4e9ZLuTAKqWW03F9", label: "Daniel (masc, autoridade)" },
];

type Run = {
  id: string;
  status: string;
  current_step: number;
  step_outputs: Record<string, string>;
  generation_ids: Record<string, string>;
  error: string | null;
};

type SavedWorkflow = {
  id: string;
  name: string;
  template_key: string | null;
  steps: WorkflowStep[];
};

export function StudioWorkflow() {
  const [steps, setSteps] = useState<WorkflowStep[]>(WORKFLOW_TEMPLATES[0].steps);
  const [name, setName] = useState(WORKFLOW_TEMPLATES[0].name);
  const [templateKey, setTemplateKey] = useState<string>(WORKFLOW_TEMPLATES[0].key);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<SavedWorkflow[]>([]);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);

  async function loadSaved() {
    const { data } = await supabase
      .from("imphq_studio_workflows")
      .select("id,name,template_key,steps")
      .order("created_at", { ascending: false });
    setSaved((data as any) || []);
  }

  useEffect(() => { loadSaved(); }, []);

  // Poll active run
  useEffect(() => {
    if (!run || run.status === "completed" || run.status === "failed") return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("imphq_studio_workflow_runs").select("*").eq("id", run.id).single();
      if (data) setRun(data as any);
    }, 4000);
    return () => clearInterval(t);
  }, [run]);

  function applyTemplate(key: string) {
    const tpl = WORKFLOW_TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    setSteps(JSON.parse(JSON.stringify(tpl.steps)));
    setName(tpl.name);
    setTemplateKey(key);
    setCurrentWorkflowId(null);
    setRun(null);
  }

  function loadWorkflow(wf: SavedWorkflow) {
    setSteps(JSON.parse(JSON.stringify(wf.steps)));
    setName(wf.name);
    setTemplateKey(wf.template_key || "");
    setCurrentWorkflowId(wf.id);
    setRun(null);
  }

  function updateStep(idx: number, patch: Partial<WorkflowStep>) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, { kind: "image", provider: "kie", model: "nano-banana-2", prompt: "" }]);
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveStep(idx: number, dir: -1 | 1) {
    setSteps((prev) => {
      const arr = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
  }

  async function saveWorkflow() {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return toast.error("Faça login");
    const payload = { user_id: u.user.id, name, template_key: templateKey || null, steps: steps as any };
    if (currentWorkflowId) {
      const { error } = await supabase.from("imphq_studio_workflows").update(payload).eq("id", currentWorkflowId);
      if (error) return toast.error(error.message);
      toast.success("Workflow atualizado");
    } else {
      const { data, error } = await supabase.from("imphq_studio_workflows").insert(payload).select().single();
      if (error) return toast.error(error.message);
      setCurrentWorkflowId(data.id);
      toast.success("Workflow salvo");
    }
    loadSaved();
  }

  async function runWorkflow() {
    if (steps.length === 0) return toast.error("Adicione pelo menos 1 step");
    setBusy(true);
    setRun(null);
    try {
      const { data, error } = await supabase.functions.invoke("studio-workflow-run", {
        body: { steps, workflow_id: currentWorkflowId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha");
      const { data: r } = await supabase.from("imphq_studio_workflow_runs").select("*").eq("id", data.run_id).single();
      setRun(r as any);
      toast.success("Workflow iniciado — acompanhe o progresso");
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSaved(id: string) {
    if (!confirm("Apagar este workflow?")) return;
    await supabase.from("imphq_studio_workflows").delete().eq("id", id);
    if (currentWorkflowId === id) setCurrentWorkflowId(null);
    loadSaved();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* Sidebar: templates + saved */}
      <div className="space-y-4">
        <Card className="bg-secondary/40 border-border">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Templates prontos</h3>
            {WORKFLOW_TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => applyTemplate(t.key)}
                className={`w-full text-left p-2 rounded text-sm transition ${templateKey === t.key && !currentWorkflowId ? "bg-primary/20 text-primary" : "hover:bg-background/40"}`}
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-[11px] text-muted-foreground leading-4 line-clamp-2">{t.description}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-secondary/40 border-border">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Meus workflows</h3>
            {saved.length === 0 && <p className="text-xs text-muted-foreground">Nenhum salvo ainda.</p>}
            {saved.map((wf) => (
              <div key={wf.id} className={`flex items-center gap-1 p-2 rounded text-sm ${currentWorkflowId === wf.id ? "bg-primary/20" : "hover:bg-background/40"}`}>
                <button onClick={() => loadWorkflow(wf)} className="flex-1 text-left truncate">{wf.name}</button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => deleteSaved(wf.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Editor */}
      <div className="space-y-4">
        <Card className="bg-secondary/40 border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" placeholder="Nome do workflow" />
            <Button variant="outline" size="sm" onClick={saveWorkflow} className="gap-1">
              <Save className="h-4 w-4" /> {currentWorkflowId ? "Atualizar" : "Salvar"}
            </Button>
            <Button onClick={runWorkflow} disabled={busy} className="gap-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Executar tudo
            </Button>
          </CardContent>
        </Card>

        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const Icon = KIND_ICON[step.kind];
          const stepOutput = run?.step_outputs?.[String(stepNum)];
          let stepStatus: "idle" | "processing" | "completed" | "failed" = "idle";
          if (run) {
            if (run.status === "failed" && run.current_step === stepNum) stepStatus = "failed";
            else if (stepOutput) stepStatus = "completed";
            else if (run.status === "running" && run.current_step >= stepNum) stepStatus = "processing";
          }
          const modelOptions = PROVIDER_MODELS[`${step.kind}:${step.provider}`] || [];

          return (
            <div key={idx}>
              <Card className="bg-secondary/40 border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Step {stepNum}</Badge>
                    <Icon className="h-4 w-4 text-primary" />
                    {stepStatus === "processing" && <Badge className="text-xs gap-1"><Loader2 className="h-3 w-3 animate-spin" />processando</Badge>}
                    {stepStatus === "completed" && <Badge className="text-xs gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="h-3 w-3" />pronto</Badge>}
                    {stepStatus === "failed" && <Badge variant="destructive" className="text-xs gap-1"><XCircle className="h-3 w-3" />falhou</Badge>}
                    <div className="flex-1" />
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => moveStep(idx, -1)} disabled={idx === 0}>↑</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}>↓</Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeStep(idx)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select value={step.kind} onValueChange={(v: any) => {
                        const newProvider = v === "audio" ? "elevenlabs" : v === "image" ? "kie" : "kie";
                        const opts = PROVIDER_MODELS[`${v}:${newProvider}`];
                        updateStep(idx, { kind: v, provider: newProvider as any, model: opts?.[0]?.value || "" });
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">Imagem</SelectItem>
                          <SelectItem value="video">Vídeo</SelectItem>
                          <SelectItem value="audio">Áudio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Provider</Label>
                      <Select value={step.provider} onValueChange={(v: any) => {
                        const opts = PROVIDER_MODELS[`${step.kind}:${v}`];
                        updateStep(idx, { provider: v, model: opts?.[0]?.value || "" });
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {step.kind === "image" && <>
                            <SelectItem value="openrouter">OpenRouter</SelectItem>
                            <SelectItem value="kie">Kie.ai</SelectItem>
                            <SelectItem value="luma">Luma</SelectItem>
                          </>}
                          {step.kind === "video" && <>
                            <SelectItem value="openrouter">OpenRouter</SelectItem>
                            <SelectItem value="kie">Kie.ai</SelectItem>
                          </>}
                          {step.kind === "audio" && <SelectItem value="elevenlabs">ElevenLabs</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Modelo</Label>
                      <Select value={step.model} onValueChange={(v) => updateStep(idx, { model: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {modelOptions.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">{step.kind === "audio" ? "Texto da narração" : "Prompt"}</Label>
                    <Textarea rows={3} value={step.prompt} onChange={(e) => updateStep(idx, { prompt: e.target.value })} />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Use <code className="text-primary">{`{{step1.output}}`}</code>, <code className="text-primary">{`{{step2.output}}`}</code> para referenciar saídas anteriores.
                    </p>
                  </div>

                  {(step.kind === "image" || step.kind === "video") && step.provider !== "openrouter" && (
                    <div>
                      <Label className="text-xs">
                        {step.kind === "video" ? "Imagem inicial (image-to-video)" : "Imagem de referência (edição)"}
                      </Label>
                      <Input
                        value={step.image_url || ""}
                        onChange={(e) => updateStep(idx, { image_url: e.target.value || undefined })}
                        placeholder="https://... ou {{step1.output}}"
                      />
                    </div>
                  )}

                  {step.kind === "audio" && (
                    <div>
                      <Label className="text-xs">Voz</Label>
                      <Select value={step.voice_id || VOICES[0].value} onValueChange={(v) => updateStep(idx, { voice_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{VOICES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}

                  {(step.kind === "image" || step.kind === "video") && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Proporção</Label>
                        <Select
                          value={step.params?.aspect_ratio || "9:16"}
                          onValueChange={(v) => updateStep(idx, { params: { ...(step.params || {}), aspect_ratio: v, size: v === "1:1" ? "1024x1024" : v === "16:9" ? "1536x864" : "864x1536" } })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="9:16">9:16</SelectItem>
                            <SelectItem value="16:9">16:9</SelectItem>
                            <SelectItem value="1:1">1:1</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {step.kind === "video" && (
                        <div>
                          <Label className="text-xs">Duração</Label>
                          <Select
                            value={String(step.params?.duration || 5)}
                            onValueChange={(v) => updateStep(idx, { params: { ...(step.params || {}), duration: Number(v) } })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5s</SelectItem>
                              <SelectItem value="10">10s</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}

                  {stepOutput && (
                    <div className="rounded border border-border bg-background/40 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">Output</span>
                        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => window.open(stepOutput, "_blank")}>
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                      {step.kind === "image" && <img src={stepOutput} className="max-h-48 mx-auto rounded" />}
                      {step.kind === "video" && <video src={stepOutput} controls className="max-h-48 mx-auto rounded" />}
                      {step.kind === "audio" && <audio src={stepOutput} controls className="w-full" />}
                    </div>
                  )}
                </CardContent>
              </Card>
              {idx < steps.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}

        <Button variant="outline" onClick={addStep} className="w-full gap-1">
          <Plus className="h-4 w-4" /> Adicionar step
        </Button>

        {run?.status === "failed" && (
          <Card className="bg-destructive/10 border-destructive/40">
            <CardContent className="p-3 text-sm text-destructive">Erro: {run.error}</CardContent>
          </Card>
        )}
        {run?.status === "completed" && (
          <Card className="bg-emerald-500/10 border-emerald-500/40">
            <CardContent className="p-3 text-sm text-emerald-400">Workflow concluído com sucesso.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
