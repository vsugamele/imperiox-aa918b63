import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Image as ImageIcon, Video, Mic, Trash2, Download, RefreshCw, X, Music } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileUpload } from "@/components/FileUpload";

type Generation = {
  id: string;
  kind: "image" | "video" | "audio";
  provider: string;
  model: string;
  prompt: string;
  status: string;
  output_url: string | null;
  error: string | null;
  external_id: string | null;
  created_at: string;
};

const IMAGE_MODELS_OPENROUTER = [
  { value: "google/gemini-3-flash-image-preview", label: "Gemini 3.1 Flash (Nano Banana 2)" },
  { value: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image" },
  { value: "recraft/recraft-v4-pro", label: "Recraft V4 Pro (texto legível, $0.25)" },
  { value: "recraft/recraft-v4", label: "Recraft V4 ($0.04)" },
];

const IMAGE_MODELS_KIE = [
  { value: "gpt-image-2", label: "GPT Image 2 (OpenAI — fotorealista, edita)" },
  { value: "nano-banana", label: "Nano Banana (Gemini 2.5 Flash — rápido, edição multi-img)" },
  { value: "nano-banana-2", label: "Nano Banana 2 (Pro — qualidade alta)" },
  { value: "flux-kontext-pro", label: "Flux Kontext Pro (edição contextual)" },
  { value: "flux-kontext-max", label: "Flux Kontext Max (máxima fidelidade)" },
  { value: "seedream-4", label: "Seedream 4 (Bytedance — fotorealista)" },
  { value: "ideogram-v3", label: "Ideogram V3 (texto legível em imagem)" },
  { value: "qwen-image-edit", label: "Qwen Image Edit (edição conversacional)" },
];

const IMAGE_MODELS_LUMA = [
  { value: "uni-1", label: "Luma uni-1 (rápido, multi-painel, edita imagem)" },
];

const VIDEO_MODELS_OPENROUTER = [
  { value: "bytedance/seedance-2.0-fast", label: "Seedance 2.0 Fast (rápido)" },
  { value: "bytedance/seedance-2.0", label: "Seedance 2.0 Pro" },
];

const VIDEO_MODELS_KIE = [
  { value: "seedance-2", label: "Seedance 2 (Bytedance — LIPSYNC com áudio)" },
  { value: "veo3-fast", label: "Google Veo 3 Fast" },
  { value: "veo3", label: "Google Veo 3" },
  { value: "veo3.1", label: "Google Veo 3.1 (mais novo)" },
  { value: "sora-2", label: "OpenAI Sora 2" },
  { value: "kling-2.1", label: "Kling 2.1" },
  { value: "runway-gen4", label: "Runway Gen-4 Turbo" },
  { value: "hailuo-02", label: "MiniMax Hailuo 02" },
  { value: "wan-2.2", label: "Alibaba Wan 2.2" },
  { value: "pixverse-v5", label: "Pixverse V5" },
  { value: "minimax-video-01", label: "MiniMax Video 01" },
];

const LIPSYNC_MODELS = new Set(["seedance-2"]);

const VOICES = [
  { value: "JBFqnCBsd6RMkjVDRZzb", label: "George (masc, narrador)" },
  { value: "EXAVITQu4vr4xnSDxMaL", label: "Sarah (fem, calma)" },
  { value: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam (masc, jovem)" },
  { value: "XB0fDUnXU5powFXDhCwa", label: "Charlotte (fem, suave)" },
  { value: "onwK4e9ZLuTAKqWW03F9", label: "Daniel (masc, autoridade)" },
];

export function StudioGenerator() {
  const [activeKind, setActiveKind] = useState<"image" | "video" | "audio">("image");
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Image form
  const [imgProvider, setImgProvider] = useState<"openrouter" | "kie" | "luma">("openrouter");
  const [imgModel, setImgModel] = useState(IMAGE_MODELS_OPENROUTER[0].value);
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgRefUrl, setImgRefUrl] = useState("");
  const [imgAspect, setImgAspect] = useState("1:1");

  // Video form
  const [vidProvider, setVidProvider] = useState<"openrouter" | "kie">("openrouter");
  const [vidModel, setVidModel] = useState(VIDEO_MODELS_OPENROUTER[0].value);
  const [vidPrompt, setVidPrompt] = useState("");
  const [vidImage, setVidImage] = useState("");
  const [vidDuration, setVidDuration] = useState("5");
  const [vidAspect, setVidAspect] = useState("9:16");
  const [vidResolution, setVidResolution] = useState("1080p");
  // Lipsync (Seedance 2)
  const [audioRefUrls, setAudioRefUrls] = useState<string[]>([]);
  const [audioUrlInput, setAudioUrlInput] = useState("");
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [generatedAudios, setGeneratedAudios] = useState<Generation[]>([]);

  function addAudioUrl(u: string) {
    const url = u.trim();
    if (!url) return;
    if (audioRefUrls.length >= 3) { toast.error("Máximo 3 áudios de referência"); return; }
    if (audioRefUrls.includes(url)) return;
    setAudioRefUrls([...audioRefUrls, url]);
    setAudioUrlInput("");
  }

  async function openAudioPicker() {
    setAudioPickerOpen(true);
    const { data } = await supabase
      .from("imphq_studio_generations")
      .select("*")
      .eq("kind", "audio")
      .not("output_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    setGeneratedAudios((data as any) || []);
  }

  // Audio form
  const [audVoice, setAudVoice] = useState(VOICES[0].value);
  const [audText, setAudText] = useState("");

  async function loadGallery() {
    setLoading(true);
    const { data } = await supabase
      .from("imphq_studio_generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    setItems((data as any) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadGallery();
  }, []);

  // Auto-poll any "processing" Kie items
  useEffect(() => {
    const processing = items.filter((i) => i.status === "processing" && i.external_id);
    if (processing.length === 0) return;
    const t = setInterval(async () => {
      for (const it of processing) {
        await supabase.functions.invoke("studio-generate-status", { body: { id: it.id } });
      }
      loadGallery();
    }, 8000);
    return () => clearInterval(t);
  }, [items]);

  async function generate() {
    setBusy(true);
    try {
      let payload: any;
      if (activeKind === "image") {
        if (!imgPrompt.trim()) return toast.error("Prompt vazio");
        payload = {
          kind: "image",
          provider: imgProvider,
          model: imgModel,
          prompt: imgPrompt,
          image_url: imgRefUrl || undefined,
          params: imgProvider === "openrouter" ? {} : { aspect_ratio: imgAspect, size: imgAspect === "1:1" ? "1024x1024" : imgAspect === "16:9" ? "1536x864" : "864x1536", quality: "high" },
        };
      } else if (activeKind === "video") {
        if (!vidPrompt.trim()) return toast.error("Prompt vazio");
        const isLipsync = vidProvider === "kie" && LIPSYNC_MODELS.has(vidModel);
        if (isLipsync && audioRefUrls.length === 0) {
          return toast.error("Seedance 2: adicione pelo menos 1 URL de áudio de referência");
        }
        if (isLipsync && !vidImage) {
          return toast.error("Seedance 2 com lipsync exige uma imagem inicial (first frame)");
        }
        const params: Record<string, any> = {
          duration: Number(vidDuration),
          aspect_ratio: vidAspect,
          resolution: isLipsync ? vidResolution : "720p",
        };
        if (isLipsync) {
          params.reference_audio_urls = audioRefUrls;
          params.generate_audio = false;
        }
        payload = {
          kind: "video",
          provider: vidProvider,
          model: vidModel,
          prompt: vidPrompt,
          image_url: vidImage || undefined,
          params,
        };
      } else {
        if (!audText.trim()) return toast.error("Texto vazio");
        payload = { kind: "audio", provider: "elevenlabs", model: "eleven_multilingual_v2", prompt: audText, voice_id: audVoice };
      }

      const { data, error } = await supabase.functions.invoke("studio-generate", { body: payload });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha na geração");
      toast.success(data.status === "processing" ? "Job enviado — aguardando renderização..." : "Gerado!");
      loadGallery();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Apagar esta geração?")) return;
    await supabase.from("imphq_studio_generations").delete().eq("id", id);
    loadGallery();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
      {/* LEFT: Form */}
      <Card className="bg-secondary/40 border-border h-fit">
        <CardContent className="p-5 space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant={activeKind === "image" ? "default" : "outline"} onClick={() => setActiveKind("image")} className="flex-1 gap-1">
              <ImageIcon className="h-4 w-4" /> Imagem
            </Button>
            <Button size="sm" variant={activeKind === "video" ? "default" : "outline"} onClick={() => setActiveKind("video")} className="flex-1 gap-1">
              <Video className="h-4 w-4" /> Vídeo
            </Button>
            <Button size="sm" variant={activeKind === "audio" ? "default" : "outline"} onClick={() => setActiveKind("audio")} className="flex-1 gap-1">
              <Mic className="h-4 w-4" /> Áudio
            </Button>
          </div>

          {activeKind === "image" && (
            <>
              <div>
                <Label className="text-xs">Provider</Label>
                <Select value={imgProvider} onValueChange={(v: any) => {
                  setImgProvider(v);
                  setImgModel(v === "openrouter" ? IMAGE_MODELS_OPENROUTER[0].value : v === "kie" ? IMAGE_MODELS_KIE[0].value : IMAGE_MODELS_LUMA[0].value);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openrouter">OpenRouter (Gemini / Recraft — síncrono)</SelectItem>
                    <SelectItem value="kie">Kie.ai (GPT Image 2 — assíncrono)</SelectItem>
                    <SelectItem value="luma">Luma (uni-1 — assíncrono)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Modelo</Label>
                <Select value={imgModel} onValueChange={setImgModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(imgProvider === "openrouter" ? IMAGE_MODELS_OPENROUTER : imgProvider === "kie" ? IMAGE_MODELS_KIE : IMAGE_MODELS_LUMA).map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Prompt</Label>
                <Textarea rows={6} value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} placeholder="Cena ultrarrealista, iluminação cinematográfica..." />
              </div>
              {(imgProvider === "kie" || imgProvider === "luma") && (
                <>
                  <div>
                    <Label className="text-xs">Imagem de referência (opcional — para edição)</Label>
                    <Input value={imgRefUrl} onChange={(e) => setImgRefUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <div>
                    <Label className="text-xs">Proporção</Label>
                    <Select value={imgAspect} onValueChange={setImgAspect}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1:1">1:1</SelectItem>
                        <SelectItem value="9:16">9:16 (Reels / Story)</SelectItem>
                        <SelectItem value="16:9">16:9</SelectItem>
                        <SelectItem value="3:4">3:4</SelectItem>
                        <SelectItem value="4:3">4:3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </>
          )}

          {activeKind === "video" && (
            <>
              <div>
                <Label className="text-xs">Provider</Label>
                <Select value={vidProvider} onValueChange={(v: any) => { setVidProvider(v); setVidModel(v === "openrouter" ? VIDEO_MODELS_OPENROUTER[0].value : VIDEO_MODELS_KIE[0].value); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openrouter">OpenRouter (Seedance — síncrono)</SelectItem>
                    <SelectItem value="kie">Kie.ai (Veo / Sora / Kling — assíncrono)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Modelo</Label>
                <Select value={vidModel} onValueChange={setVidModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(vidProvider === "openrouter" ? VIDEO_MODELS_OPENROUTER : VIDEO_MODELS_KIE).map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Prompt</Label>
                <Textarea rows={5} value={vidPrompt} onChange={(e) => setVidPrompt(e.target.value)} placeholder="Cena, ação, movimento de câmera..." />
              </div>
              <div>
                <Label className="text-xs">
                  {vidProvider === "kie" && LIPSYNC_MODELS.has(vidModel) ? "Imagem do avatar (first frame — obrigatório)" : "Imagem inicial (opcional, image-to-video)"}
                </Label>
                <Input value={vidImage} onChange={(e) => setVidImage(e.target.value)} placeholder="https://..." />
              </div>

              {vidProvider === "kie" && LIPSYNC_MODELS.has(vidModel) && (
                <div className="rounded border border-primary/40 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-primary" />
                    <Label className="text-xs font-semibold">Áudio de Referência (Lipsync)</Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-4">
                    Até 3 áudios. Combinado ≤ 15s. O Seedance 2 sincroniza os lábios do avatar com este áudio.
                  </p>
                  {audioRefUrls.length > 0 && (
                    <div className="space-y-1">
                      {audioRefUrls.map((u, i) => (
                        <div key={i} className="flex items-center gap-1 text-[11px] bg-background/40 rounded px-2 py-1">
                          <span className="flex-1 truncate">{u}</span>
                          <button onClick={() => setAudioRefUrls(audioRefUrls.filter((_, j) => j !== i))}>
                            <X className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Input
                      value={audioUrlInput}
                      onChange={(e) => setAudioUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAudioUrl(audioUrlInput))}
                      placeholder="https://...mp3"
                      className="h-8 text-xs"
                    />
                    <Button size="sm" variant="outline" onClick={() => addAudioUrl(audioUrlInput)}>+</Button>
                  </div>
                  <div className="flex gap-2">
                    <FileUpload
                      bucket="creative-assets"
                      path="studio-audio"
                      accept="audio/*"
                      label="Upload"
                      onUpload={(url) => addAudioUrl(url)}
                    />
                    <Button size="sm" variant="outline" onClick={openAudioPicker}>
                      <Music className="h-3 w-3 mr-1" /> Áudio gerado
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">Resolução</Label>
                    <Select value={vidResolution} onValueChange={setVidResolution}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="720p">720p</SelectItem>
                        <SelectItem value="1080p">1080p</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Duração (s)</Label>
                  <Select value={vidDuration} onValueChange={setVidDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5s</SelectItem>
                      <SelectItem value="10">10s</SelectItem>
                      {vidProvider === "kie" && LIPSYNC_MODELS.has(vidModel) && <SelectItem value="15">15s</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Proporção</Label>
                  <Select value={vidAspect} onValueChange={setVidAspect}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9:16">9:16 (Reels)</SelectItem>
                      <SelectItem value="16:9">16:9</SelectItem>
                      <SelectItem value="1:1">1:1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {activeKind === "audio" && (
            <>
              <div>
                <Label className="text-xs">Voz (ElevenLabs)</Label>
                <Select value={audVoice} onValueChange={setAudVoice}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VOICES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Texto (script)</Label>
                <Textarea rows={7} value={audText} onChange={(e) => setAudText(e.target.value)} placeholder="O que a voz vai falar..." />
              </div>
            </>
          )}

          <Button onClick={generate} disabled={busy} className="w-full">
            {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</> : "Gerar"}
          </Button>
          <p className="text-[11px] text-muted-foreground leading-5">
            Vídeo via Kie.ai pode levar 1–4 minutos. Resultado aparece automaticamente na galeria.
          </p>
        </CardContent>
      </Card>

      {/* RIGHT: Gallery */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl text-primary">Galeria</h3>
          <Button size="sm" variant="ghost" onClick={loadGallery} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {items.length === 0 && (
          <div className="text-center text-muted-foreground py-12 border border-dashed border-border rounded-lg">
            Nenhuma geração ainda.
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((it) => (
            <Card key={it.id} className="bg-secondary/40 border-border overflow-hidden group">
              <div className="aspect-square bg-background/40 flex items-center justify-center relative">
                {it.status === "processing" || it.status === "pending" ? (
                  <div className="text-center text-xs text-muted-foreground p-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Renderizando...
                  </div>
                ) : it.status === "failed" ? (
                  <div className="text-center text-xs text-destructive p-2 leading-5">{it.error?.slice(0, 120) || "Falhou"}</div>
                ) : it.kind === "image" && it.output_url ? (
                  <img src={it.output_url} className="w-full h-full object-cover" />
                ) : it.kind === "video" && it.output_url ? (
                  <video src={it.output_url} className="w-full h-full object-cover" controls />
                ) : it.kind === "audio" && it.output_url ? (
                  <div className="p-3 w-full">
                    <Mic className="h-8 w-8 text-primary mx-auto mb-2" />
                    <audio src={it.output_url} controls className="w-full" />
                  </div>
                ) : null}
              </div>
              <div className="p-2 space-y-1">
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px]">{it.kind}</Badge>
                  <Badge variant="outline" className="text-[10px] truncate">{it.model.split("/").pop()}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-4">{it.prompt}</p>
                <div className="flex gap-1">
                  {it.output_url && (
                    <Button size="sm" variant="ghost" className="h-7 flex-1" onClick={() => window.open(it.output_url!, "_blank")}>
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => remove(it.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
