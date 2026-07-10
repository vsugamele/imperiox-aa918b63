import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RefItem {
  id: string;
  url: string;
  title: string;
  thumb: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, title: string) => void;
}

const PAGE = 60;

const isImageUrl = (u?: string | null) =>
  !!u && /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(u);

export function ReferenciasPicker({ open, onClose, onSelect }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RefItem[]>([]);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const [refs, lib] = await Promise.all([
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
        setLimit(PAGE);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.title.toLowerCase().includes(q));
  }, [items, query]);

  const visible = filtered.slice(0, limit);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl bg-[#0a0608] border-pink-500/30">
        <DialogHeader>
          <DialogTitle className="text-pink-200 flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> Escolher da biblioteca de Referências
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título..."
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="min-h-[300px] max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground text-sm gap-2">
              <ImageIcon className="h-8 w-8 opacity-40" />
              Nenhuma referência de imagem encontrada.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {visible.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { onSelect(item.url, item.title); onClose(); }}
                    className={cn(
                      "group relative aspect-square rounded-md overflow-hidden border border-border/60 bg-background/40",
                      "hover:border-pink-500/60 hover:ring-2 hover:ring-pink-500/30 transition"
                    )}
                    title={item.title}
                  >
                    <img
                      src={item.thumb || item.url}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
                      <p className="text-[10px] text-white truncate">{item.title}</p>
                    </div>
                  </button>
                ))}
              </div>
              {filtered.length > limit && (
                <button
                  onClick={() => setLimit(l => l + PAGE)}
                  className="mt-3 w-full py-2 text-xs text-pink-200 hover:text-pink-100 border border-pink-500/30 rounded-md hover:bg-pink-500/10"
                >
                  Carregar mais ({filtered.length - limit} restantes)
                </button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
