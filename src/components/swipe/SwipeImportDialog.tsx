import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileJson, Type, Link as LinkIcon, Video, FileVideo } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}

export function SwipeImportDialog({ open, onOpenChange, onImported }: Props) {
  const [tab, setTab] = useState("json");
  const [json, setJson] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [nicho, setNicho] = useState("");
  const [forceFormat, setForceFormat] = useState<"auto" | "vsl" | "short">("auto");
  const [loading, setLoading] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoAutoEng, setVideoAutoEng] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<string>("");


  // VSL form
  const [vsl, setVsl] = useState({
    title: "",
    url: "",
    transcricao: "",
    criador: "",
    plataforma: "YouTube",
    duracao: "",
    rating: 4,
    hook: "",
    oferta: "",
    cta: "",
  });

  const cleanJson = (raw: string) => {
    // Remove markdown fences (```json ... ```)
    return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  };

  const tryRecover = (raw: string): { data: any; recovered: number } | null => {
    // Tenta recuperar JSON truncado: fecha no último roteiro completo dentro de "roteiros":[...]
    try {
      const m = raw.match(/"roteiros"\s*:\s*\[/i) || raw.match(/"copies"\s*:\s*\[/i) || raw.match(/"swipes"\s*:\s*\[/i);
      if (!m) return null;
      const startIdx = raw.indexOf("[", m.index!);
      let depth = 0, lastGood = -1, inStr = false, esc = false;
      for (let i = startIdx; i < raw.length; i++) {
        const c = raw[i];
        if (esc) { esc = false; continue; }
        if (c === "\\") { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === "{" || c === "[") depth++;
        else if (c === "}" || c === "]") {
          depth--;
          if (depth === 1 && c === "}") lastGood = i; // fim de um item dentro do array
          if (depth === 0) break;
        }
      }
      if (lastGood < 0) return null;
      const fixed = raw.slice(0, lastGood + 1) + "]}";
      const data = JSON.parse(fixed);
      return { data, recovered: (data.roteiros || data.copies || data.swipes || []).length };
    } catch {
      return null;
    }
  };

  const handleVideoUpload = async () => {
    if (!videoFile) return toast.error("Selecione um arquivo de vídeo");
    if (!videoTitle.trim()) return toast.error("Dê um título");
    const sizeMB = videoFile.size / 1024 / 1024;
    if (sizeMB > 24) {
      return toast.error(`Arquivo ${sizeMB.toFixed(1)}MB excede 24MB. Comprima antes de subir.`);
    }
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Não autenticado");

      const ext = videoFile.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      setUploadProgress("Subindo vídeo...");
      const { error: upErr } = await supabase.storage
        .from("swipe-media")
        .upload(path, videoFile, { contentType: videoFile.type || "video/mp4" });
      if (upErr) throw upErr;

      setUploadProgress("Criando registro...");
      const { data: row, error: insErr } = await supabase
        .from("imphq_swipes" as any)
        .insert({
          user_id: userId,
          title: videoTitle,
          formato: "vsl",
          plataforma: "Upload",
          nicho: nicho || null,
          media_urls: [path],
          media_type: "video",
          transcribe_status: "queued",
          tags: [`${sizeMB.toFixed(1)}MB`],
          blocks: {},
          gatilhos: [],
        } as any)
        .select("id")
        .single();
      if (insErr) throw insErr;

      setUploadProgress("Transcrevendo (pode levar 30-90s)...");
      const { error: tErr } = await supabase.functions.invoke("swipe-video-transcribe", {
        body: { swipe_id: (row as any).id, storage_path: path, auto_engineer: videoAutoEng },
      });
      if (tErr) throw tErr;

      toast.success(videoAutoEng ? "Vídeo transcrito! Engenharia reversa rodando em background." : "Vídeo transcrito!");
      onImported();
      onOpenChange(false);
      setVideoFile(null);
      setVideoTitle("");
      setUploadProgress("");
    } catch (e: any) {
      toast.error(e.message || "Falha no upload");
      setUploadProgress("");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (tab === "video") return handleVideoUpload();
    setLoading(true);
    try {
      let payload: any;
      if (tab === "json") {
        const raw = cleanJson(json);
        if (!raw) throw new Error("Cole um JSON");
        try {
          payload = JSON.parse(raw);
        } catch (parseErr: any) {
          // tenta recuperar truncamento
          const recovered = tryRecover(raw);
          if (recovered) {
            payload = recovered.data;
            toast.warning(`JSON estava truncado — recuperei ${recovered.recovered} roteiro(s) válido(s).`);
          } else {
            const pos = (parseErr?.message || "").match(/position (\d+)/);
            const hint = pos ? ` (posição ${pos[1]} — provável paste truncado)` : "";
            throw new Error(`JSON inválido${hint}. Detalhe: ${parseErr?.message || "erro desconhecido"}`);
          }
        }
      } else if (tab === "text") {
        if (!text.trim()) throw new Error("Cole o texto");
        payload = text;
      } else if (tab === "url") {
        if (!url.trim()) throw new Error("Informe a URL");
        payload = url;
      } else if (tab === "vsl") {
        if (!vsl.title.trim()) throw new Error("Dê um título à VSL");
        if (!vsl.url.trim() && !vsl.transcricao.trim()) throw new Error("Cole pelo menos a URL ou a transcrição");
        const { data: u } = await supabase.auth.getUser();
        const row: any = {
          user_id: u.user?.id,
          title: vsl.title,
          formato: "vsl",
          plataforma: vsl.plataforma || "YouTube",
          criador: vsl.criador || null,
          nicho: nicho || null,
          rating: vsl.rating || null,
          media_urls: vsl.url ? [vsl.url] : [],
          raw_text: vsl.transcricao || null,
          blocks: {
            gancho: vsl.hook || "",
            cta_venda: vsl.cta || "",
            narrativa: vsl.transcricao || "",
          },
          tags: vsl.duracao ? [`${vsl.duracao}min`] : [],
          gatilhos: [],
          reverse_engineering: vsl.oferta ? { oferta: vsl.oferta } : {},
        };
        const { error: insErr } = await supabase.from("imphq_swipes" as any).insert(row);
        if (insErr) throw insErr;
        toast.success("VSL adicionada ao banco!");
        onImported();
        onOpenChange(false);
        setVsl({ title: "", url: "", transcricao: "", criador: "", plataforma: "YouTube", duracao: "", rating: 4, hook: "", oferta: "", cta: "" });
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("swipe-import", {
        body: { mode: tab === "json" ? "json" : tab, payload: tab === "json" ? payload : payload, nicho: nicho || null, force_format: forceFormat === "auto" ? null : forceFormat },
      });

      if (error) throw error;
      console.log("[swipe-import] result:", data);
      toast.success(`${data.count} swipe(s) importadas!`);
      onImported();
      onOpenChange(false);
      setJson("");
      setText("");
      setUrl("");
      setNicho("");
    } catch (e: any) {
      toast.error(e.message || "Falha ao importar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/40 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Importar para o Swipe File
          </DialogTitle>
          <DialogDescription className="text-xs leading-7">
            Três modos de importar copys: JSON estruturado, texto bruto (a IA quebra) ou URL.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Nicho (opcional, aplicado a todas)</Label>
            <Input
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
              placeholder="ex: cartomante, emagrecimento, finanças"
              className="bg-background h-8 text-sm mt-1"
            />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="json" className="text-xs gap-1"><FileJson className="h-3 w-3" /> JSON</TabsTrigger>
              <TabsTrigger value="text" className="text-xs gap-1"><Type className="h-3 w-3" /> Texto</TabsTrigger>
              <TabsTrigger value="url" className="text-xs gap-1"><LinkIcon className="h-3 w-3" /> URL</TabsTrigger>
              <TabsTrigger value="vsl" className="text-xs gap-1"><Video className="h-3 w-3" /> VSL</TabsTrigger>
              <TabsTrigger value="video" className="text-xs gap-1"><FileVideo className="h-3 w-3" /> Vídeo</TabsTrigger>
            </TabsList>

            <TabsContent value="json" className="space-y-2">
              <Label className="text-xs">Cole o JSON</Label>
              <Textarea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder={`{\n  "produto": "Soulmate Test",\n  "criador": "@gstalves",\n  "plataforma": "Instagram",\n  "roteiros": [\n    {\n      "id": "A",\n      "titulo": "Segredo Duplo",\n      "formato": "Reel",\n      "mecanismo": "segredo + escassez",\n      "gancho": "...",\n      "narrativa": "...",\n      "reframe": "...",\n      "cta_engajamento": "...",\n      "cta_venda": "..."\n    }\n  ]\n}`}
                className="bg-background font-mono text-xs min-h-[280px]"
              />
              <p className="text-[10px] text-muted-foreground">
                Aceita o formato exato do exemplo (campos: titulo, formato, mecanismo, gancho, participacao_ativa, narrativa, reframe, cta_engajamento, cta_venda).
              </p>
            </TabsContent>

            <TabsContent value="text" className="space-y-2">
              <Label className="text-xs">Cole o texto bruto da copy</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cole aqui qualquer copy: legenda de Reel, roteiro de VSL, e-mail, post… A IA quebra automaticamente. Se for VSL longa (>1500 palavras), aplica esquema de 7 blocos."
                className="bg-background text-sm min-h-[280px] leading-7"
              />
              <div className="flex items-center gap-2 pt-1">
                <Label className="text-[10px] text-muted-foreground">Forçar formato:</Label>
                {(["auto", "vsl", "short"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setForceFormat(f)}
                    className={`text-[10px] px-2 py-0.5 rounded border ${forceFormat === f ? "border-primary bg-primary/20 text-primary" : "border-border/40 text-muted-foreground"}`}
                  >
                    {f === "auto" ? "Auto (detectar)" : f === "vsl" ? "VSL (7 blocos)" : "Copy curta (6 blocos)"}
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-2">
              <Label className="text-xs">URL da página</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="bg-background text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Funciona melhor com Landing Pages, páginas de venda e posts públicos. Para Reels/TikTok, o conteúdo extraído é a legenda + comentários.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Label className="text-[10px] text-muted-foreground">Forçar formato:</Label>
                {(["auto", "vsl", "short"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setForceFormat(f)}
                    className={`text-[10px] px-2 py-0.5 rounded border ${forceFormat === f ? "border-primary bg-primary/20 text-primary" : "border-border/40 text-muted-foreground"}`}
                  >
                    {f === "auto" ? "Auto" : f === "vsl" ? "VSL (7 blocos)" : "Copy curta"}
                  </button>
                ))}
              </div>
            </TabsContent>


            <TabsContent value="vsl" className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Título da VSL *</Label>
                  <Input value={vsl.title} onChange={(e) => setVsl({ ...vsl, title: e.target.value })} placeholder="Ex: VSL Soulmate — Hook 'Carta a um Estranho'" className="bg-background h-8 text-sm" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">URL do vídeo (YouTube / Vimeo / MP4)</Label>
                  <Input value={vsl.url} onChange={(e) => setVsl({ ...vsl, url: e.target.value })} placeholder="https://youtube.com/watch?v=..." className="bg-background h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Criador</Label>
                  <Input value={vsl.criador} onChange={(e) => setVsl({ ...vsl, criador: e.target.value })} placeholder="@gstalves" className="bg-background h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Plataforma</Label>
                  <Input value={vsl.plataforma} onChange={(e) => setVsl({ ...vsl, plataforma: e.target.value })} className="bg-background h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Duração (min)</Label>
                  <Input value={vsl.duracao} onChange={(e) => setVsl({ ...vsl, duracao: e.target.value })} placeholder="22" className="bg-background h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Nota (1-5)</Label>
                  <Input type="number" min={1} max={5} value={vsl.rating} onChange={(e) => setVsl({ ...vsl, rating: parseInt(e.target.value) || 0 })} className="bg-background h-8 text-sm" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Hook (1ª frase)</Label>
                  <Input value={vsl.hook} onChange={(e) => setVsl({ ...vsl, hook: e.target.value })} placeholder="Há 3 anos descobri um segredo que..." className="bg-background h-8 text-sm" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Oferta / CTA principal</Label>
                  <Input value={vsl.cta} onChange={(e) => setVsl({ ...vsl, cta: e.target.value })} placeholder="Clique abaixo e leve por R$ 27..." className="bg-background h-8 text-sm" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Transcrição (recomendado)</Label>
                  <Textarea value={vsl.transcricao} onChange={(e) => setVsl({ ...vsl, transcricao: e.target.value })} placeholder="Cole a transcrição completa. A IA usa isso na engenharia reversa." className="bg-background text-sm min-h-[160px] leading-7" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Vai ser salvo como swipe com <code>formato="vsl"</code>. O player aparece no detalhe e você pode rodar engenharia reversa e gerar criativos atrelados.
              </p>
            </TabsContent>

            <TabsContent value="video" className="space-y-3">
              <div>
                <Label className="text-xs">Título *</Label>
                <Input
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Ex: VSL concorrente — Carta a um estranho"
                  className="bg-background h-8 text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Arquivo (mp4/webm/mov · até 24MB)</Label>
                <Input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-m4v,audio/mp4,audio/mpeg,audio/wav,audio/webm"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="bg-background text-sm mt-1 file:text-xs"
                />
                {videoFile && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {videoFile.name} · {(videoFile.size / 1024 / 1024).toFixed(1)}MB
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={videoAutoEng}
                  onChange={(e) => setVideoAutoEng(e.target.checked)}
                  className="accent-[hsl(var(--gold))]"
                />
                Rodar engenharia reversa automática após transcrever
              </label>
              {uploadProgress && (
                <div className="text-xs text-[hsl(var(--gold))] flex items-center gap-2 bg-secondary/40 px-3 py-2 rounded-md">
                  <Loader2 className="h-3 w-3 animate-spin" /> {uploadProgress}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground leading-5">
                Sobe o arquivo no Storage privado e transcreve via Whisper (gpt-4o-mini-transcribe).
                A transcrição vira o <code>raw_text</code> e o bloco <code>narrativa</code>.
                Para arquivos &gt; 24MB, comprima antes (ffmpeg: <code>-vf scale=-2:480 -b:a 64k</code>).
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {loading ? "Importando…" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
