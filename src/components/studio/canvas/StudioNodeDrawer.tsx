import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Trash2, ExternalLink, Copy, Play, Eraser } from "lucide-react";
import { CANVAS_BLOCKS } from "./blockTypes";
import { ReferenceUploader } from "./ReferenceUploader";
import { ModelingNodePanel } from "./ModelingNodePanel";
import { StoryboardNodePanel } from "./StoryboardNodePanel";

interface Props {
  node: any | null;
  onClose: () => void;
  onGenerate: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: any) => Promise<void>;
  onDuplicate?: (id: string) => void;
  onRunFrom?: (id: string) => void;
  onExplodeStoryboard?: (opts: { sourceNodeId: string; scenes: any[]; ficha: any; targetKind: "image" | "video" }) => Promise<void>;
}

const MODELS: Record<string, { label: string; value: string }[]> = {
  image: [
    { label: "Nano Banana 2", value: "nano-banana-2" },
    { label: "Seedream 4", value: "seedream-4" },
    { label: "Ideogram v3", value: "ideogram-v3" },
    { label: "Flux Kontext Pro", value: "flux-kontext-pro" },
  ],
  video: [
    { label: "Veo 3.1", value: "veo3.1" },
    { label: "Veo 3 Fast", value: "veo3-fast" },
    { label: "Kling 2.1", value: "kling-2.1" },
    { label: "Seedance 2", value: "seedance-2" },
  ],
  audio: [
    { label: "ElevenLabs Multilingual", value: "eleven_multilingual_v2" },
  ],
  avatar: [
    { label: "Seedance 2 (lipsync)", value: "seedance-2" },
  ],
};

export function StudioNodeDrawer({ node, onClose, onGenerate, onDelete, onUpdate, onDuplicate, onRunFrom, onExplodeStoryboard }: Props) {
  const [titulo, setTitulo] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [voice, setVoice] = useState("");
  const [refUrls, setRefUrls] = useState<string[]>([]);
  const [refKinds, setRefKinds] = useState<string[]>([]);
  const [pubChannel, setPubChannel] = useState("salvar");
  const [pubScheduledAt, setPubScheduledAt] = useState("");
  const [pubCaption, setPubCaption] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (node) {
      setTitulo(node.data.titulo || "");
      setPrompt(node.data.config?.prompt || node.data.config?.texto || "");
      setModel(node.data.config?.model || "");
      setVoice(node.data.config?.voice_id || "");
      setRefUrls(node.data.config?.reference_urls || []);
      setRefKinds(node.data.config?.reference_kinds || []);
      setPubChannel(node.data.config?.channel || "salvar");
      setPubScheduledAt(node.data.config?.scheduled_at || "");
      setPubCaption(node.data.config?.caption || "");
    }
  }, [node?.id]);

  if (!node) return null;
  const meta = CANVAS_BLOCKS.find(b => b.id === node.data.tipo);
  const kind = meta?.kind;
  const output = node.data.output || {};
  const isMedia = node.data.tipo === "media";
  const preview = output.url || output.image_url || output.video_url || output.audio_url || (isMedia ? node.data.config?.url : undefined);
  const supportsRefs = kind === "image" || kind === "video" || node.data.tipo === "avatar";

  const save = async () => {
    setSaving(true);
    const cfg: any = { ...(node.data.config || {}), model, prompt, voice_id: voice, reference_urls: refUrls, reference_kinds: refKinds };
    if (kind === "prompt") cfg.texto = prompt;
    if (kind === "publish") {
      cfg.channel = pubChannel;
      cfg.scheduled_at = pubScheduledAt || null;
      cfg.caption = pubCaption;
    }
    await onUpdate(node.id, { titulo, config: cfg });
    setSaving(false);
  };

  const updateRefs = async (urls: string[], kinds: string[]) => {
    setRefUrls(urls);
    setRefKinds(kinds);
    const cfg = { ...(node.data.config || {}), reference_urls: urls, reference_kinds: kinds };
    await onUpdate(node.id, { config: cfg });
  };

  const clearOutput = async () => {
    await onUpdate(node.id, { output: {}, status: "pendente", cost_actual: null, duration_ms: null, config_hash: null } as any);
  };

  return (
    <Sheet open={!!node} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] bg-secondary/95 backdrop-blur">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-xl">{meta?.icon}</span>
            <span>{meta?.label}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div>
            <Label className="text-xs">Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="h-8 mt-1" />
          </div>

          {isMedia && (
            <div className="rounded-lg border border-slate-500/30 bg-slate-500/5 p-3 space-y-2">
              <Label className="text-xs">Mídia deste bloco</Label>
              <p className="text-[10px] text-muted-foreground">
                Envie do computador ou cole com Ctrl+V. Essa mídia vira o ponto de partida do fluxo — puxe uma seta para animar, narrar ou publicar.
              </p>
              <ReferenceUploader
                urls={node.data.config?.url ? [node.data.config.url] : []}
                kinds={node.data.config?.url ? [node.data.config?.kind || "image"] : []}
                onChange={(urls, kinds) => {
                  const url = urls[urls.length - 1] || "";
                  const k = kinds[kinds.length - 1] || "image";
                  const cfg = { ...(node.data.config || {}), url, kind: k };
                  onUpdate(node.id, {
                    config: cfg,
                    status: url ? "gerado" : "pendente",
                    output: url ? { url, kind: k } : {},
                  } as any);
                }}
              />
            </div>
          )}

          {kind === "modeling" && (
            <ModelingNodePanel
              modelId={node.data.config?.model_id || null}
              onChange={(mid, ficha) => {
                const cfg = { ...(node.data.config || {}), model_id: mid, ficha_snapshot: ficha };
                onUpdate(node.id, { config: cfg });
              }}
            />
          )}

          {kind === "storyboard" && onExplodeStoryboard && (
            <StoryboardNodePanel
              nodeId={node.id}
              modelId={node.data.config?.model_id || null}
              targetKind={(node.data.config?.target_kind as any) || "image"}
              onChangeConfig={(patch) => onUpdate(node.id, { config: { ...(node.data.config || {}), ...patch } })}
              onExplode={onExplodeStoryboard}
            />
          )}


          {kind === "publish" && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
              <div>
                <Label className="text-xs">Canal</Label>
                <Select value={pubChannel} onValueChange={setPubChannel}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salvar">💾 Só salvar na biblioteca</SelectItem>
                    <SelectItem value="instagram">📸 Instagram</SelectItem>
                    <SelectItem value="tiktok">🎵 TikTok</SelectItem>
                    <SelectItem value="youtube">▶️ YouTube Shorts</SelectItem>
                    <SelectItem value="whatsapp">💬 WhatsApp Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Agendar para</Label>
                <Input type="datetime-local" value={pubScheduledAt} onChange={(e) => setPubScheduledAt(e.target.value)} className="h-8 mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">Vazio = publica/salva assim que o fluxo terminar.</p>
              </div>
              <div>
                <Label className="text-xs">Legenda</Label>
                <Textarea value={pubCaption} onChange={(e) => setPubCaption(e.target.value)} rows={4} className="mt-1 text-sm leading-6" placeholder="Legenda do post…" />
              </div>
              <p className="text-[10px] text-muted-foreground">Quando o fluxo rodar, a mídia do nó anterior vira uma publicação na fila.</p>
            </div>
          )}

          {MODELS[kind || ""] && (
            <div>
              <Label className="text-xs">Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Escolha o modelo" /></SelectTrigger>
                <SelectContent>
                  {MODELS[kind!].map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind !== "modeling" && kind !== "publish" && kind !== "storyboard" && (
            <div>
              <Label className="text-xs">{kind === "audio" ? "Roteiro da fala" : kind === "prompt" ? "Prompt / texto" : "Prompt"}</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                className="mt-1 text-sm leading-6"
                placeholder={kind === "audio" ? "O que o narrador vai falar…" : "Descreva a cena…"}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use <code className="text-primary">{"{{anterior.output}}"}</code> para o nó anterior, <code className="text-primary">{"{{modelagem.ficha}}"}</code> para a modelagem conectada.
              </p>
            </div>
          )}

          {kind === "audio" && (
            <div>
              <Label className="text-xs">Voice ID (ElevenLabs)</Label>
              <Input value={voice} onChange={(e) => setVoice(e.target.value)} className="h-8 mt-1 font-mono text-xs" />
            </div>
          )}

          {supportsRefs && (
            <div className="rounded-lg border border-border/60 p-2.5 bg-background/40 space-y-2">
              <Label className="text-xs">Referências visuais</Label>
              <p className="text-[10px] text-muted-foreground">
                Enviadas ao modelo como estilo/composição {node.data.tipo === "avatar" ? "e rosto base" : "de referência"}.
              </p>
              <ReferenceUploader urls={refUrls} kinds={refKinds} onChange={updateRefs} />
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} size="sm" variant="outline" className="flex-1">Salvar</Button>
            {kind !== "publish" && kind !== "prompt" && kind !== "modeling" && kind !== "storyboard" && (
              <Button
                onClick={() => onGenerate(node.id)}
                disabled={node.data.status === "gerando"}
                size="sm"
                className="flex-1 gap-1"
              >
                <Sparkles className="h-3.5 w-3.5" /> Gerar
              </Button>
            )}
          </div>

          {onRunFrom && (
            <Button
              onClick={() => onRunFrom(node.id)}
              size="sm"
              variant="outline"
              className="w-full gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
              title="Executar este nó e todos a jusante"
            >
              <Play className="h-3.5 w-3.5" /> Executar deste nó em diante
            </Button>
          )}

          {(node.data.duration_ms || node.data.cost_actual) && (
            <div className="text-[10px] text-muted-foreground flex gap-3">
              {node.data.duration_ms && <span>⏱ {(node.data.duration_ms / 1000).toFixed(1)}s</span>}
              {node.data.cost_actual && <span>💎 {node.data.cost_actual} créditos</span>}
            </div>
          )}

          {preview && (
            <div className="rounded-lg border border-border/60 p-2 bg-background/40">
              <Label className="text-xs">Preview</Label>
              {output.kind === "image" && <img src={preview} className="w-full rounded mt-2" alt="" />}
              {output.kind === "video" && <video src={preview} controls className="w-full rounded mt-2" />}
              {output.kind === "audio" && <audio src={preview} controls className="w-full mt-2" />}
              <a href={preview} target="_blank" rel="noreferrer" className="text-[10px] text-primary flex items-center gap-1 mt-1">
                <ExternalLink className="h-3 w-3" /> abrir em nova aba
              </a>
            </div>
          )}

          <div className="flex gap-2">
            {onDuplicate && (
              <button
                onClick={() => { onDuplicate(node.id); onClose(); }}
                className="flex-1 text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1 py-2 border border-border/60 rounded"
                title="Duplicar (Ctrl+D)"
              >
                <Copy className="h-3 w-3" /> Duplicar
              </button>
          )}

          {preview && (
            <button
              onClick={clearOutput}
              className="w-full text-xs text-amber-400 hover:text-amber-300 flex items-center justify-center gap-1 py-2 border border-amber-500/30 rounded"
              title="Zera o resultado desta geração para regenerar do zero"
            >
              <Eraser className="h-3 w-3" /> Limpar geração
            </button>
          )}
            <button
              onClick={() => { onDelete(node.id); onClose(); }}
              className="flex-1 text-xs text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1 py-2 border border-rose-500/30 rounded"
            >
              <Trash2 className="h-3 w-3" /> Remover
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
