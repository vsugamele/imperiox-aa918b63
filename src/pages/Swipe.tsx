import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Upload, FlaskConical, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SwipeImportDialog } from "@/components/swipe/SwipeImportDialog";
import { SwipeDetail } from "@/components/swipe/SwipeDetail";
import { SwipeMotorDialog } from "@/components/swipe/SwipeMotorDialog";
import { SwipeIndexSidebar } from "@/components/swipe/SwipeIndexSidebar";
import { SwipeRoteiroCard } from "@/components/swipe/SwipeRoteiroCard";

function getLabel(s: any, idx: number): string {
  const m = String(s.title || "").match(/ROTEIRO\s+([A-Z0-9]+)/i);
  if (m) return m[1].toUpperCase();
  if (idx < 26) return String.fromCharCode(65 + idx);
  return String(idx + 1);
}

export default function Swipe() {
  const [swipes, setSwipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [vslOnly, setVslOnly] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [motorOpen, setMotorOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const patchSwipe = (id: string, patch: any) =>
    setSwipes((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));



  const fetchSwipes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_swipes" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setSwipes((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSwipes();
  }, []);

  // Chips derivados de mecanismo + tags
  const chips = useMemo(() => {
    const set = new Set<string>();
    swipes.forEach((s) => {
      if (s.mecanismo) set.add(s.mecanismo);
      (s.tags || []).forEach((t: string) => set.add(t));
      if (s.nicho) set.add(s.nicho);
    });
    return Array.from(set).slice(0, 16);
  }, [swipes]);

  const filtered = useMemo(() => {
    let arr = swipes;
    if (vslOnly) arr = arr.filter((s) => s.formato === "vsl");
    if (search.trim()) {
      const k = search.toLowerCase();
      arr = arr.filter((s) =>
        `${s.title || ""} ${s.raw_text || ""} ${s.criador || ""} ${(s.tags || []).join(" ")}`.toLowerCase().includes(k),
      );
    }
    if (activeChips.size > 0) {
      arr = arr.filter((s) => {
        const hay = new Set<string>();
        if (s.mecanismo) hay.add(s.mecanismo);
        if (s.nicho) hay.add(s.nicho);
        (s.tags || []).forEach((t: string) => hay.add(t));
        for (const c of activeChips) if (hay.has(c)) return true;
        return false;
      });
    }
    return arr;
  }, [swipes, activeChips, search, vslOnly]);

  const toggleChip = (c: string) => {
    const ns = new Set(activeChips);
    ns.has(c) ? ns.delete(c) : ns.add(c);
    setActiveChips(ns);
  };

  const toggleBulk = (id: string) => {
    const ns = new Set(bulkSelected);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setBulkSelected(ns);
  };

  const deleteSwipe = async (id: string) => {
    if (!confirm("Apagar esta swipe?")) return;
    const { error } = await supabase.from("imphq_swipes" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Apagada");
    setSwipes(swipes.filter((s) => s.id !== id));
  };

  // Scroll-spy + clique na sidebar
  useEffect(() => {
    if (!filtered.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.id.replace("swipe-", "");
          setActiveId(id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    cardRefs.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [filtered]);

  const scrollTo = (id: string) => {
    const el = cardRefs.current.get(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* HEADER EDITORIAL */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[hsl(var(--gold))]/85">
            · Biblioteca · Swipe File
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-[hsl(var(--gold))]/40 via-[hsl(var(--gold))]/15 to-transparent" />
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display italic text-3xl text-foreground leading-none">
              Swipe <span className="text-[hsl(var(--gold))]">File</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5 italic">
              Biblioteca de copys campeãs · engenharia reversa · motor de geração
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected({ __new: true, title: "Nova copy", blocks: {}, tags: [], gatilhos: [] })}
            >
              <Plus className="h-4 w-4 mr-1" /> Novo manual
            </Button>
            <Button
              size="sm"
              onClick={() => setMotorOpen(true)}
              disabled={bulkSelected.size === 0}
              className="gap-1"
            >
              <Wand2 className="h-4 w-4" /> Motor ({bulkSelected.size})
            </Button>
          </div>
        </div>
      </div>

      {/* CHIPS */}
      {/* BUSCA + FILTRO VSL */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar título, criador, transcrição, tag..."
          className="flex-1 min-w-[220px] h-9 px-3 text-xs rounded-md bg-secondary/30 border border-border/40 focus:border-[hsl(var(--gold))]/50 outline-none"
        />
        <button
          onClick={() => setVslOnly((v) => !v)}
          className={cn(
            "text-[10px] uppercase tracking-[0.2em] font-semibold px-3 py-1.5 rounded-md border transition",
            vslOnly
              ? "bg-amber-500/15 border-amber-500/50 text-amber-400"
              : "bg-secondary/30 border-border/40 text-muted-foreground hover:text-foreground",
          )}
        >
          🎬 Só VSL ({swipes.filter((s) => s.formato === "vsl").length})
        </button>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            onClick={() => setActiveChips(new Set())}
            className={cn(
              "text-[10px] uppercase tracking-[0.2em] font-semibold px-3 py-1 rounded-full border transition",
              activeChips.size === 0
                ? "bg-[hsl(var(--gold))]/15 border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))]"
                : "bg-secondary/30 border-border/40 text-muted-foreground hover:text-foreground",
            )}
          >
            Todos ({swipes.length})
          </button>
          {chips.map((c) => {
            const on = activeChips.has(c);
            return (
              <button
                key={c}
                onClick={() => toggleChip(c)}
                className={cn(
                  "text-[10px] uppercase tracking-[0.2em] font-semibold px-3 py-1 rounded-full border transition",
                  on
                    ? "bg-[hsl(var(--gold))]/15 border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))]"
                    : "bg-secondary/30 border-border/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            );
          })}
          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
            {filtered.length} de {swipes.length}
          </span>
        </div>
      )}

      {/* LAYOUT 2-COL */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : swipes.length === 0 ? (
        <Card className="p-12 text-center bg-secondary/30 border-dashed">
          <FlaskConical className="h-10 w-10 mx-auto text-primary/60 mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            Sua biblioteca está vazia. Importe um JSON ou cole uma copy crua para começar.
          </p>
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Importar primeira copy
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-3">
            <SwipeIndexSidebar items={filtered} activeId={activeId} onSelect={scrollTo} />
          </div>
          <div className="lg:col-span-9 space-y-4">
            {filtered.length === 0 ? (
              <Card className="p-8 text-center bg-secondary/20 border-dashed border-border/40">
                <p className="text-sm text-muted-foreground italic">Nenhum roteiro com esses filtros.</p>
              </Card>
            ) : (
              filtered.map((s, i) => (
                <SwipeRoteiroCard
                  key={s.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(s.id, el);
                    else cardRefs.current.delete(s.id);
                  }}
                  swipe={s}
                  label={getLabel(s, i)}
                  selected={bulkSelected.has(s.id)}
                  onToggleSelect={() => toggleBulk(s.id)}
                  onEdit={() => setSelected(s)}
                  onDelete={() => deleteSwipe(s.id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      <SwipeImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => fetchSwipes()}
      />
      <SwipeMotorDialog
        open={motorOpen}
        onOpenChange={setMotorOpen}
        swipeIds={Array.from(bulkSelected)}
        onDone={() => {
          setBulkSelected(new Set());
          fetchSwipes();
        }}
      />
      {selected && (
        <SwipeDetail
          swipe={selected}
          onClose={() => setSelected(null)}
          onSaved={() => fetchSwipes()}
        />
      )}
    </div>
  );
}
