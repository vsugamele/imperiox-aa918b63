import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { ImageLightbox } from "@/components/shared/ImageLightbox";
import type { FlowBlueprint } from "@/lib/typebot-parser";

interface Props {
  open: boolean;
  onClose: () => void;
  blueprintId: string;
  blueprint: FlowBlueprint | null;
}

interface Row {
  id: string;
  block_id: string | null;
  prompt: string | null;
  url: string | null;
  status: string;
  created_at: string;
  node_label?: string;
}

const STATUS_COLOR: Record<string, string> = {
  done: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  processing: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  queued: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  failed: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};

export function GeneratedImagesPanel({ open, onClose, blueprintId, blueprint }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);

  const nodeLabelByBlock = new Map<string, string>();
  blueprint?.nodes.forEach(n => n.blocks.forEach(b => nodeLabelByBlock.set(b.id, n.title)));

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from("imphq_flow_image_jobs")
        .select("id, block_id, prompt, url, status, created_at")
        .eq("blueprint_id", blueprintId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active) return;
      setRows((data || []).map(r => ({ ...r, node_label: nodeLabelByBlock.get(r.block_id || "") || "Nó desconhecido" })));
      setLoading(false);
    };
    load();
    const ch = supabase.channel(`flow-images-panel-${blueprintId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "imphq_flow_image_jobs", filter: `blueprint_id=eq.${blueprintId}` }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [open, blueprintId, blueprint]);

  const done = rows.filter(r => r.status === "done" && r.url);
  const pending = rows.filter(r => r.status !== "done");

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="bg-[#0a0608] border-border/60 w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-pink-200 flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Imagens geradas
              <Badge variant="outline" className="text-[10px]">{done.length}</Badge>
            </SheetTitle>
          </SheetHeader>

          {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…</div>}

          {!loading && rows.length === 0 && (
            <div className="mt-6 rounded-md border border-dashed border-border/60 p-6 text-center">
              <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma imagem gerada ainda.<br />Ao criar blocos de imagem, elas aparecem aqui.</p>
            </div>
          )}

          {pending.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Em andamento</p>
              {pending.map(r => (
                <div key={r.id} className="rounded-md border border-border/40 bg-secondary/40 p-2 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{r.node_label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.prompt || "—"}</p>
                  </div>
                  <Badge className={`text-[9px] ${STATUS_COLOR[r.status] || "bg-secondary"}`}>{r.status}</Badge>
                </div>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Prontas</p>
              <div className="grid grid-cols-2 gap-2">
                {done.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="group text-left rounded-md overflow-hidden border border-border/40 hover:border-pink-500/60 bg-secondary/30"
                  >
                    <img src={r.url!} alt={r.node_label} className="w-full h-32 object-cover group-hover:opacity-90" loading="lazy" />
                    <div className="p-2">
                      <p className="text-[11px] font-medium truncate">{r.node_label}</p>
                      <p className="text-[9px] text-muted-foreground line-clamp-2 leading-4">{r.prompt || "—"}</p>
                      <p className="text-[9px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {selected?.url && (
        <ImageLightbox
          open={!!selected}
          onClose={() => setSelected(null)}
          url={selected.url}
          prompt={selected.prompt || undefined}
          label={selected.node_label}
          createdAt={selected.created_at}
        />
      )}
    </>
  );
}
