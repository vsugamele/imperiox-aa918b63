import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Filter, Plus, Play, FileText, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Ref {
  id: string;
  titulo: string;
  url?: string | null;
  image_url?: string | null;
  tipo?: string | null;
  content_category?: string | null;
  tags?: string[] | null;
  plataforma?: string | null;
  notas?: string | null;
  created_at?: string | null;
  project_id?: string | null;
  is_video?: boolean | null;
}

const TIPOS = ["all", "criativo", "landing_page", "email", "video", "copy"];
const TIPO_COLORS: Record<string, string> = {
  criativo: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  landing_page: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  email: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  video: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  copy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

function isVideo(u?: string | null) {
  if (!u) return false;
  return /\.(mp4|webm|mov)($|\?)/i.test(u);
}

const PAGE = 40;

export function MobileReferenciasFeed() {
  const [items, setItems] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("all");
  const [selected, setSelected] = useState<Ref | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("imphq_referencias")
      .select("id, titulo, url, image_url, tipo, content_category, tags, plataforma, notas, created_at, project_id, is_video")
      .order("created_at", { ascending: false })
      .limit(300);
    setItems((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(r => {
      if (tipo !== "all" && r.tipo !== tipo) return false;
      if (term) {
        const hay = `${r.titulo || ""} ${(r.tags || []).join(" ")} ${r.plataforma || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [items, q, tipo]);

  const visible = filtered.slice(0, limit);

  return (
    <div className="flex flex-col h-full -m-3 md:-m-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/50 px-3 pt-3 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar referências..."
              className="pl-9 h-11 bg-secondary/40 border-border/50"
              style={{ fontSize: "16px" }}
            />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="h-11 w-11 shrink-0">
                <Filter className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader className="mb-4">
                <SheetTitle className="font-serif text-gold">Filtrar por tipo</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTipo(t)}
                    className={cn(
                      "px-3 py-3 rounded-lg border text-sm text-left capitalize transition-colors",
                      tipo === t
                        ? "bg-gold/15 border-gold/50 text-gold"
                        : "bg-secondary/40 border-border/50 text-foreground/80"
                    )}
                  >
                    {t === "all" ? "Todos" : t.replace("_", " ")}
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {TIPOS.map(t => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={cn(
                "shrink-0 px-3 h-8 rounded-full text-xs font-semibold border whitespace-nowrap capitalize transition-colors",
                tipo === t
                  ? "bg-gold/15 border-gold/50 text-gold"
                  : "bg-secondary/40 border-border/50 text-muted-foreground"
              )}
            >
              {t === "all" ? "Todos" : t.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Masonry feed */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando referências…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-3 px-6 text-center">
            <p className="font-serif italic text-lg text-gold">Nenhuma referência</p>
            <p className="text-xs text-muted-foreground">Adicione a primeira com o botão +</p>
          </div>
        ) : (
          <>
            <div className="columns-2 gap-2 [column-fill:_balance]">
              {visible.map(r => (
                <RefTile key={r.id} r={r} onOpen={() => setSelected(r)} />
              ))}
            </div>
            {filtered.length > limit && (
              <button
                onClick={() => setLimit(l => l + PAGE)}
                className="mt-4 w-full py-3 text-sm text-gold border border-gold/30 rounded-lg hover:bg-gold/10"
              >
                Carregar mais ({filtered.length - limit} restantes)
              </button>
            )}
          </>
        )}
      </div>

      {/* FAB add */}
      <button
        onClick={() => setShowNew(true)}
        className="fixed bottom-[88px] right-4 z-30 h-14 w-14 rounded-full bg-gold text-background shadow-2xl flex items-center justify-center border-2 border-gold/50 md:hidden active:scale-95 transition-transform"
        aria-label="Nova referência"
      >
        <Plus className="h-6 w-6" />
      </button>

      {selected && <RefSheet ref={selected} onClose={() => setSelected(null)} onDeleted={() => { setSelected(null); load(); }} />}
      {showNew && <NewRefSheet onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function RefTile({ r, onOpen }: { r: Ref; onOpen: () => void }) {
  const media = r.image_url || r.url;
  const video = r.is_video || isVideo(r.url);
  return (
    <button
      onClick={onOpen}
      className="mb-2 block w-full break-inside-avoid rounded-lg overflow-hidden border border-border/50 bg-secondary/30 active:scale-[0.98] transition-transform text-left"
    >
      {media && !video ? (
        <img
          src={media}
          alt={r.titulo}
          loading="lazy"
          className="w-full h-auto object-cover"
        />
      ) : video && media ? (
        <div className="relative aspect-[9/16] bg-black">
          <video src={media} className="w-full h-full object-cover" muted preload="metadata" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-black/60 flex items-center justify-center">
              <Play className="h-6 w-6 text-white fill-white" />
            </div>
          </div>
        </div>
      ) : (
        <div className="aspect-[3/4] flex items-center justify-center bg-gradient-to-br from-secondary to-secondary/50 p-4">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
        </div>
      )}
      <div className="px-2 py-2 space-y-1">
        <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{r.titulo}</p>
        {r.tipo && (
          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4", TIPO_COLORS[r.tipo] || "")}>
            {r.tipo.replace("_", " ")}
          </Badge>
        )}
      </div>
    </button>
  );
}

function RefSheet({ ref: r, onClose, onDeleted }: { ref: Ref; onClose: () => void; onDeleted: () => void }) {
  const media = r.image_url || r.url;
  const video = r.is_video || isVideo(r.url);

  const remove = async () => {
    if (!confirm("Remover esta referência?")) return;
    await supabase.from("imphq_referencias").delete().eq("id", r.id);
    toast.success("Removida");
    onDeleted();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[92vh] p-0 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 shrink-0">
          <span className="text-xs uppercase tracking-wider text-gold/80">Referência</span>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {media && !video ? (
            <img src={media} alt={r.titulo} className="w-full h-auto" />
          ) : video && media ? (
            <video src={media} controls className="w-full h-auto max-h-[60vh] bg-black" />
          ) : null}
          <div className="p-4 space-y-3">
            <h2 className="font-serif text-xl text-foreground leading-snug">{r.titulo}</h2>
            <div className="flex flex-wrap gap-1.5">
              {r.tipo && (
                <Badge variant="outline" className={cn("text-[10px]", TIPO_COLORS[r.tipo] || "")}>
                  {r.tipo.replace("_", " ")}
                </Badge>
              )}
              {r.plataforma && <Badge variant="outline" className="text-[10px]">{r.plataforma}</Badge>}
              {(r.tags || []).map(t => (
                <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
              ))}
            </div>
            {r.notas && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{r.notas}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 border-t border-border/50 p-3 flex gap-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
          {r.url && (
            <Button variant="outline" className="flex-1 h-11 gap-2" asChild>
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" /> Abrir
              </a>
            </Button>
          )}
          <Button variant="outline" className="h-11 text-destructive border-destructive/40" onClick={remove}>
            Remover
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NewRefSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [tipo, setTipo] = useState("criativo");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!titulo.trim()) { toast.error("Título obrigatório"); return; }
    setSaving(true);
    const { error } = await supabase.from("imphq_referencias").insert({
      titulo: titulo.trim(),
      url: url.trim() || null,
      tipo,
      notas: notas.trim() || null,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Referência salva");
    onCreated();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle className="font-serif text-gold">Nova referência</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pt-3">
          <Input
            value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título" className="h-11" style={{ fontSize: "16px" }}
          />
          <Input
            value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (imagem, vídeo, link)" className="h-11" style={{ fontSize: "16px" }}
          />
          <div className="flex gap-2 flex-wrap">
            {TIPOS.filter(t => t !== "all").map(t => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={cn(
                  "px-3 h-9 rounded-full text-xs font-semibold border capitalize",
                  tipo === t
                    ? "bg-gold/15 border-gold/50 text-gold"
                    : "bg-secondary/40 border-border/50 text-muted-foreground"
                )}
              >
                {t.replace("_", " ")}
              </button>
            ))}
          </div>
          <textarea
            value={notas} onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas..." rows={5}
            className="w-full rounded-md bg-secondary/40 border border-border/50 px-3 py-2 text-sm resize-none"
            style={{ fontSize: "16px" }}
          />
        </div>
        <div className="shrink-0 flex gap-2 pt-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <Button variant="outline" className="flex-1 h-11" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 h-11 bg-gold text-background hover:bg-gold/90" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
