import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ImageIcon, Globe, FolderPlus, FolderOpen, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RefItem {
  id: string;
  url: string;
  title: string;
  thumb: string | null;
  created_at: string;
}

interface SiteItem {
  id: string;
  url: string;
  title: string;
  thumb: string | null;
  tipo: string;
  created_at: string;
}

interface FolderItem {
  id: string;
  nome: string;
  cor: string | null;
  cover_url: string | null;
  count?: number;
}

export type PickerSelection = {
  url: string;
  title: string;
  kind: "image" | "site" | "folder";
  thumbnail?: string | null;
  siteId?: string;
  folderId?: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (item: PickerSelection) => void;
  /** Aba inicial */
  initialTab?: "image" | "site" | "folder";
  /** Multi-select mode: shows checkboxes and confirm button */
  multi?: boolean;
  /** Called on confirm when multi=true */
  onConfirm?: (items: PickerSelection[]) => void;
}

const PAGE = 60;
const TIPO_LABEL: Record<string, string> = {
  lp: "LP", vsl: "VSL", checkout: "Checkout", obrigado: "Obrigado", captura: "Captura", outro: "Outro",
};

const isImageUrl = (u?: string | null) =>
  !!u && /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(u);

export function ReferenciasPicker({ open, onClose, onSelect, initialTab = "image", multi = false, onConfirm }: Props) {
  const [tab, setTab] = useState<"image" | "site">(initialTab);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RefItem[]>([]);
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState<Map<string, PickerSelection>>(new Map());

  useEffect(() => { if (open) { setTab(initialTab); setPicked(new Map()); } }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const [refs, lib, sitesRes] = await Promise.all([
          supabase
            .from("imphq_referencias")
            .select("id, titulo, url, thumbnail_url, created_at, tipo")
            .order("created_at", { ascending: false })
            .limit(300),
          supabase
            .from("imphq_content_library" as any)
            .select("id, title, file_url, file_type, thumbnail_url, created_at")
            .order("created_at", { ascending: false })
            .limit(300),
          supabase
            .from("imphq_sites" as any)
            .select("id, titulo, url, tipo, thumbnail_url, status, created_at")
            .neq("status", "arquivado")
            .order("created_at", { ascending: false })
            .limit(300),
        ]);

        const merged: RefItem[] = [];
        for (const r of (refs.data as any[]) || []) {
          const u = r.url as string | null;
          if (!u) continue;
          if (r.tipo && r.tipo !== "imagem" && !isImageUrl(u)) continue;
          if (!r.tipo && !isImageUrl(u)) continue;
          merged.push({
            id: `ref-${r.id}`,
            url: u,
            title: r.titulo || u.split("/").pop() || "Referência",
            thumb: r.thumbnail_url || u,
            created_at: r.created_at,
          });
        }
        for (const m of (lib.data as any[]) || []) {
          const u = m.file_url as string | null;
          if (!u) continue;
          const t = (m.file_type as string) || "";
          if (!t.startsWith("image/") && !isImageUrl(u)) continue;
          merged.push({
            id: `lib-${m.id}`,
            url: u,
            title: m.title || u.split("/").pop() || "Mídia",
            thumb: m.thumbnail_url || u,
            created_at: m.created_at,
          });
        }
        merged.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setItems(merged);

        const s: SiteItem[] = ((sitesRes.data as any[]) || []).map(x => ({
          id: x.id,
          url: x.url,
          title: x.titulo || x.url,
          thumb: x.thumbnail_url,
          tipo: x.tipo || "outro",
          created_at: x.created_at,
        }));
        setSites(s);

        setLimit(PAGE);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const filteredImages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.title.toLowerCase().includes(q));
  }, [items, query]);

  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(i =>
      i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q)
    );
  }, [sites, query]);

  const visibleImages = filteredImages.slice(0, limit);
  const visibleSites = filteredSites.slice(0, limit);

  const togglePick = (key: string, sel: PickerSelection) => {
    setPicked(prev => {
      const n = new Map(prev);
      n.has(key) ? n.delete(key) : n.set(key, sel);
      return n;
    });
  };

  const handlePickImage = (item: RefItem) => {
    const sel: PickerSelection = { url: item.url, title: item.title, kind: "image", thumbnail: item.thumb };
    if (multi) { togglePick(item.id, sel); return; }
    onSelect(sel);
    onClose();
  };

  const handlePickSite = (item: SiteItem) => {
    const sel: PickerSelection = { url: item.url, title: item.title, kind: "site", thumbnail: item.thumb, siteId: item.id };
    if (multi) { togglePick(item.id, sel); return; }
    onSelect(sel);
    onClose();
  };

  const confirmMulti = () => {
    onConfirm?.(Array.from(picked.values()));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl bg-[#0a0608] border-pink-500/30">
        <DialogHeader>
          <DialogTitle className="text-pink-200 flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> Biblioteca
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setTab("image"); setLimit(PAGE); }}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium border transition",
              tab === "image"
                ? "bg-pink-600/30 border-pink-500/60 text-pink-100"
                : "bg-secondary/40 border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <ImageIcon className="h-3.5 w-3.5 inline mr-1.5" />
            Imagens ({items.length})
          </button>
          <button
            onClick={() => { setTab("site"); setLimit(PAGE); }}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium border transition",
              tab === "site"
                ? "bg-pink-600/30 border-pink-500/60 text-pink-100"
                : "bg-secondary/40 border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Globe className="h-3.5 w-3.5 inline mr-1.5" />
            Sites ({sites.length})
          </button>
        </div>

        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "image" ? "Buscar imagem..." : "Buscar site (título ou URL)..."}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="min-h-[300px] max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
            </div>
          ) : tab === "image" ? (
            visibleImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground text-sm gap-2">
                <ImageIcon className="h-8 w-8 opacity-40" />
                Nenhuma imagem encontrada.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {visibleImages.map(item => {
                    const on = picked.has(item.id);
                    return (
                    <button
                      key={item.id}
                      onClick={() => handlePickImage(item)}
                      className={cn(
                        "group relative aspect-square rounded-md overflow-hidden border bg-background/40 transition",
                        on ? "border-pink-500 ring-2 ring-pink-500/50" : "border-border/60 hover:border-pink-500/60 hover:ring-2 hover:ring-pink-500/30"
                      )}
                      title={item.title}
                    >
                      <img
                        src={item.thumb || item.url}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      {multi && on && (
                        <div className="absolute top-1 right-1 bg-pink-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">✓</div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
                        <p className="text-[10px] text-white truncate">{item.title}</p>
                      </div>
                    </button>
                  );})}
                </div>
                {filteredImages.length > limit && (
                  <button
                    onClick={() => setLimit(l => l + PAGE)}
                    className="mt-3 w-full py-2 text-xs text-pink-200 hover:text-pink-100 border border-pink-500/30 rounded-md hover:bg-pink-500/10"
                  >
                    Carregar mais ({filteredImages.length - limit} restantes)
                  </button>
                )}
              </>
            )
          ) : (
            visibleSites.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground text-sm gap-2">
                <Globe className="h-8 w-8 opacity-40" />
                Nenhum site na biblioteca. Cadastre em /sites.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {visibleSites.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handlePickSite(item)}
                      className={cn(
                        "group relative rounded-md overflow-hidden border border-border/60 bg-background/40 text-left",
                        "hover:border-pink-500/60 hover:ring-2 hover:ring-pink-500/30 transition"
                      )}
                      title={item.title}
                    >
                      <div className="aspect-video bg-secondary/30">
                        {item.thumb ? (
                          <img src={item.thumb} alt={item.title} loading="lazy" className="w-full h-full object-cover object-top" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Globe className="h-8 w-8 opacity-40" />
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px] py-0 h-4">{TIPO_LABEL[item.tipo] || item.tipo}</Badge>
                          <p className="text-[11px] font-medium truncate flex-1">{item.title}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{item.url.replace(/^https?:\/\//, "")}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {filteredSites.length > limit && (
                  <button
                    onClick={() => setLimit(l => l + PAGE)}
                    className="mt-3 w-full py-2 text-xs text-pink-200 hover:text-pink-100 border border-pink-500/30 rounded-md hover:bg-pink-500/10"
                  >
                    Carregar mais ({filteredSites.length - limit} restantes)
                  </button>
                )}
              </>
            )
          )}
        </div>
        {multi && (
          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            <span className="text-xs text-muted-foreground">{picked.size} selecionado{picked.size === 1 ? "" : "s"}</span>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border/60 hover:bg-secondary/60">Cancelar</button>
              <button onClick={confirmMulti} disabled={picked.size === 0} className="px-3 py-1.5 text-xs rounded-md bg-pink-600 hover:bg-pink-500 text-white disabled:opacity-40">
                Adicionar ({picked.size})
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
