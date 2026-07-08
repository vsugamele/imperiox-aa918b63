import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Trash2, ExternalLink, Copy } from "lucide-react";
import { CANVAS_BLOCKS } from "./blockTypes";

interface Props {
  node: any | null;
  onClose: () => void;
  onGenerate: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: any) => Promise<void>;
  onDuplicate?: (id: string) => void;
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

export function StudioNodeDrawer({ node, onClose, onGenerate, onDelete, onUpdate, onDuplicate }: Props) {
  const [titulo, setTitulo] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [voice, setVoice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (node) {
      setTitulo(node.data.titulo || "");
      setPrompt(node.data.config?.prompt || node.data.config?.texto || "");
      setModel(node.data.config?.model || "");
      setVoice(node.data.config?.voice_id || "");
    }
  }, [node?.id]);

  if (!node) return null;
  const meta = CANVAS_BLOCKS.find(b => b.id === node.data.tipo);
  const kind = meta?.kind;
  const output = node.data.output || {};
  const preview = output.url || output.image_url || output.video_url || output.audio_url;

  const save = async () => {
    setSaving(true);
    const cfg = { ...(node.data.config || {}), model, prompt, voice_id: voice };
    if (kind === "prompt") cfg.texto = prompt;
    await onUpdate(node.id, { titulo, config: cfg });
    setSaving(false);
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
              Use <code className="text-primary">{"{{anterior.output}}"}</code> para referenciar o nó conectado antes deste.
            </p>
          </div>

          {kind === "audio" && (
            <div>
              <Label className="text-xs">Voice ID (ElevenLabs)</Label>
              <Input value={voice} onChange={(e) => setVoice(e.target.value)} className="h-8 mt-1 font-mono text-xs" />
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} size="sm" variant="outline" className="flex-1">Salvar</Button>
            {kind !== "publish" && kind !== "prompt" && (
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

          <button
            onClick={() => { onDelete(node.id); onClose(); }}
            className="w-full text-xs text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1 py-2 border border-rose-500/30 rounded"
          >
            <Trash2 className="h-3 w-3" /> Remover bloco
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
