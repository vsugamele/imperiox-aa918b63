import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, ChevronLeft, ChevronRight, X, Unlink, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface Item { id: string; url: string; thumb_url: string | null; titulo: string | null; }

interface Props {
  open: boolean;
  onClose: () => void;
  folderId: string;
  folderTitle?: string;
  onUnlink?: () => void;
}

export function FolderLightbox({ open, onClose, folderId, folderTitle, onUnlink }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!open || !folderId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("imphq_ref_folder_items" as any)
        .select("id, url, thumb_url, titulo")
        .eq("folder_id", folderId)
        .order("ordem", { ascending: true });
      setItems(((data as any[]) || []) as Item[]);
      setIdx(0);
      setLoading(false);
    })();
  }, [open, folderId]);

  const cur = items[idx];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl bg-[#0a0608] border-pink-500/30 p-0 gap-0">
        <div className="flex items-center justify-between p-3 border-b border-border/40">
          <div className="flex items-center gap-2 text-pink-200">
            <FolderOpen className="h-4 w-4" />
            <span className="text-sm font-medium">{folderTitle || "Pasta"}</span>
            <span className="text-[11px] text-muted-foreground">· {items.length} {items.length === 1 ? "item" : "itens"}</span>
          </div>
          <div className="flex items-center gap-2">
            {onUnlink && (
              <button onClick={onUnlink} className="text-[11px] px-2 py-1 rounded border border-border/60 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-1">
                <Unlink className="h-3 w-3" /> Desvincular
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-secondary/60 rounded"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="relative bg-black/60 min-h-[60vh] flex items-center justify-center">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : cur ? (
            <>
              <img src={cur.url} alt={cur.titulo || ""} className="max-h-[70vh] max-w-full object-contain" />
              {items.length > 1 && (
                <>
                  <button
                    onClick={() => setIdx(i => (i - 1 + items.length) % items.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 hover:bg-pink-600 flex items-center justify-center"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setIdx(i => (i + 1) % items.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 hover:bg-pink-600 flex items-center justify-center"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Pasta vazia. Adicione imagens na Biblioteca → aba Pastas.</p>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex gap-1.5 p-2 overflow-x-auto border-t border-border/40">
            {items.map((it, i) => (
              <button
                key={it.id}
                onClick={() => setIdx(i)}
                className={cn(
                  "shrink-0 h-14 w-14 rounded overflow-hidden border-2 transition",
                  i === idx ? "border-pink-500" : "border-transparent hover:border-pink-500/40"
                )}
              >
                <img src={it.thumb_url || it.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
