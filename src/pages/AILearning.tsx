import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Brain, BookOpen, Ban, MessagesSquare, TrendingUp, Inbox, Check, X } from "lucide-react";
import AILearnedRulesPanel from "@/components/whatsapp/AILearnedRulesPanel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";


type Project = { id: string; name: string };
type Knowledge = {
  id: string; pergunta: string; resposta: string; source: string | null;
  score_uso: number | null; last_applied_at: string | null; aprovada: boolean | null; created_at: string;
};
type Memory = {
  id: string; phone: string | null; lead_id: string | null; content: string;
  memory_type: string | null; emotional_state: string | null; last_objection: string | null; updated_at: string;
};

export default function AILearning() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [stats, setStats] = useState({ rules: 0, applied7d: 0, knowledge: 0, memories: 0 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("imphq_projects")
        .select("id, name")
        .order("name");
      const list = (data || []) as Project[];
      setProjects(list);
      if (list[0]) setProjectId(list[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const [r1, r2, r3, r4] = await Promise.all([
        supabase.from("imphq_wa_project_rules").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("active", true),
        supabase.from("imphq_wa_rule_applications").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("applied_at", since),
        supabase.from("imphq_wa_knowledge").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("aprovada", true),
        supabase.from("imphq_wa_lead_memories").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      ]);
      setStats({
        rules: r1.count || 0,
        applied7d: r2.count || 0,
        knowledge: r3.count || 0,
        memories: r4.count || 0,
      });
    })();
  }, [projectId]);

  return (
    <div className="container mx-auto px-4 md:px-6 py-6 space-y-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display flex items-center gap-3">
            <Brain className="h-7 w-7 text-primary" /> Memória Viva da IA
          </h1>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Tudo que a IA aprendeu com você — regras, respostas, bloqueios e contexto de cada lead.
          </p>
        </div>
        <div className="w-full md:w-72">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
            <SelectContent>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={BookOpen} label="Regras ativas" value={stats.rules} accent />
        <StatCard icon={TrendingUp} label="Aplicações (7d)" value={stats.applied7d} />
        <StatCard icon={MessagesSquare} label="Respostas aprovadas" value={stats.knowledge} />
        <StatCard icon={Brain} label="Memórias de leads" value={stats.memories} />
      </div>

      {projectId && (
        <Tabs defaultValue="rules" className="w-full">
          <TabsList className="grid grid-cols-5 w-full md:w-auto">
            <TabsTrigger value="rules">Regras</TabsTrigger>
            <TabsTrigger value="pending" className="gap-1.5">
              <Inbox className="h-3 w-3" /> Pendentes
            </TabsTrigger>
            <TabsTrigger value="knowledge">Respostas</TabsTrigger>
            <TabsTrigger value="blocks">Bloqueios</TabsTrigger>
            <TabsTrigger value="memories">Memórias</TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-4">
            <Card className="p-4 bg-secondary/20 border-border/40">
              <AILearnedRulesPanel projectId={projectId} />
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="mt-4">
            <PendingTab projectId={projectId} />
          </TabsContent>

          <TabsContent value="knowledge" className="mt-4">
            <KnowledgeTab projectId={projectId} />
          </TabsContent>

          <TabsContent value="blocks" className="mt-4">
            <BlocksTab projectId={projectId} />
          </TabsContent>

          <TabsContent value="memories" className="mt-4">
            <MemoriesTab projectId={projectId} />
          </TabsContent>
        </Tabs>

      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: boolean }) {
  return (
    <Card className={`p-4 ${accent ? "border-primary/30 bg-primary/5" : "bg-secondary/20 border-border/40"}`}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-display ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </Card>
  );
}

function KnowledgeTab({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("imphq_wa_knowledge")
        .select("id, pergunta, resposta, source, score_uso, last_applied_at, aprovada, created_at")
        .eq("project_id", projectId)
        .order("score_uso", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) toast.error("Erro ao carregar respostas");
      setRows((data as Knowledge[]) || []);
      setLoading(false);
    })();
  }, [projectId]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(r => r.pergunta?.toLowerCase().includes(s) || r.resposta?.toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <Card className="p-4 bg-secondary/20 border-border/40">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold">Respostas aprendidas ({rows.length})</p>
        <Input placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} className="max-w-xs h-8" />
      </div>
      <ScrollArea className="h-[520px]">
        {loading ? <Center><Loader2 className="h-4 w-4 animate-spin" /></Center>
          : filtered.length === 0 ? <Empty msg="Nada por aqui. Marque respostas no chat como 'Resposta melhor' para alimentar a base." />
          : (
            <div className="divide-y divide-border/30">
              {filtered.map(k => (
                <div key={k.id} className="py-3 px-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {k.aprovada && <Badge variant="outline" className="text-[10px] h-5 border-emerald-500/40 text-emerald-300">aprovada</Badge>}
                    {k.source && <Badge variant="outline" className="text-[10px] h-5">{k.source}</Badge>}
                    {(k.score_uso ?? 0) > 0 && <Badge variant="secondary" className="text-[10px] h-5">{k.score_uso}× usada</Badge>}
                    {k.last_applied_at && (
                      <span className="text-[10px] text-muted-foreground">
                        última: {new Date(k.last_applied_at).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground leading-6">P: {k.pergunta}</p>
                  <p className="text-sm text-muted-foreground leading-6">R: {k.resposta}</p>
                </div>
              ))}
            </div>
          )}
      </ScrollArea>
    </Card>
  );
}

function BlocksTab({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("imphq_wa_project_rules")
        .select("id, rule_text, active, times_applied, last_applied_at, created_at")
        .eq("project_id", projectId)
        .eq("rule_type", "unavailable_product")
        .order("created_at", { ascending: false });
      setRows(data || []);
      setLoading(false);
    })();
  }, [projectId]);

  return (
    <Card className="p-4 bg-secondary/20 border-border/40">
      <p className="text-sm font-semibold mb-3">Produtos / temas bloqueados ({rows.length})</p>
      <ScrollArea className="h-[520px]">
        {loading ? <Center><Loader2 className="h-4 w-4 animate-spin" /></Center>
          : rows.length === 0 ? <Empty msg="Nenhum bloqueio cadastrado. No chat, use 'Produto indisponível' para impedir ofertas." />
          : (
            <div className="divide-y divide-border/30">
              {rows.map(b => (
                <div key={b.id} className="py-3 px-1 space-y-1 flex items-start gap-2">
                  <Ban className={`h-4 w-4 mt-0.5 shrink-0 ${b.active ? "text-destructive" : "text-muted-foreground"}`} />
                  <div className="flex-1">
                    <p className={`text-sm leading-6 ${b.active ? "text-foreground" : "text-muted-foreground line-through"}`}>{b.rule_text}</p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {b.times_applied || 0}× bloqueado · criado {new Date(b.created_at).toLocaleDateString("pt-BR")}
                      {b.last_applied_at && <> · última {new Date(b.last_applied_at).toLocaleDateString("pt-BR")}</>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
      </ScrollArea>
    </Card>
  );
}

function MemoriesTab({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("imphq_wa_lead_memories")
        .select("id, phone, lead_id, content, memory_type, emotional_state, last_objection, updated_at")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false })
        .limit(500);
      setRows((data as Memory[]) || []);
      setLoading(false);
    })();
  }, [projectId]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(r =>
      r.phone?.toLowerCase().includes(s) ||
      r.content?.toLowerCase().includes(s) ||
      r.last_objection?.toLowerCase().includes(s)
    );
  }, [rows, q]);

  const TYPE_COLORS: Record<string, string> = {
    pain: "border-red-500/40 text-red-300",
    desire: "border-emerald-500/40 text-emerald-300",
    objection: "border-amber-500/40 text-amber-300",
  };

  return (
    <Card className="p-4 bg-secondary/20 border-border/40">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold">Memórias de leads ({rows.length})</p>
        <Input placeholder="Buscar telefone, dor, objeção..." value={q} onChange={e => setQ(e.target.value)} className="max-w-xs h-8" />
      </div>
      <ScrollArea className="h-[520px]">
        {loading ? <Center><Loader2 className="h-4 w-4 animate-spin" /></Center>
          : filtered.length === 0 ? <Empty msg="Sem memórias ainda. A IA extrai automaticamente dores, desejos e objeções das conversas." />
          : (
            <div className="divide-y divide-border/30">
              {filtered.map(m => (
                <div key={m.id} className="py-3 px-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {m.memory_type && (
                      <Badge variant="outline" className={`text-[10px] h-5 ${TYPE_COLORS[m.memory_type] || ""}`}>
                        {m.memory_type}
                      </Badge>
                    )}
                    {m.phone && <span className="text-xs text-muted-foreground font-mono">{m.phone}</span>}
                    {m.emotional_state && <Badge variant="secondary" className="text-[10px] h-5">{m.emotional_state}</Badge>}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(m.updated_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-6">{m.content}</p>
                  {m.last_objection && (
                    <p className="text-xs text-amber-300/80 leading-6">Última objeção: {m.last_objection}</p>
                  )}
                </div>
              ))}
            </div>
          )}
      </ScrollArea>
    </Card>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">{children}</div>;
}
function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-center px-6">
      <Brain className="h-8 w-8 text-muted-foreground/40 mb-2" />
      <p className="text-sm text-muted-foreground leading-6">{msg}</p>
    </div>
  );
}

function PendingTab({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("imphq_wa_project_rules")
      .select("id, rule_text, rule_type, pending_reason, created_at, active")
      .eq("project_id", projectId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setRows(data || []);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    setSelected(selected.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));
  };

  const bulk = async (action: "approve" | "reject") => {
    if (selected.size === 0) return;
    setBusy(true);
    const ids = Array.from(selected);
    const patch = action === "approve"
      ? { status: "active", active: true, approved_at: new Date().toISOString() }
      : { status: "archived", active: false };
    const { error } = await supabase.from("imphq_wa_project_rules").update(patch).in("id", ids);
    setBusy(false);
    if (error) { toast.error("Falha ao atualizar"); return; }
    toast.success(`${ids.length} ${action === "approve" ? "aprovadas" : "arquivadas"}`);
    load();
  };

  return (
    <Card className="p-4 bg-secondary/20 border-border/40">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold">Aprendizados pendentes ({rows.length})</p>
          <p className="text-[11px] text-muted-foreground leading-5 mt-0.5">
            Sugestões da IA aguardando revisão. Aprove para virar regra ativa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={toggleAll} disabled={rows.length === 0} className="h-8 text-xs">
            {selected.size === rows.length && rows.length > 0 ? "Limpar" : "Selecionar tudo"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulk("reject")} disabled={selected.size === 0 || busy} className="h-8 text-xs">
            <X className="h-3 w-3 mr-1" /> Rejeitar ({selected.size})
          </Button>
          <Button size="sm" onClick={() => bulk("approve")} disabled={selected.size === 0 || busy} className="h-8 text-xs">
            <Check className="h-3 w-3 mr-1" /> Aprovar ({selected.size})
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[520px]">
        {loading ? <Center><Loader2 className="h-4 w-4 animate-spin" /></Center>
          : rows.length === 0 ? <Empty msg="Nada pendente. A IA registra aqui regras candidatas a partir das suas correções no chat." />
          : (
            <div className="divide-y divide-border/30">
              {rows.map(r => (
                <div key={r.id} className="py-3 px-1 flex items-start gap-3">
                  <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.rule_type && <Badge variant="outline" className="text-[10px] h-5">{r.rule_type}</Badge>}
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-6">{r.rule_text}</p>
                    {r.pending_reason && (
                      <p className="text-xs text-muted-foreground italic leading-5">↳ {r.pending_reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
      </ScrollArea>
    </Card>
  );
}

