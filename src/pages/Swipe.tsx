import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Sparkles, Search, Trash2, Star, FlaskConical, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { SwipeImportDialog } from "@/components/swipe/SwipeImportDialog";
import { SwipeDetail } from "@/components/swipe/SwipeDetail";
import { SwipeMotorDialog } from "@/components/swipe/SwipeMotorDialog";

export default function Swipe() {
  const [swipes, setSwipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterNicho, setFilterNicho] = useState<string>("");
  const [filterPlataforma, setFilterPlataforma] = useState<string>("");
  const [selected, setSelected] = useState<any | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [motorOpen, setMotorOpen] = useState(false);

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

  const nichos = useMemo(() => Array.from(new Set(swipes.map((s) => s.nicho).filter(Boolean))), [swipes]);
  const plataformas = useMemo(() => Array.from(new Set(swipes.map((s) => s.plataforma).filter(Boolean))), [swipes]);

  const filtered = useMemo(() => {
    return swipes.filter((s) => {
      if (filterNicho && s.nicho !== filterNicho) return false;
      if (filterPlataforma && s.plataforma !== filterPlataforma) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${s.title} ${s.criador} ${s.mecanismo} ${(s.tags || []).join(" ")} ${JSON.stringify(s.blocks || {})}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [swipes, search, filterNicho, filterPlataforma]);

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
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">📚 Swipe File</h1>
          <p className="text-sm text-muted-foreground mt-1">
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
            onClick={() => {
              setSelected({ __new: true, title: "Nova copy", blocks: {}, tags: [], gatilhos: [] });
            }}
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

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar título, criador, mecanismo, tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-secondary"
          />
        </div>
        <select
          value={filterNicho}
          onChange={(e) => setFilterNicho(e.target.value)}
          className="bg-secondary border border-border rounded-md text-sm px-2 py-1.5"
        >
          <option value="">Todos os nichos</option>
          {nichos.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select
          value={filterPlataforma}
          onChange={(e) => setFilterPlataforma(e.target.value)}
          className="bg-secondary border border-border rounded-md text-sm px-2 py-1.5"
        >
          <option value="">Todas plataformas</option>
          {plataformas.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {swipes.length}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((s) => (
            <Card
              key={s.id}
              className={`p-3 bg-secondary/40 border-border cursor-pointer hover:border-primary/40 transition-colors ${
                bulkSelected.has(s.id) ? "border-primary ring-1 ring-primary/40" : ""
              }`}
              onClick={() => setSelected(s)}
            >
              <div className="flex items-start gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={bulkSelected.has(s.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleBulk(s.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium leading-snug line-clamp-2">{s.title}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {s.criador && <span>{s.criador} · </span>}
                    {s.plataforma || "—"} · {s.formato || "—"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0 text-destructive/70"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSwipe(s.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {s.blocks?.gancho && (
                <p className="text-xs text-foreground/80 line-clamp-3 italic leading-snug">
                  "{s.blocks.gancho}"
                </p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {s.mecanismo && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                    {s.mecanismo}
                  </Badge>
                )}
                {s.nicho && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    {s.nicho}
                  </Badge>
                )}
                {(s.tags || []).slice(0, 3).map((t: string) => (
                  <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0">
                    {t}
                  </Badge>
                ))}
                {s.reverse_engineering && Object.keys(s.reverse_engineering).length > 0 && (
                  <Badge className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary border-primary/40">
                    🔬 RE
                  </Badge>
                )}
              </div>
            </Card>
          ))}
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
