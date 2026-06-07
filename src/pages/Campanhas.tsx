import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Plus, Target, Trash2, Pencil } from "lucide-react";
import { TagAutocomplete } from "@/components/projeto/TagAutocomplete";
import { GuideDrawer } from "@/components/assistente/GuideDrawer";

const Lancamentos = lazy(() => import("./Lancamentos"));
const ABTests = lazy(() => import("./ABTests"));

const SubLoader = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

interface Campaign {
  id: string;
  nome: string;
  project_id: string | null;
  produto: string | null;
  funil: string | null;
  form_type_default: string | null;
  status: string;
  data: any;
  created_at: string;
}

const FUNIS = [
  { v: "aquisicao", label: "Aquisição" },
  { v: "conversao", label: "Conversão" },
  { v: "maximizacao", label: "Maximização" },
  { v: "retencao", label: "Retenção" },
];
const STATUS_COLORS: Record<string, string> = {
  ativa: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pausada: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  rascunho: "bg-muted text-muted-foreground",
  arquivada: "bg-secondary text-muted-foreground",
};

export default function Campanhas() {
  const [params, setParams] = useSearchParams();
  const activeTab = (params.get("tab") || "campanhas") as "campanhas" | "lancamentos" | "ab-tests";

  const handleTabChange = (val: string) => {
    setParams({ tab: val }, { replace: true });
  };

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; nome: string }>>([]);
  const [sequences, setSequences] = useState<Array<{ id: string; nome: string; project_id: string | null }>>([]);
  const [produtoOptions, setProdutoOptions] = useState<string[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<string, { d7: number; d30: number; total: number }>>({});
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [search, setSearch] = useState("");

  const [edit, setEdit] = useState<Partial<Campaign> | null>(null);

  const load = async () => {
    const [{ data: cps }, { data: prjs }, { data: seqs }, { data: vendas }] = await Promise.all([
      supabase.from("imphq_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_projects").select("id,name").order("name"),
      supabase.from("imphq_nurture_sequences").select("id,nome,project_id").order("created_at", { ascending: false }),
      supabase.from("imphq_vendas").select("produto_nome").not("produto_nome", "is", null).limit(2000),
    ] as PromiseLike<any>[]);
    setCampaigns((cps || []) as any);
    setProjects(((prjs || []) as any[]).map((p: any) => ({ id: p.id, nome: p.name })));
    setProdutoOptions(Array.from(new Set((vendas || []).map((v: any) => v.produto_nome).filter(Boolean))).sort() as string[]);
    setSequences((seqs || []) as any);

    // Aggregate leads per campaign_id via leads.data.campaign_id
    const ids = (cps || []).map((c: any) => c.id);
    if (ids.length) {
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: leads } = await supabase
        .from("imphq_leads")
        .select("id,created_at,data")
        .gte("created_at", since30)
        .limit(5000);
      const counts: Record<string, { d7: number; d30: number; total: number }> = {};
      const now = Date.now();
      (leads || []).forEach((l: any) => {
        const cid = l.data?.campaign_id;
        if (!cid) return;
        const ageDays = (now - new Date(l.created_at).getTime()) / 86400000;
        counts[cid] = counts[cid] || { d7: 0, d30: 0, total: 0 };
        counts[cid].d30++;
        counts[cid].total++;
        if (ageDays <= 7) counts[cid].d7++;
      });
      setLeadCounts(counts);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => campaigns.filter(c => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterProject !== "all" && c.project_id !== filterProject) return false;
    if (search.trim() && !c.nome.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [campaigns, filterStatus, filterProject, search]);

  const projectName = (id: string | null) => projects.find(p => p.id === id)?.nome || "—";

  const saveEdit = async () => {
    if (!edit?.nome?.trim()) { toast.error("Nome obrigatório"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = {
      nome: edit.nome.trim(),
      project_id: edit.project_id || null,
      produto: edit.produto || null,
      funil: edit.funil || "aquisicao",
      form_type_default: edit.form_type_default || null,
      status: edit.status || "ativa",
      data: edit.data || {},
    };
    if (edit.id) {
      await supabase.from("imphq_campaigns").update(payload).eq("id", edit.id);
    } else {
      await supabase.from("imphq_campaigns").insert({ ...payload, user_id: user.id });
    }
    toast.success("Campanha salva");
    setEdit(null);
    load();
  };

  const removeCampaign = async (id: string) => {
    if (!confirm("Remover esta campanha?")) return;
    await supabase.from("imphq_campaigns").delete().eq("id", id);
    toast.success("Removida");
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="bg-secondary/60">
            <TabsTrigger value="campanhas">🎯 Campanhas</TabsTrigger>
            <TabsTrigger value="lancamentos">🚀 Lançamentos</TabsTrigger>
            <TabsTrigger value="ab-tests">🧪 Testes A/B</TabsTrigger>
          </TabsList>
          {activeTab === "campanhas" && (
            <div className="flex items-center gap-2">
              <GuideDrawer area="campanhas" projectId={filterProject !== "all" ? filterProject : undefined} />
              <Button onClick={() => setEdit({ status: "ativa", funil: "aquisicao" })}>
                <Plus className="h-4 w-4 mr-1" /> Nova campanha
              </Button>
            </div>
          )}
        </div>

        {/* ── Campanhas tab ───────────────────────────────────────────── */}
        <TabsContent value="campanhas" className="mt-4">
          <div className="space-y-6">
            <header>
              <h1 className="font-display text-3xl text-primary flex items-center gap-2">
                <Target className="h-7 w-7" /> Campanhas
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Veja leads, status e desempenho por campanha.</p>
            </header>

      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Buscar campanha..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs bg-secondary"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="ativa">Ativa</SelectItem>
            <SelectItem value="pausada">Pausada</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="arquivada">Arquivada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-52 bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="bg-secondary/40">
          <CardContent className="py-12 text-center text-muted-foreground leading-7">
            Nenhuma campanha ainda. Crie uma para agrupar formulários, leads e métricas.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => {
            const counts = leadCounts[c.id] || { d7: 0, d30: 0, total: 0 };
            return (
              <Card key={c.id} className="bg-secondary/40 border-border hover:border-primary/30 transition">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-display text-foreground line-clamp-2">{c.nome}</CardTitle>
                    <Badge variant="outline" className={STATUS_COLORS[c.status] || ""}>{c.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.project_id && <Badge variant="outline" className="text-[10px]">📁 {projectName(c.project_id)}</Badge>}
                    {c.produto && <Badge variant="outline" className="text-[10px]">📦 {c.produto}</Badge>}
                    {c.funil && <Badge variant="outline" className="text-[10px]">🎯 {FUNIS.find(f => f.v === c.funil)?.label || c.funil}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-background/50 rounded p-2">
                      <div className="text-lg font-bold text-primary">{counts.d7}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">7d</div>
                    </div>
                    <div className="bg-background/50 rounded p-2">
                      <div className="text-lg font-bold text-primary">{counts.d30}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">30d</div>
                    </div>
                    <div className="bg-background/50 rounded p-2">
                      <div className="text-lg font-bold text-primary">{counts.total}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">total</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => setEdit(c)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={() => removeCampaign(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

          </div>
        </TabsContent>

        {/* ── Lançamentos tab ─────────────────────────────────────────── */}
        <TabsContent value="lancamentos" className="mt-0">
          <Suspense fallback={<SubLoader />}>
            <Lancamentos />
          </Suspense>
        </TabsContent>

        {/* ── A/B Tests tab ────────────────────────────────────────────── */}
        <TabsContent value="ab-tests" className="mt-0">
          <Suspense fallback={<SubLoader />}>
            <ABTests />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Campaign edit dialog — shared across tabs */}
      <Dialog open={!!edit} onOpenChange={(o) => { if (!o) setEdit(null); }}>
        <DialogContent className="max-w-md bg-secondary/40">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar campanha" : "Nova campanha"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={edit?.nome || ""} onChange={e => setEdit({ ...edit!, nome: e.target.value })} className="bg-background" placeholder="Ex: Lançamento Cortes — Abril" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={edit?.status || "ativa"} onValueChange={v => setEdit({ ...edit!, status: v })}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="pausada">Pausada</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="arquivada">Arquivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Funil</Label>
                <Select value={edit?.funil || "aquisicao"} onValueChange={v => setEdit({ ...edit!, funil: v })}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FUNIS.map(f => <SelectItem key={f.v} value={f.v}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Projeto</Label>
              <Select value={edit?.project_id || "__none__"} onValueChange={v => setEdit({ ...edit!, project_id: v === "__none__" ? null : v })}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem projeto</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Produto (opcional)</Label>
              <Input
                value={edit?.produto || ""}
                onChange={e => setEdit({ ...edit!, produto: e.target.value })}
                className="bg-background"
                list="produto-options"
                placeholder="Digite ou selecione…"
              />
              <datalist id="produto-options">
                {produtoOptions.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <Label>Tags (segmentação)</Label>
              <TagAutocomplete
                tags={((edit?.data as any)?.tags || []) as string[]}
                onChange={(tags) => setEdit({ ...edit!, data: { ...(edit?.data || {}), tags } })}
                placeholder="Adicionar tag..."
              />
            </div>
            <div>
              <Label>Sequência de nutrição padrão (auto-enroll de novos leads)</Label>
              <Select
                value={(edit?.data as any)?.default_sequence_id || "__none__"}
                onValueChange={v => setEdit({ ...edit!, data: { ...(edit?.data || {}), default_sequence_id: v === "__none__" ? null : v } })}
              >
                <SelectTrigger className="bg-background"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {sequences
                    .filter(s => !edit?.project_id || !s.project_id || s.project_id === edit.project_id)
                    .map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">Leads capturados em forms desta campanha entram automaticamente nesta sequência.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
