import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectList } from "@/hooks/useProjectList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserSquare2, Sparkles, Loader2, Plus, Upload, Trash2, Download, ImageIcon, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";

type AvatarPhoto = { path: string; url: string };
type AvatarProject = {
  id: string;
  nome: string;
  descricao?: string | null;
  avatar_photos: AvatarPhoto[];
  estilo_base?: string | null;
};
type Generation = {
  id: string;
  modo: string;
  prompt: string;
  media_url?: string | null;
  thumbnail_url?: string | null;
  created_at: string;
};

const MODOS: { value: string; label: string; hint: string; suffix: string }[] = [
  {
    value: "ads",
    label: "Criativo de anúncio",
    hint: "Foto do avatar como protagonista de um anúncio.",
    suffix: "Foto publicitária profissional, iluminação de estúdio, composição para anúncio de rede social, direct response, foco no rosto.",
  },
  {
    value: "ugc",
    label: "UGC sintético",
    hint: "Estilo depoimento amador, celular na mão.",
    suffix: "Estilo UGC autêntico, câmera de celular frontal, iluminação natural, expressão espontânea, cenário cotidiano real.",
  },
  {
    value: "consistencia",
    label: "Consistência de personagem",
    hint: "Mesma pessoa em cenas diferentes.",
    suffix: "Manter o mesmo rosto, mesma estrutura facial e traços exatos das referências, apenas mudar cenário e roupa conforme descrito.",
  },
  {
    value: "video_keyframe",
    label: "Keyframe de vídeo",
    hint: "Frame inicial para virar vídeo depois.",
    suffix: "Composição cinematográfica, proporção 9:16, foco cinematográfico, adequado como primeiro frame de um vídeo curto.",
  },
];

export function AvatarStudioTab() {
  const { activeProjectId } = useProject();
  const [avatars, setAvatars] = useState<AvatarProject[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>("");
  const [gens, setGens] = useState<Generation[]>([]);
  const [modo, setModo] = useState("ads");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [previewFinal, setPreviewFinal] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const selectedAvatar = useMemo(
    () => avatars.find((a) => a.id === selectedAvatarId),
    [avatars, selectedAvatarId],
  );

  const load = async () => {
    if (!activeProjectId) return;
    const [aRes, gRes] = await Promise.all([
      supabase
        .from("imphq_avatar_studio_projects")
        .select("*")
        .eq("project_id", activeProjectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("imphq_avatar_studio_generations")
        .select("*")
        .eq("project_id", activeProjectId)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);
    if (aRes.data) {
      setAvatars(aRes.data as any);
      if (!selectedAvatarId && aRes.data[0]) setSelectedAvatarId((aRes.data[0] as any).id);
    }
    if (gRes.data) setGens(gRes.data as any);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const generate = async () => {
    if (!activeProjectId) return toast.error("Selecione um projeto.");
    if (!prompt.trim()) return toast.error("Descreva a cena.");
    if (!selectedAvatar || selectedAvatar.avatar_photos.length === 0)
      return toast.error("Crie um Avatar de referência com pelo menos 1 foto.");

    setBusy(true);
    setPreviewData(null);
    setPreviewFinal(false);

    try {
      // Sign reference URLs
      const paths = selectedAvatar.avatar_photos.map((p) => p.path);
      const { data: signed, error: signErr } = await supabase.storage
        .from("avatar-refs")
        .createSignedUrls(paths, 60 * 30);
      if (signErr) throw signErr;
      const refUrls = (signed || []).map((s) => s.signedUrl).filter(Boolean);

      const modoDef = MODOS.find((m) => m.value === modo)!;
      const fullPrompt = `${prompt.trim()}\n\n${modoDef.suffix}${
        selectedAvatar.estilo_base ? `\n\nEstilo: ${selectedAvatar.estilo_base}` : ""
      }`;

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const projectRef = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string) || "";
      const url = `https://${projectRef}.functions.supabase.co/avatar-image-gen`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
          apikey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "",
        },
        body: JSON.stringify({ prompt: fullPrompt, reference_urls: refUrls }),
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        throw new Error(`Falha: ${res.status} ${t.slice(0, 200)}`);
      }

      let finalB64: string | null = null;
      let streamError: string | null = null;

      const parser = createParser({
        onEvent(ev) {
          let payload: any;
          try { payload = JSON.parse(ev.data); } catch { return; }
          if (ev.event === "error" || payload?.type === "error") {
            streamError = payload?.error?.message || "Erro na geração";
            return;
          }
          if (
            ev.event !== "image_generation.partial_image" &&
            ev.event !== "image_generation.completed"
          ) return;
          if (!payload?.b64_json) return;
          const isFinal = ev.event === "image_generation.completed";
          flushSync(() => {
            setPreviewData(`data:image/png;base64,${payload.b64_json}`);
            setPreviewFinal(isFinal);
          });
          if (isFinal) finalB64 = payload.b64_json;
        },
      });

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.feed(value);
      }
      if (streamError) throw new Error(streamError);
      if (!finalB64) throw new Error("Stream terminou sem imagem final");

      // Upload to bucket + save generation record
      const binary = Uint8Array.from(atob(finalB64), (c) => c.charCodeAt(0));
      const blob = new Blob([binary], { type: "image/png" });
      const filePath = `${activeProjectId}/gen/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      const { error: upErr } = await supabase.storage
        .from("avatar-refs")
        .upload(filePath, blob, { contentType: "image/png", upsert: false });
      if (upErr) throw upErr;
      const { data: signedOne } = await supabase.storage
        .from("avatar-refs")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);
      const mediaUrl = signedOne?.signedUrl || null;

      await supabase.from("imphq_avatar_studio_generations").insert({
        avatar_project_id: selectedAvatar.id,
        project_id: activeProjectId,
        modo,
        prompt: fullPrompt,
        media_url: mediaUrl,
        thumbnail_url: mediaUrl,
        media_type: "image",
        status: "ready",
        metadata: { storage_path: filePath },
      } as any);

      toast.success("Imagem gerada!");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar");
    } finally {
      setBusy(false);
    }
  };

  const removeGen = async (id: string) => {
    if (!confirm("Excluir esta geração?")) return;
    await supabase.from("imphq_avatar_studio_generations").delete().eq("id", id);
    setGens((g) => g.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserSquare2 className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold text-primary">Avatar Studio</h2>
          <p className="text-sm text-muted-foreground">
            Envie fotos do seu avatar e gere criativos, UGC e keyframes já no estilo desejado.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Avatar
        </Button>
      </div>

      {/* Avatar picker */}
      <Card className="bg-secondary/40 border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <Label className="text-xs text-muted-foreground">Avatar de referência</Label>
              <Select value={selectedAvatarId} onValueChange={setSelectedAvatarId}>
                <SelectTrigger>
                  <SelectValue placeholder={avatars.length ? "Selecione um avatar" : "Crie um avatar primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {avatars.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome} · {a.avatar_photos.length} fotos
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedAvatar && (
              <AvatarPhotosStrip
                avatar={selectedAvatar}
                onChanged={load}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generator */}
      <Card className="bg-secondary/40 border-border">
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Modo</Label>
              <Select value={modo} onValueChange={setModo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1 leading-7">
                {MODOS.find((m) => m.value === modo)?.hint}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Descreva a cena / o criativo
              </Label>
              <Textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: o avatar segurando o produto na frente de um café aconchegante, sorriso natural..."
                className="resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={generate} disabled={busy || !selectedAvatar} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Gerar imagem
            </Button>
          </div>

          {previewData && (
            <div className="relative rounded-lg overflow-hidden border border-border bg-black">
              <img
                src={previewData}
                alt="preview"
                className="w-full max-h-[520px] object-contain transition-all"
                style={{ filter: previewFinal ? "none" : "blur(16px)" }}
              />
              {!previewFinal && (
                <div className="absolute top-2 left-2 flex items-center gap-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
                  <Loader2 className="h-3 w-3 animate-spin" /> Renderizando…
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gallery */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg font-semibold text-primary">Galeria</h3>
        </div>
        {gens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma geração ainda.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {gens.map((g) => (
              <div
                key={g.id}
                className="group relative rounded-lg overflow-hidden border border-border bg-secondary/40"
              >
                {g.media_url ? (
                  <img src={g.media_url} alt="" className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center text-xs text-muted-foreground">
                    sem preview
                  </div>
                )}
                <div className="p-2 space-y-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {MODOS.find((m) => m.value === g.modo)?.label || g.modo}
                  </Badge>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-5">{g.prompt}</p>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
                  {g.media_url && (
                    <a
                      href={g.media_url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => removeGen(g.id)}
                    className="rounded-md bg-black/60 p-1.5 text-white hover:bg-destructive/80"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateAvatarDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={activeProjectId}
        onCreated={(id) => {
          setSelectedAvatarId(id);
          load();
        }}
      />
    </div>
  );
}

// ---------- Photos strip ----------
function AvatarPhotosStrip({
  avatar,
  onChanged,
}: {
  avatar: AvatarProject;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList) => {
    setUploading(true);
    try {
      const newPhotos: AvatarPhoto[] = [];
      for (const file of Array.from(files).slice(0, 8)) {
        const path = `${avatar.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
        const { error } = await supabase.storage.from("avatar-refs").upload(path, file, {
          contentType: file.type,
        });
        if (error) throw error;
        const { data: signed } = await supabase.storage
          .from("avatar-refs")
          .createSignedUrl(path, 60 * 60 * 24 * 30);
        newPhotos.push({ path, url: signed?.signedUrl || "" });
      }
      await supabase
        .from("imphq_avatar_studio_projects")
        .update({ avatar_photos: [...avatar.avatar_photos, ...newPhotos] as any })
        .eq("id", avatar.id);
      toast.success("Fotos adicionadas.");
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (path: string) => {
    await supabase.storage.from("avatar-refs").remove([path]);
    await supabase
      .from("imphq_avatar_studio_projects")
      .update({
        avatar_photos: avatar.avatar_photos.filter((p) => p.path !== path) as any,
      })
      .eq("id", avatar.id);
    onChanged();
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {avatar.avatar_photos.map((p) => (
        <div key={p.path} className="relative group">
          <img src={p.url} alt="" className="h-16 w-16 rounded-md object-cover border border-border" />
          <button
            onClick={() => removePhoto(p.path)}
            className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 opacity-0 group-hover:opacity-100 transition"
          >
            <Trash2 className="h-3 w-3 text-white" />
          </button>
        </div>
      ))}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => e.target.files && upload(e.target.files)}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="gap-1 h-16"
      >
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        Enviar fotos
      </Button>
    </div>
  );
}

// ---------- Create dialog ----------
function CreateAvatarDialog({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string | null;
  onCreated: (id: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [estilo, setEstilo] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!projectId) return toast.error("Selecione um projeto");
    if (!nome.trim()) return toast.error("Nome obrigatório");
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("imphq_avatar_studio_projects")
        .insert({
          project_id: projectId,
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          estilo_base: estilo.trim() || null,
          avatar_photos: [] as any,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Avatar criado. Envie as fotos de referência.");
      onOpenChange(false);
      setNome(""); setDescricao(""); setEstilo("");
      if (data?.id) onCreated(data.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/95 border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">Novo Avatar de referência</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Mariana - Avatar principal" />
          </div>
          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Quem é essa pessoa, contexto..." />
          </div>
          <div>
            <Label>Estilo base (opcional)</Label>
            <Input value={estilo} onChange={(e) => setEstilo(e.target.value)} placeholder="Ex: minimalista, tons quentes, fotografia editorial" />
          </div>
          <p className="text-xs text-muted-foreground leading-6">
            Depois de criar, envie de 2 a 6 fotos do avatar (rosto nítido, ângulos variados) para gerar novas cenas.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar Avatar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
