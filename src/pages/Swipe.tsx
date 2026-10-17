import type { Tables } from "@/integrations/supabase/types";
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, FlaskConical, Wand2, ShieldCheck, Layers, Zap, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SwipeImportDialog } from "@/components/swipe/SwipeImportDialog";
import { SwipeDetail } from "@/components/swipe/SwipeDetail";
import { SwipeMotorDialog } from "@/components/swipe/SwipeMotorDialog";
import { SwipeIndexSidebar } from "@/components/swipe/SwipeIndexSidebar";
import { SwipeRoteiroCard } from "@/components/swipe/SwipeRoteiroCard";
import { dissecarSwipeDerick } from "@/lib/derick-engines";

function getLabel(s: Pick<Tables<"imphq_swipes">,"title">, idx: number): string {
  const m = String(s.title || "").match(/ROTEIRO\s+([A-Z0-9]+)/i);
  if (m) return m[1].toUpperCase();
  if (idx < 26) return String.fromCharCode(65 + idx);
  return String(idx + 1);
}

export default function Swipe() {
  const navigate = useNavigate();
  const [swipes, setSwipes] = useState<Tables<"imphq_swipes">[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [vslOnly, setVslOnly] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [selected, setSelected] = useState<(Partial<Tables<"imphq_swipes">> & { __new?: boolean }) | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [motorOpen, setMotorOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dissectedSwipeId, setDissectedSwipeId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const patchSwipe = (id: string, patch: Partial<Tables<"imphq_swipes">>) =>
    setSwipes((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const [vaultSyncing, setVaultSyncing] = useState(false);

  const handleVaultSyncBatch = async () => {
    setVaultSyncing(true);
    toast.info("Iniciando espelhamento de vídeos no Media Vault...");
    try {
      const { data, error } = await supabase.functions.invoke("media-vault", {
        body: { op: "sync_batch", limit: 5, target: "gdrive" },
      });
      if (error) throw error;
      const count = data?.processed_count || 0;
      if (count > 0) {
        toast.success(`${count} vídeos de swipes espelhados no Storage próprio!`);
        await fetchSwipes();
      } else {
        toast.info("Todos os vídeos inspecionados já estão no cofre!");
      }
    } catch (err) {
      toast.error(`Erro ao sincronizar cofre: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setVaultSyncing(false);
    }
  };



  const fetchSwipes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_swipes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setSwipes(data || []);
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
    if (favOnly) arr = arr.filter((s) => s.favorito);
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
  }, [swipes, activeChips, search, vslOnly, favOnly]);

  const toggleChip = (c: string) => {
    const ns = new Set(activeChips);
    if (ns.has(c)) { ns.delete(c); } else { ns.add(c); }
    setActiveChips(ns);
  };

  const toggleBulk = (id: string) => {
    const ns = new Set(bulkSelected);
    if (ns.has(id)) { ns.delete(id); } else { ns.add(id); }
    setBulkSelected(ns);
  };

  const deleteSwipe = async (id: string) => {
    if (!confirm("Apagar esta swipe?")) return;
    const { error } = await supabase.from("imphq_swipes").delete().eq("id", id);
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
            <Button
              variant="outline"
              size="sm"
              disabled={vaultSyncing}
              className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
              onClick={handleVaultSyncBatch}
              title="Espelhar vídeos e mídias no Storage próprio"
            >
              <ShieldCheck className={`h-4 w-4 mr-1 ${vaultSyncing ? "animate-spin" : ""}`} />
              {vaultSyncing ? "Espelhando..." : "Media Vault CDN"}
            </Button>
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
        <button
          onClick={() => setFavOnly((v) => !v)}
          className={cn(
            "text-[10px] uppercase tracking-[0.2em] font-semibold px-3 py-1.5 rounded-md border transition",
            favOnly
              ? "bg-[hsl(var(--gold))]/15 border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))]"
              : "bg-secondary/30 border-border/40 text-muted-foreground hover:text-foreground",
          )}
        >
          ⭐ Favoritos ({swipes.filter((s) => s.favorito).length})
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
              filtered.map((s, i) => {
                const isDissected = dissectedSwipeId === s.id;
                const dissecacao = isDissected
                  ? dissecarSwipeDerick(s.title || "Swipe", s.raw_text || "", s.mecanismo, s.nicho)
                  : null;
                return (
                  <div key={s.id} className="space-y-2">
                    <SwipeRoteiroCard
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
                      onChanged={(patch) => patchSwipe(s.id, patch)}
                    />

                    {/* Barra de Ação Rápida Derick.AI (Skills 03/04 + Invisible Structure + Lote 50/50) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-secondary/40 border border-amber-500/20">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                          ⚡ Derick.AI Skills 03/04 + Invisible Structure
                        </Badge>
                        <span>Extração determinística de Variáveis Fixas (100%), Controle (≥60%) e Esqueleto em 5 Blocos</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant={isDissected ? "default" : "outline"}
                          onClick={() => setDissectedSwipeId(isDissected ? null : s.id)}
                          className="h-7 text-[11px] gap-1 border-amber-500/40 text-amber-300 hover:bg-amber-500/15"
                        >
                          <Layers className="h-3 w-3" />
                          {isDissected ? "Ocultar Dissecação Derick" : "Dissecar (Variáveis 100% / 60% + Estrutura Invisível)"}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            const d = dissecarSwipeDerick(s.title || "Swipe", s.raw_text || "", s.mecanismo, s.nicho);
                            navigate("/copy-lab", {
                              state: {
                                initialIntent: "esteira_anuncios_derick_50_50",
                                projectId: s.project_id || undefined,
                                briefing: d.lote5050Briefing,
                              },
                            });
                          }}
                          className="h-7 text-[11px] gap-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                        >
                          <Zap className="h-3 w-3" /> Gerar Lote 50% Pago + 50% Orgânico
                        </Button>
                      </div>
                    </div>

                    {/* Painel Expandido da Dissecação Derick.AI */}
                    {isDissected && dissecacao && (
                      <Card className="p-4 bg-gradient-to-br from-amber-500/10 via-secondary/50 to-background border-amber-500/30 space-y-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                              FICHA TÉCNICA SKILL 03/04 + INVISIBLE STRUCTURE
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              Mediana: {dissecacao.medicaoEscrita.mediana_palavras}w · Micro: {dissecacao.medicaoEscrita.pct_micro}% · Linhas: {dissecacao.medicaoEscrita.linhas}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[11px]"
                              onClick={() => {
                                navigator.clipboard.writeText(dissecacao.lote5050Briefing);
                                toast.success("Briefing 50/50 copiado!");
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" /> Copiar Briefing 50/50
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => setDissectedSwipeId(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-background/70 border border-border/70 space-y-1.5 text-xs">
                            <p className="font-bold text-amber-300 uppercase text-[10px] tracking-wider">
                              🔒 Variáveis Fixas (100% Obrigatórias no Nicho)
                            </p>
                            <p><strong>Promessa:</strong> {dissecacao.variaveisFixas100.promessaCentral}</p>
                            <p><strong>Portador da Dor:</strong> {dissecacao.variaveisFixas100.portadorDaDor}</p>
                            <p><strong>Inimigo/Crença:</strong> {dissecacao.variaveisFixas100.inimigoOuCrencaQuebrada}</p>
                            <p><strong>Ponte Lei 54:</strong> {dissecacao.variaveisFixas100.ponteParaOferta}</p>
                          </div>

                          <div className="p-3 rounded-lg bg-background/70 border border-border/70 space-y-1.5 text-xs">
                            <p className="font-bold text-cyan-300 uppercase text-[10px] tracking-wider">
                              🎛️ Variáveis de Controle (≥60%) + Variável Orgânica (50/50)
                            </p>
                            <p><strong>Porta de Entrada:</strong> {dissecacao.variaveisControle60.portaDeEntrada}</p>
                            <p><strong>Consciência:</strong> {dissecacao.variaveisControle60.nivelConsciencia}</p>
                            <p><strong>Mecanismo Nomeado:</strong> {dissecacao.variaveisControle60.mecanismoNomeado}</p>
                            <p className="text-emerald-300">
                              <strong>🌱 Variável Orgânica p/ Teste 50/50:</strong> {dissecacao.variavelOrganica}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="font-bold text-foreground uppercase text-[10px] tracking-wider">
                            🧬 Estrutura Invisível em 5 Blocos (`invisible-structure`)
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                            {dissecacao.estruturaInvisivel5Blocos.map((b, idx) => (
                              <div key={idx} className="p-2.5 rounded bg-background/80 border border-border/60 space-y-1">
                                <p className="text-[10px] font-bold text-amber-300">{b.bloco}</p>
                                <p className="text-[10px] text-muted-foreground">{b.funcaoPsicologica}</p>
                                <p className="text-[11px] text-foreground italic line-clamp-3">"{b.trechoExtraido}"</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
                );
              })
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
