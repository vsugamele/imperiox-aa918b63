import { useEffect, useMemo, useState } from "react";
import { Sparkles, Copy, Star, StarOff, Filter, Loader2, Wand2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HOOKS_LIBRARY, type HookTemplate } from "@/data/hooks/library";
import { useProjectList } from "@/hooks/useProjectList";

const OBJETIVOS = ["Parar o scroll", "Gerar clique", "Aquecer o lead", "Fechar a venda"] as const;

const FAV_KEY = "hooklabs_favs_v1";
const loadFavs = (): number[] => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; }
};

const objetivoColor: Record<string, string> = {
  "Parar o scroll": "bg-red-500/15 text-red-400 border-red-500/30",
  "Gerar clique": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Aquecer o lead": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Fechar a venda": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

export default function HookLabs() {
  const [favs, setFavs] = useState<number[]>(loadFavs);
  const [objetivo, setObjetivo] = useState<string>("__all__");
  const [gatilho, setGatilho] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [projectId, setProjectId] = useState<string>("__none__");
  const [selected, setSelected] = useState<HookTemplate | null>(null);
  const [gerando, setGerando] = useState(false);
  const [variacoes, setVariacoes] = useState<string[]>([]);
  const [novoOpen, setNovoOpen] = useState(false);
  const [novosHooks, setNovosHooks] = useState<Array<{ texto: string; motivo: string }>>([]);
  const { data: projects = [] } = useProjectList();

  const gatilhos = useMemo(() => {
    const s = new Set<string>();
    HOOKS_LIBRARY.forEach(h => s.add(h.gatilho));
    return Array.from(s).sort();
  }, []);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return HOOKS_LIBRARY.filter(h => {
      if (objetivo !== "__all__" && h.objetivo !== objetivo) return false;
      if (gatilho && h.gatilho !== gatilho) return false;
      if (onlyFavs && !favs.includes(h.n)) return false;
      if (q && !h.texto.toLowerCase().includes(q) && !h.gatilho.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [objetivo, gatilho, busca, onlyFavs, favs]);

  const toggleFav = (n: number) => {
    const next = favs.includes(n) ? favs.filter(x => x !== n) : [...favs, n];
    setFavs(next);
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Copiado");
  };

  const preencher = async (h: HookTemplate) => {
    setSelected(h);
    setVariacoes([]);
    if (projectId === "__none__") {
      toast.error("Selecione um projeto pra preencher com IA");
      return;
    }
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("hook-generator", {
        body: { mode: "fill", project_id: projectId, template: h.texto, objetivo: h.objetivo, gatilho: h.gatilho },
      });
      if (error) throw error;
      setVariacoes(data?.variacoes || []);
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setGerando(false);
    }
  };

  const gerarNovos = async () => {
    if (projectId === "__none__") { toast.error("Selecione um projeto"); return; }
    setNovoOpen(true);
    setNovosHooks([]);
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("hook-generator", {
        body: {
          mode: "generate",
          project_id: projectId,
          objetivo: objetivo === "__all__" ? "Parar o scroll" : objetivo,
          gatilho: gatilho || "Curiosidade",
          quantidade: 10,
        },
      });
      if (error) throw error;
      setNovosHooks(data?.hooks || []);
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-4xl text-foreground flex items-center gap-3">
            <Sparkles className="h-9 w-9 text-primary" /> Hook Labs
          </h1>
          <p className="text-muted-foreground mt-1 leading-7">
            400 hooks de resposta direta + gerador com IA usando o avatar do seu projeto.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Projeto (p/ IA)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem projeto</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={gerarNovos} className="bg-primary text-primary-foreground">
            <Wand2 className="h-4 w-4 mr-2" /> Gerar novos
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-secondary/40 border-border">
        <div className="flex gap-2 flex-wrap items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={objetivo} onValueChange={setObjetivo}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os objetivos</SelectItem>
              {OBJETIVOS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={gatilho || "__all__"} onValueChange={v => setGatilho(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Gatilho" /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="__all__">Todos os gatilhos</SelectItem>
              {gatilhos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." className="pl-8" />
          </div>
          <Button variant={onlyFavs ? "default" : "outline"} onClick={() => setOnlyFavs(!onlyFavs)} size="sm">
            <Star className="h-4 w-4 mr-1" /> Favoritos ({favs.length})
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} / {HOOKS_LIBRARY.length}</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(h => {
          const isFav = favs.includes(h.n);
          return (
            <Card key={h.n} className="p-4 bg-secondary/40 border-border hover:border-primary/40 transition-colors flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">#{String(h.n).padStart(3, "0")}</span>
                <Badge variant="outline" className={`text-[10px] ${objetivoColor[h.objetivo] || ""}`}>{h.objetivo}</Badge>
              </div>
              <p className="text-sm text-foreground leading-6 flex-1">{h.texto}</p>
              <p className="text-[10px] text-primary/80 uppercase tracking-wide">{h.gatilho}</p>
              <div className="flex gap-1 pt-1 border-t border-border/60">
                <Button size="sm" variant="ghost" onClick={() => copy(h.texto)} className="h-7 text-[11px]">
                  <Copy className="h-3 w-3 mr-1" /> Copiar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => preencher(h)} className="h-7 text-[11px]">
                  <Wand2 className="h-3 w-3 mr-1" /> Preencher IA
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleFav(h.n)} className="h-7 text-[11px] ml-auto">
                  {isFav ? <Star className="h-3 w-3 fill-primary text-primary" /> : <StarOff className="h-3 w-3" />}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Dialog Preencher */}
      <Dialog open={!!selected} onOpenChange={o => { if (!o) { setSelected(null); setVariacoes([]); } }}>
        <DialogContent className="bg-secondary/95 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Preencher com IA · #{selected?.n}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-3 leading-6">
              {selected?.texto}
            </p>
            {gerando && <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>}
            {variacoes.map((v, i) => (
              <div key={i} className="p-3 bg-background/60 rounded border border-border flex items-start gap-2">
                <p className="text-sm text-foreground leading-6 flex-1">{v}</p>
                <Button size="sm" variant="ghost" onClick={() => copy(v)}><Copy className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Novos */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="bg-secondary/95 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Hooks originais para seu projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {gerando && <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>}
            {novosHooks.map((h, i) => (
              <div key={i} className="p-3 bg-background/60 rounded border border-border">
                <div className="flex items-start gap-2">
                  <p className="text-sm text-foreground leading-6 flex-1">{h.texto}</p>
                  <Button size="sm" variant="ghost" onClick={() => copy(h.texto)}><Copy className="h-3 w-3" /></Button>
                </div>
                <p className="text-[10px] text-primary/70 uppercase mt-1">{h.motivo}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
