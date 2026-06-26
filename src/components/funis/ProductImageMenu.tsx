import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Upload, ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  productIdx: number;
  product: any;
  imageUrl?: string;
  onSaved: (url: string) => void;
}

type Provider = "openrouter" | "kie";
type Model = { provider: Provider; id: string; label: string; note?: string };

const MODELS: Model[] = [
  { provider: "openrouter", id: "google/gemini-2.5-flash-image-preview", label: "Gemini 2.5 Flash (Nano Banana)", note: "Rápido • OpenRouter" },
  { provider: "kie",        id: "gpt-image-1",                            label: "GPT-Image 1 (alta qualidade)",   note: "Kie.ai" },
  { provider: "kie",        id: "nano-banana",                            label: "Nano Banana (Kie)",              note: "Kie.ai" },
];

export function ProductImageMenu({ projectId, productIdx, product, imageUrl, onSaved }: Props) {
  const [genOpen, setGenOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState(MODELS[0].id);

  useEffect(() => {
    if (genOpen) {
      const nome = product?.nome || product?.name || "produto";
      const desc = product?.descricao || product?.description || "";
      setPrompt(
        `Product shot premium do "${nome}". ${desc ? "Contexto: " + desc + ". " : ""}` +
        `Composição limpa, fundo elegante neutro/cores da marca, iluminação cinematográfica, alta qualidade, fotorrealista, 1:1.`
      );
    }
  }, [genOpen, product]);

  async function persistImage(url: string) {
    // Update imphq_projects.data.produtos[productIdx].imagem
    const { data: row } = await supabase.from("imphq_projects").select("data").eq("id", projectId).maybeSingle();
    const dataObj: any = row?.data || {};
    const briefingKey = dataObj.briefing ? "briefing" : null;
    const target = briefingKey ? dataObj.briefing : dataObj;
    const produtos = Array.isArray(target.produtos) ? [...target.produtos] : [];
    if (!produtos[productIdx]) produtos[productIdx] = {};
    produtos[productIdx] = {
      ...(typeof produtos[productIdx] === "string" ? { nome: produtos[productIdx] } : produtos[productIdx]),
      imagem: url,
    };
    if (briefingKey) dataObj.briefing = { ...target, produtos };
    else dataObj.produtos = produtos;
    await supabase.from("imphq_projects").update({ data: dataObj }).eq("id", projectId);
    onSaved(url);
  }

  async function handleUpload(file: File) {
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || "anon";
      const path = `produto/${userId}/${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("creative-assets").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("creative-assets").getPublicUrl(path);
      await persistImage(data.publicUrl);
      toast.success("Imagem anexada");
    } catch (e: any) {
      toast.error(e.message || "Falha ao subir imagem");
    } finally {
      setBusy(false);
    }
  }

  async function pollStatus(id: string): Promise<string> {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2500));
      const { data, error } = await supabase.functions.invoke("studio-generate-status", { body: { id } });
      if (error) throw error;
      if (data?.status === "completed" && data?.output_url) return data.output_url;
      if (data?.status === "failed") throw new Error(data?.error || "Geração falhou");
    }
    throw new Error("Tempo esgotado");
  }

  async function handleGenerate() {
    const model = MODELS.find(m => m.id === modelId);
    if (!model) return;
    setBusy(true);
    try {
      const params: any = { aspect_ratio: "1:1" };
      if (model.provider === "kie") {
        params.size = "1024x1024";
        params.quality = "high";
      }
      const { data, error } = await supabase.functions.invoke("studio-generate", {
        body: {
          kind: "image",
          provider: model.provider,
          model: model.id,
          prompt,
          params,
          projeto_id: projectId,
        },
      });
      if (error) throw error;
      let url = data?.output_url;
      if (!url && data?.id) url = await pollStatus(data.id);
      if (!url) throw new Error("Sem URL de saída");
      await persistImage(url);
      toast.success("Imagem gerada");
      setGenOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Falha na geração");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="relative group/img">
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="" className="w-full h-44 object-cover" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
              <button
                data-node
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setGenOpen(true); }}
                className="h-7 px-2 rounded-md bg-fuchsia-600/90 hover:bg-fuchsia-500 text-white text-[10px] font-semibold flex items-center gap-1"
                title="Gerar com IA"
              >
                <RefreshCw className="h-3 w-3" /> Gerar
              </button>
              <button
                data-node
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                className="h-7 px-2 rounded-md bg-card border border-border/60 text-foreground text-[10px] font-semibold flex items-center gap-1"
                title="Anexar"
              >
                <Upload className="h-3 w-3" /> Anexar
              </button>
            </div>
          </>
        ) : (
          <div className="w-full h-44 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-950/40 to-[#0a0608] border-b border-emerald-700/30">
            <ImagePlus className="h-6 w-6 text-emerald-500/60" />
            <div className="flex gap-1.5">
              <button
                data-node
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setGenOpen(true); }}
                className="h-7 px-2.5 rounded-md bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white text-[10px] font-semibold flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3" /> Gerar com IA
              </button>
              <button
                data-node
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                className="h-7 px-2.5 rounded-md bg-card border border-border/60 text-foreground text-[10px] font-semibold flex items-center gap-1"
              >
                <Upload className="h-3 w-3" /> Anexar
              </button>
            </div>
            {busy && <Loader2 className="h-3 w-3 animate-spin text-fuchsia-400" />}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = "";
          }}
        />
      </div>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-lg bg-secondary/40 border-border/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-fuchsia-400" /> Gerar imagem do produto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Modelo</label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELS.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex flex-col">
                        <span>{m.label}</span>
                        {m.note && <span className="text-[10px] text-muted-foreground">{m.note}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                className="mt-1 text-sm leading-6"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={handleGenerate} disabled={busy || !prompt.trim()} className="bg-gradient-to-r from-fuchsia-600 to-pink-600">
              {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Gerando…</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Gerar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
