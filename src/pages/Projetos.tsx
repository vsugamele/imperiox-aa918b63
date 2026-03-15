import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, BookTemplate, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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

export default function Projetos() {
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "📁", category: "", description: "" });
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const load = async () => {
    const [projRes, tplRes] = await Promise.all([
      supabase.from("imphq_projects").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_project_templates").select("*").order("created_at", { ascending: false }),
    ]);
    setProjects(projRes.data || []);
    setTemplates((tplRes.data || []) as ProjectTemplate[]);
  };

  useEffect(() => { load(); }, []);

  const filtered = projects.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

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

      // Create project
      const { error: projErr } = await supabase.from("imphq_projects").insert({
        id: projectId, name: projectName, icon: tpl.icon, category: tpl.category, description: tpl.description,
      });
      if (projErr) throw projErr;

      // Create boards, columns and cards from template
      for (const boardDef of tpl.boards_json) {
        for (let colIdx = 0; colIdx < boardDef.columns.length; colIdx++) {
          const colDef = boardDef.columns[colIdx];
          
          // Check if column exists for this board
          const { data: existingCols } = await supabase
            .from("imphq_kanban_columns")
            .select("id")
            .eq("board", boardDef.board)
            .eq("title", colDef.title)
            .limit(1);

          let columnId: string;
          if (existingCols && existingCols.length > 0) {
            columnId = existingCols[0].id;
          } else {
            const { data: newCol } = await supabase
              .from("imphq_kanban_columns")
              .insert({ title: colDef.title, color: "#8b5cf6", position: colIdx, board: boardDef.board })
              .select("id")
              .single();
            if (!newCol) continue;
            columnId = newCol.id;
          }

          // Create cards
          if (colDef.cards && colDef.cards.length > 0) {
            const cardsToInsert = colDef.cards.map((title: string, i: number) => ({
              column_id: columnId,
              title,
              priority: "medium",
              board: boardDef.board,
              position: i,
              tags: [projectId],
              project_id: projectId,
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
                <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="bg-secondary" /></div>
                <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-secondary" /></div>
                <Button onClick={handleCreate} className="w-full">Criar Projeto</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar projetos..." className="pl-9 bg-secondary" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((p) => (
          <Card key={p.id} onClick={() => navigate(`/projetos/${p.id}`)} className="bg-card border-border hover:border-primary/30 cursor-pointer transition-all hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <span className="text-2xl">{p.icon || "📁"}</span>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color || "hsl(var(--primary))" }} />
              </div>
              <h3 className="mt-2 font-medium text-sm">{p.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{p.category || "Sem categoria"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
    </div>
  );
}
