import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, BookTemplate, Loader2, FolderOpen, Trash2, Sparkles } from "lucide-react";
import { AutopilotModal } from "@/components/projeto/AutopilotModal";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  boards_json: any[];
}

const DEFAULT_TEMPLATES: Omit<ProjectTemplate, "id">[] = [
  {
    name: "Canal Dark YT",
    description: "Estrutura completa para criação e gestão de canais dark no YouTube",
    icon: "🎬",
    category: "canal-dark",
    boards_json: [
      {
        board: "operacional",
        columns: [
          { title: "backlog", cards: ["Definir Nicho e Sub-nicho", "Pesquisar concorrentes no YT", "Criar identidade visual do canal", "Configurar conta Google e canal"] },
          { title: "fazendo", cards: [] },
          { title: "travado", cards: [] },
          { title: "revisão", cards: ["Criar arte do banner e logo"] },
          { title: "feito", cards: [] },
        ],
      },
      {
        board: "criativos",
        columns: [
          { title: "backlog", cards: ["Criar 10 roteiros iniciais", "Gravar/gerar narrações", "Montar vídeos no CapCut/Premiere", "Criar thumbnails padrão"] },
          { title: "fazendo", cards: [] },
          { title: "travado", cards: [] },
          { title: "revisão", cards: [] },
          { title: "feito", cards: [] },
        ],
      },
    ],
  },
  {
    name: "Infoproduto",
    description: "Lançamento de infoproduto do zero: pesquisa, criação, funil e vendas",
    icon: "🚀",
    category: "infoproduto",
    boards_json: [
      {
        board: "operacional",
        columns: [
          { title: "backlog", cards: ["Pesquisa de mercado e avatar", "Definir mecanismo único", "Criar oferta irresistível", "Gravar módulos do curso", "Configurar área de membros"] },
          { title: "fazendo", cards: [] },
          { title: "travado", cards: [] },
          { title: "revisão", cards: ["Criar página de vendas", "Configurar checkout e upsell"] },
          { title: "feito", cards: [] },
        ],
      },
      {
        board: "campanhas",
        columns: [
          { title: "backlog", cards: ["Criar criativos de anúncio", "Configurar pixel e tracking", "Criar sequência de emails", "Configurar remarketing"] },
          { title: "fazendo", cards: [] },
          { title: "travado", cards: [] },
          { title: "revisão", cards: [] },
          { title: "feito", cards: [] },
        ],
      },
    ],
  },
  {
    name: "Expert Onboarding",
    description: "Processo de onboarding para novos experts na agência",
    icon: "🎓",
    category: "expert",
    boards_json: [
      {
        board: "operacional",
        columns: [
          { title: "backlog", cards: ["Reunião de briefing com expert", "Coletar materiais e acessos", "Mapear avatar e oferta", "Definir escada de valor", "Criar branding do expert"] },
          { title: "fazendo", cards: [] },
          { title: "travado", cards: [] },
          { title: "revisão", cards: ["Aprovar posicionamento", "Validar funil com expert"] },
          { title: "feito", cards: [] },
        ],
      },
    ],
  },
];

type ProjectKpis = {
  receita7: number; receita30: number; receitaPrev30: number;
  delta: number; spend30: number; roas: number;
  leads7: number; health: "hot" | "warm" | "cold";
};

function fmtBRL(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

export default function Projetos() {
  const [projects, setProjects] = useState<any[]>([]);
  const [kpisMap, setKpisMap] = useState<Record<string, ProjectKpis>>({});
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "📁", category: "", description: "" });
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false);
  const [activeFolder, setActiveFolder] = useState("all");
  const [sortMode, setSortMode] = useState<"smart" | "name" | "recent">("smart");
  const [autopilotOpen, setAutopilotOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const loadKpis = async (projs: any[]) => {
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const d60 = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10);
    const ts7 = new Date(now.getTime() - 7 * 86400000).toISOString();

    const [vRes, aRes, lRes] = await Promise.all([
      supabase.from("imphq_vendas").select("project_id, valor, valor_liquido, data_venda").gte("data_venda", d60).limit(5000),
      supabase.from("imphq_ads_spend").select("project_id, valor, data_ref").gte("data_ref", d30).limit(5000),
      supabase.from("imphq_leads").select("project_id, criado_em").gte("criado_em", ts7).limit(5000),
    ]) as any;

    const map: Record<string, ProjectKpis> = {};
    for (const p of projs) {
      const vs = (vRes.data || []).filter((v: any) => v.project_id === p.id);
      const r7 = vs.filter((v: any) => v.data_venda >= d7).reduce((s: number, v: any) => s + Number(v.valor_liquido ?? v.valor ?? 0), 0);
      const r30 = vs.filter((v: any) => v.data_venda >= d30).reduce((s: number, v: any) => s + Number(v.valor_liquido ?? v.valor ?? 0), 0);
      const rPrev = vs.filter((v: any) => v.data_venda < d30 && v.data_venda >= d60).reduce((s: number, v: any) => s + Number(v.valor_liquido ?? v.valor ?? 0), 0);
      const spend30 = (aRes.data || []).filter((a: any) => a.project_id === p.id).reduce((s: number, a: any) => s + Number(a.valor ?? 0), 0);
      const leads7 = (lRes.data || []).filter((l: any) => l.project_id === p.id).length;
      const delta = rPrev > 0 ? ((r30 - rPrev) / rPrev) * 100 : (r30 > 0 ? 100 : 0);
      const roas = spend30 > 0 ? r30 / spend30 : 0;
      const health: ProjectKpis["health"] = r7 > 0 || leads7 >= 5 ? "hot" : (r30 > 0 || leads7 > 0 ? "warm" : "cold");
      map[p.id] = { receita7: r7, receita30: r30, receitaPrev30: rPrev, delta, spend30, roas, leads7, health };
    }
    setKpisMap(map);
  };

  const load = async () => {
    const [projRes, tplRes] = await Promise.all([
      supabase.from("imphq_projects").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_project_templates").select("*").order("created_at", { ascending: false }),
    ]);
    const projs = projRes.data || [];
    setProjects(projs);
    setTemplates((tplRes.data || []) as ProjectTemplate[]);
    loadKpis(projs);
  };

  useEffect(() => { load(); }, []);

  // Get unique folders from categories
  const folders = [...new Set(projects.map(p => p.category || "").filter(Boolean))].sort();

  const filtered = projects.filter((p) => {
    const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase());
    const matchesFolder = activeFolder === "all" || (p.category || "") === activeFolder || (activeFolder === "sem-pasta" && !p.category);
    return matchesSearch && matchesFolder;
  });

  // Smart sort: vendendo first, then by 30d revenue desc, then warm, then cold
  const sortProjects = (items: any[]) => {
    if (sortMode === "name") return [...items].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (sortMode === "recent") return items;
    return [...items].sort((a, b) => {
      const ka = kpisMap[a.id]; const kb = kpisMap[b.id];
      const va = (a.category?.toLowerCase().includes("vendendo") ? 1e9 : 0) + (ka?.receita30 ?? 0);
      const vb = (b.category?.toLowerCase().includes("vendendo") ? 1e9 : 0) + (kb?.receita30 ?? 0);
      return vb - va;
    });
  };

  // Group by folder
  const groupedByFolder = () => {
    if (activeFolder !== "all") return [{ folder: activeFolder, items: sortProjects(filtered) }];
    const groups: { folder: string; items: any[] }[] = [];
    const folderMap = new Map<string, any[]>();
    filtered.forEach(p => {
      const f = p.category || "";
      if (!folderMap.has(f)) folderMap.set(f, []);
      folderMap.get(f)!.push(p);
    });
    // Named folders first, then "Sem pasta"
    folders.forEach(f => {
      if (folderMap.has(f)) groups.push({ folder: f, items: sortProjects(folderMap.get(f)!) });
    });
    if (folderMap.has("")) groups.push({ folder: "", items: sortProjects(folderMap.get("")!) });
    return groups;
  };

  const handleDelete = async (id: string, name: string) => {
    const tables = [
      "imphq_leads", "imphq_vendas", "imphq_automacoes", "imphq_ads_spend",
      "imphq_ads_reports", "imphq_content_library", "imphq_referencias",
      "imphq_kanban_cards", "imphq_wa_campaigns", "imphq_events",
    ];
    for (const table of tables) {
      await supabase.from(table as any).delete().eq("project_id", id);
    }
    const { error } = await supabase.from("imphq_projects").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Projeto excluído", description: `"${name}" foi removido.` });
    load();
  };

  const handleCreate = async () => {
    if (!form.name) return;
    const id = form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { error } = await supabase.from("imphq_projects").insert({
      id, name: form.name, icon: form.icon, category: form.category, description: form.description,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setOpen(false);
    setForm({ name: "", icon: "📁", category: "", description: "" });
    load();
  };

  const createFromTemplate = async (tpl: Omit<ProjectTemplate, "id">) => {
    setCreatingFromTemplate(true);
    try {
      const projectName = tpl.name;
      const projectId = projectName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now().toString(36);
      const { error: projErr } = await supabase.from("imphq_projects").insert({
        id: projectId, name: projectName, icon: tpl.icon, category: tpl.category, description: tpl.description,
      });
      if (projErr) throw projErr;
      for (const boardDef of tpl.boards_json) {
        for (let colIdx = 0; colIdx < boardDef.columns.length; colIdx++) {
          const colDef = boardDef.columns[colIdx];
          const { data: existingCols } = await supabase.from("imphq_kanban_columns").select("id").eq("board", boardDef.board).eq("title", colDef.title).limit(1);
          let columnId: string;
          if (existingCols && existingCols.length > 0) { columnId = existingCols[0].id; } else {
            const { data: newCol } = await supabase.from("imphq_kanban_columns").insert({ title: colDef.title, color: "#8b5cf6", position: colIdx, board: boardDef.board }).select("id").single();
            if (!newCol) continue;
            columnId = newCol.id;
          }
          if (colDef.cards && colDef.cards.length > 0) {
            const cardsToInsert = colDef.cards.map((title: string, i: number) => ({
              column_id: columnId, title, priority: "medium", board: boardDef.board, position: i, tags: [projectId], project_id: projectId,
            }));
            await supabase.from("imphq_kanban_cards").insert(cardsToInsert);
          }
        }
      }
      toast({ title: "Projeto criado!", description: `${projectName} foi criado com ${tpl.boards_json.length} quadro(s) pré-configurados.` });
      setTemplateOpen(false);
      load();
      navigate(`/projetos/${projectId}`);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setCreatingFromTemplate(false);
    }
  };

  const allTemplates = [
    ...DEFAULT_TEMPLATES,
    ...templates.map(t => ({ name: t.name, description: t.description || "", icon: t.icon, category: t.category, boards_json: t.boards_json })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">Projetos</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={() => setAutopilotOpen(true)} className="bg-primary/90 hover:bg-primary">
            <Sparkles className="h-4 w-4 mr-1" /> Autopilot
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTemplateOpen(true)}>
            <BookTemplate className="h-4 w-4 mr-1" /> Criar de Template
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Projeto</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle className="font-display">Novo Projeto</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="w-16">
                    <Label>Emoji</Label>
                    <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="bg-secondary text-center text-xl" />
                  </div>
                  <div className="flex-1">
                    <Label>Nome</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-secondary" />
                  </div>
                </div>
                <div>
                  <Label>Pasta / Categoria</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="bg-secondary" placeholder="Ex: Agência, Pessoal, Clientes..." />
                  {folders.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1.5">
                      {folders.map(f => (
                        <Badge key={f} variant={form.category === f ? "default" : "outline"} className="text-[10px] cursor-pointer" onClick={() => setForm({ ...form, category: f })}>
                          {f}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-secondary" /></div>
                <Button onClick={handleCreate} className="w-full">Criar Projeto</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search + Folder Filter */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar projetos..." className="pl-9 bg-secondary" />
          </div>
          <div className="flex gap-1 text-[10px] uppercase tracking-wider">
            {(["smart", "name", "recent"] as const).map(m => (
              <Badge key={m} variant={sortMode === m ? "default" : "outline"} className="cursor-pointer" onClick={() => setSortMode(m)}>
                {m === "smart" ? "📊 Performance" : m === "name" ? "A→Z" : "Recente"}
              </Badge>
            ))}
          </div>
        </div>
        {folders.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <Badge variant={activeFolder === "all" ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setActiveFolder("all")}>
              Todos ({projects.length})
            </Badge>
            {folders.map(f => (
              <Badge key={f} variant={activeFolder === f ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setActiveFolder(f)}>
                {f} ({projects.filter(p => p.category === f).length})
              </Badge>
            ))}
            <Badge variant={activeFolder === "sem-pasta" ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setActiveFolder("sem-pasta")}>
              Sem pasta ({projects.filter(p => !p.category).length})
            </Badge>
          </div>
        )}
      </div>

      {/* ===== Portfólio Cross-Project ===== */}
      {(() => {
        const allK = Object.values(kpisMap);
        if (allK.length === 0) return null;
        const totalRec30 = allK.reduce((s, k) => s + k.receita30, 0);
        const totalRecPrev = allK.reduce((s, k) => s + k.receitaPrev30, 0);
        const totalSpend = allK.reduce((s, k) => s + k.spend30, 0);
        const totalLeads7 = allK.reduce((s, k) => s + k.leads7, 0);
        const roasGlobal = totalSpend > 0 ? totalRec30 / totalSpend : 0;
        const deltaGlobal = totalRecPrev > 0 ? ((totalRec30 - totalRecPrev) / totalRecPrev) * 100 : 0;
        const enriched = projects
          .map((p) => ({ p, k: kpisMap[p.id] }))
          .filter((x) => x.k);
        const topRev = [...enriched].sort((a, b) => b.k.receita30 - a.k.receita30).slice(0, 3);
        const topGrowth = [...enriched].filter((x) => x.k.receitaPrev30 > 0).sort((a, b) => b.k.delta - a.k.delta).slice(0, 3);
        const inAlert = enriched.filter((x) => x.k.health === "cold" || (x.k.spend30 > 50 && x.k.receita30 === 0));

        const triage = async (id: string, name: string) => {
          await supabase.from("imphq_ai_actions").insert({
            projeto_id: id,
            kind: "portfolio_triage",
            risk_level: "medium",
            status: "pending",
            title: `Triagem de portfólio: ${name}`,
            reason: "Projeto em alerta no painel cross-project (frio ou queimando budget)",
            payload: { project_name: name, source: "projetos_portfolio" },
            source: "projetos_portfolio",
            priority_score: 80,
          } as any);
          toast({ title: "Enviado ao Imperius", description: `${name} entrou na fila de triagem.` });
        };

        return (
          <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  📊 Portfólio
                </h2>
                <span className="text-[10px] text-muted-foreground">{enriched.length} projetos · janela 30d</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-md border border-border/40 bg-secondary/30 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita 30d</div>
                  <div className="font-mono text-base font-bold text-foreground">{fmtBRL(totalRec30)}</div>
                  {totalRecPrev > 0 && (
                    <div className={`text-[10px] tabular-nums ${deltaGlobal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {deltaGlobal >= 0 ? "▲" : "▼"} {Math.abs(deltaGlobal).toFixed(0)}% vs 30d ant.
                    </div>
                  )}
                </div>
                <div className="rounded-md border border-border/40 bg-secondary/30 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">ROAS médio</div>
                  <div className={`font-mono text-base font-bold ${roasGlobal >= 2 ? "text-emerald-400" : roasGlobal >= 1 ? "text-amber-400" : "text-red-400"}`}>
                    {roasGlobal > 0 ? roasGlobal.toFixed(2) + "x" : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">spend {fmtBRL(totalSpend)}</div>
                </div>
                <div className="rounded-md border border-border/40 bg-secondary/30 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Leads 7d</div>
                  <div className="font-mono text-base font-bold text-foreground">{totalLeads7}</div>
                </div>
                <div className="rounded-md border border-border/40 bg-secondary/30 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Em alerta</div>
                  <div className={`font-mono text-base font-bold ${inAlert.length > 0 ? "text-red-400" : "text-emerald-400"}`}>{inAlert.length}</div>
                  <div className="text-[10px] text-muted-foreground">frios ou queimando budget</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">🏆 Top receita 30d</div>
                  <div className="space-y-1">
                    {topRev.map(({ p, k }, i) => (
                      <button key={p.id} onClick={() => navigate(`/projetos/${p.id}`)} className="w-full text-left flex items-center justify-between text-xs hover:bg-secondary/40 rounded px-2 py-1">
                        <span className="truncate">{i + 1}. {p.icon} {p.name}</span>
                        <span className="font-mono text-primary tabular-nums">{fmtBRL(k.receita30)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">📈 Maior crescimento</div>
                  <div className="space-y-1">
                    {topGrowth.length === 0 && <span className="text-xs text-muted-foreground italic">sem comparativo</span>}
                    {topGrowth.map(({ p, k }) => (
                      <button key={p.id} onClick={() => navigate(`/projetos/${p.id}`)} className="w-full text-left flex items-center justify-between text-xs hover:bg-secondary/40 rounded px-2 py-1">
                        <span className="truncate">{p.icon} {p.name}</span>
                        <span className="font-mono text-emerald-400 tabular-nums">▲ {k.delta.toFixed(0)}%</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">⚠️ Precisam atenção</div>
                  <div className="space-y-1">
                    {inAlert.length === 0 && <span className="text-xs text-emerald-400 italic">tudo no azul</span>}
                    {inAlert.slice(0, 4).map(({ p, k }) => (
                      <div key={p.id} className="flex items-center justify-between text-xs hover:bg-secondary/40 rounded px-2 py-1">
                        <button onClick={() => navigate(`/projetos/${p.id}`)} className="truncate text-left flex-1">
                          {p.icon} {p.name} <span className="text-muted-foreground">· {k.spend30 > 0 && k.receita30 === 0 ? `queima ${fmtBRL(k.spend30)}` : "frio"}</span>
                        </button>
                        <button onClick={() => triage(p.id, p.name)} className="text-[10px] text-primary hover:underline shrink-0 ml-2">→ Imperius</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Grouped Projects */}
      {groupedByFolder().map(group => (
        <div key={group.folder || "sem-pasta"} className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">{group.folder || "Sem pasta"}</h2>
            <span className="text-xs text-muted-foreground">({group.items.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {group.items.map((p) => {
              const k = kpisMap[p.id];
              const healthColor = k?.health === "hot" ? "bg-emerald-500" : k?.health === "warm" ? "bg-amber-500" : "bg-muted-foreground/40";
              const deltaUp = (k?.delta ?? 0) >= 0;
              return (
              <Card key={p.id} className="bg-card border-border hover:border-primary/30 cursor-pointer transition-all hover:shadow-lg hover:shadow-primary/5 group relative">
                <CardContent className="p-4" onClick={() => navigate(`/projetos/${p.id}`)}>
                  <div className="flex items-start justify-between">
                    <span className="text-2xl">{p.icon || "📁"}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${healthColor}`} title={k?.health || ""} />
                  </div>
                  <h3 className="mt-2 font-medium text-sm truncate">{p.name}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{p.category || "Sem categoria"}</p>

                  {k && (k.receita30 > 0 || k.leads7 > 0 || k.spend30 > 0) ? (
                    <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <div className="text-muted-foreground uppercase tracking-wider">Rec 30d</div>
                        <div className="font-semibold tabular-nums text-foreground">{fmtBRL(k.receita30)}</div>
                        {k.receitaPrev30 > 0 && (
                          <div className={`tabular-nums ${deltaUp ? "text-emerald-400" : "text-red-400"}`}>
                            {deltaUp ? "▲" : "▼"} {Math.abs(k.delta).toFixed(0)}%
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-muted-foreground uppercase tracking-wider">ROAS</div>
                        <div className={`font-semibold tabular-nums ${k.roas >= 2 ? "text-emerald-400" : k.roas >= 1 ? "text-amber-400" : k.roas > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                          {k.roas > 0 ? k.roas.toFixed(2) + "x" : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground uppercase tracking-wider">Leads 7d</div>
                        <div className="font-semibold tabular-nums text-foreground">{k.leads7}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-border/40 text-[10px] text-muted-foreground italic">Sem atividade recente</div>
                  )}
                </CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="absolute top-2 right-8 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir "{p.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>Todos os dados do projeto (leads, vendas, automações, conteúdo) serão removidos permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(p.id, p.name)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Template Selection Dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Criar de Template</DialogTitle>
            <p className="text-xs text-muted-foreground">Selecione um playbook para gerar o projeto com quadros Kanban pré-configurados</p>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
            {allTemplates.map((tpl, i) => (
              <Card
                key={i}
                className="bg-secondary/50 border-border hover:border-primary/30 cursor-pointer transition-all hover:shadow-md"
                onClick={() => !creatingFromTemplate && createFromTemplate(tpl)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{tpl.icon}</span>
                    <div>
                      <h3 className="font-medium text-sm">{tpl.name}</h3>
                      <p className="text-[10px] text-muted-foreground">{tpl.category}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{tpl.description}</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {tpl.boards_json.map((b: any, bi: number) => (
                      <span key={bi} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {b.board} ({b.columns?.reduce((s: number, c: any) => s + (c.cards?.length || 0), 0)} cards)
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {creatingFromTemplate && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Criando projeto e quadros...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AutopilotModal open={autopilotOpen} onOpenChange={setAutopilotOpen} onCreated={load} />
    </div>
  );
}
