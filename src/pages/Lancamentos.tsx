import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Rocket, Mail, AlertTriangle, Users, TrendingUp, ExternalLink } from "lucide-react";
import { BulkEnrollDialog } from "@/components/nurture/BulkEnrollDialog";
import { toast } from "sonner";

interface Project { id: string; nome: string; }
interface Lead { id: string; created_at: string; project_id: string | null; data: any; email?: string | null; }
interface Sequence { id: string; nome: string; project_id: string | null; produto_nome: string | null; ativa: boolean; }
interface Enrollment { lead_id: string; sequence_id: string; status: string; }
interface Campaign { id: string; nome: string; project_id: string | null; produto: string | null; status: string; data: any; }

const PERIODS = [7, 14, 30, 60, 90];

export default function Lancamentos() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("__all__");
  const [days, setDays] = useState<number>(30);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [emailCount, setEmailCount] = useState<number>(0);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = async () => {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [{ data: prjs }, { data: cps }, { data: seqs }] = await Promise.all([
      supabase.from("imphq_projects").select("id,name").order("name"),
      supabase.from("imphq_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_nurture_sequences").select("id,nome,project_id,produto_nome,ativa"),
    ] as PromiseLike<any>[]);
    setProjects(((prjs || []) as any[]).map((p: any) => ({ id: p.id, nome: p.name })));
    setCampaigns((cps || []) as any);
    setSequences((seqs || []) as any);

    let leadsQ = supabase.from("imphq_leads").select("id,created_at,project_id,data,email").gte("created_at", since).limit(5000);
    if (projectId !== "__all__") leadsQ = leadsQ.eq("project_id", projectId);
    const { data: lds } = await leadsQ;
    setLeads((lds || []) as any);

    const leadIds = (lds || []).map((l: any) => l.id);
    if (leadIds.length) {
      const { data: enr } = await supabase
        .from("imphq_lead_sequence_enrollments")
        .select("lead_id,sequence_id,status")
        .in("lead_id", leadIds);
      setEnrollments((enr || []) as any);
    } else {
      setEnrollments([]);
    }

    // contagem global de e-mails enviados (do projeto/filtro)
    const seqIds = ((seqs || []) as any[])
      .filter((s: any) => projectId === "__all__" || s.project_id === projectId)
      .map((s: any) => s.id);
    if (seqIds.length) {
      const { count } = await supabase
        .from("imphq_nurture_emails")
        .select("id", { count: "exact", head: true })
        .in("sequence_id", seqIds)
        .gte("created_at", since);
      setEmailCount(count || 0);
    } else {
      setEmailCount(0);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId, days]);

  const projectName = (id: string | null) => projects.find(p => p.id === id)?.nome || id || "Sem projeto";

  // Agrupa por lançamento (campanha se houver; senão por projeto)
  type Group = { key: string; nome: string; project_id: string | null; campaign_id: string | null; leads: Lead[]; };
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const l of leads) {
      const cid = l.data?.campaign_id as string | undefined;
      const camp = cid ? campaigns.find(c => c.id === cid) : null;
      const key = camp ? `c:${camp.id}` : `p:${l.project_id || "__none__"}`;
      const nome = camp ? camp.nome : `${projectName(l.project_id)} (sem campanha)`;
      if (!map.has(key)) map.set(key, { key, nome, project_id: l.project_id, campaign_id: camp?.id || null, leads: [] });
      map.get(key)!.leads.push(l);
    }
    return Array.from(map.values()).sort((a, b) => b.leads.length - a.leads.length);
  }, [leads, campaigns, projects]);

  const enrolledLeadIds = useMemo(() => new Set(enrollments.filter(e => e.status === "ativa" || e.status === "active" || !e.status).map(e => e.lead_id)), [enrollments]);

  const stats = (g: Group) => {
    const now = Date.now();
    const d24 = g.leads.filter(l => now - new Date(l.created_at).getTime() < 86400000).length;
    const d7 = g.leads.filter(l => now - new Date(l.created_at).getTime() < 7 * 86400000).length;
    const enrolled = g.leads.filter(l => enrolledLeadIds.has(l.id)).length;
    const pct = g.leads.length ? Math.round((enrolled / g.leads.length) * 100) : 0;
    const ritmo = (g.leads.length / Math.max(1, days)).toFixed(1);
    return { d24, d7, enrolled, pct, ritmo };
  };

  // Diagnóstico global do projeto selecionado
  const projectDiag = useMemo(() => {
    if (projectId === "__all__") return null;
    const total = leads.length;
    const enrolled = leads.filter(l => enrolledLeadIds.has(l.id)).length;
    const missing = total - enrolled;
    const seqs = sequences.filter(s => s.project_id === projectId && s.ativa);
    return { total, enrolled, missing, pct: total ? Math.round((enrolled / total) * 100) : 0, seqsAtivas: seqs.length };
  }, [projectId, leads, enrolledLeadIds, sequences]);

  const createCampaignFromGroup = async (g: Group) => {
    if (g.campaign_id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const nome = prompt("Nome do lançamento:", `${projectName(g.project_id)} — ${new Date().toLocaleDateString("pt-BR")}`);
    if (!nome) return;
    const id = `camp_${Date.now()}`;
    const { error } = await supabase.from("imphq_campaigns").insert({
      id, nome, project_id: g.project_id, status: "ativa", funil: "aquisicao", data: {}, user_id: user.id,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Lançamento criado");
    load();
  };

  const availableSequences = useMemo(
    () => sequences.filter(s => projectId === "__all__" || s.project_id === projectId).map(s => ({ id: s.id, nome: s.nome, produto: s.produto_nome })),
    [sequences, projectId]
  );

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl text-primary flex items-center gap-2">
            <Rocket className="h-7 w-7" /> Lançamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Leads capturados, ritmo e saúde de nutrição por lançamento.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[220px] bg-secondary"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos projetos</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
            <SelectTrigger className="w-[120px] bg-secondary"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map(d => <SelectItem key={d} value={String(d)}>{d} dias</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* KPI macro */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-secondary/40"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Leads no período</div>
          <div className="text-3xl font-display text-primary mt-1">{leads.length}</div>
        </CardContent></Card>
        <Card className="bg-secondary/40"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Lançamentos ativos</div>
          <div className="text-3xl font-display text-primary mt-1">{groups.length}</div>
        </CardContent></Card>
        <Card className="bg-secondary/40"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Em sequência</div>
          <div className="text-3xl font-display text-primary mt-1">{enrolledLeadIds.size}</div>
        </CardContent></Card>
        <Card className="bg-secondary/40"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">E-mails enviados ({days}d)</div>
          <div className="text-3xl font-display text-primary mt-1">{emailCount}</div>
        </CardContent></Card>
      </div>

      {/* Diagnóstico do projeto */}
      {projectDiag && (
        <Card className={`border ${projectDiag.missing > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {projectDiag.missing > 0 ? <AlertTriangle className="h-5 w-5 text-amber-400" /> : <Mail className="h-5 w-5 text-emerald-400" />}
              Diagnóstico de e-mails — {projectName(projectId)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 leading-7">
            <div className="text-sm">
              <span className="font-bold text-foreground">{projectDiag.enrolled} de {projectDiag.total}</span> leads ({projectDiag.pct}%) estão em alguma sequência de e-mail nos últimos {days} dias.
              {projectDiag.seqsAtivas === 0 && <span className="text-amber-400"> Nenhuma sequência ativa configurada neste projeto.</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {projectDiag.missing > 0 && availableSequences.length > 0 && (
                <Button size="sm" onClick={() => setBulkOpen(true)}>
                  <Users className="h-4 w-4 mr-1" /> Inscrever {projectDiag.missing} leads em massa
                </Button>
              )}
              <Button asChild size="sm" variant="outline">
                <Link to="/nutricao"><Mail className="h-4 w-4 mr-1" /> Editar sequências</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/campanhas"><ExternalLink className="h-4 w-4 mr-1" /> Configurar campanhas</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de lançamentos */}
      {groups.length === 0 ? (
        <Card className="bg-secondary/40"><CardContent className="py-12 text-center text-muted-foreground leading-7">
          Sem leads no período selecionado.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(g => {
            const s = stats(g);
            const camp = g.campaign_id ? campaigns.find(c => c.id === g.campaign_id) : null;
            const hasSeq = !!camp?.data?.default_sequence_id;
            return (
              <Card key={g.key} className="bg-secondary/40 border-border hover:border-primary/30 transition">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-display text-foreground line-clamp-2">{g.nome}</CardTitle>
                    {g.campaign_id ? (
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Campanha</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/30">Sem campanha</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{projectName(g.project_id)}</div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-background/50 rounded p-2">
                      <div className="text-lg font-bold text-primary">{g.leads.length}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Leads</div>
                    </div>
                    <div className="bg-background/50 rounded p-2">
                      <div className="text-lg font-bold text-primary">{s.d24}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">24h</div>
                    </div>
                    <div className="bg-background/50 rounded p-2">
                      <div className="text-lg font-bold text-primary">{s.d7}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">7d</div>
                    </div>
                    <div className="bg-background/50 rounded p-2 flex flex-col items-center justify-center">
                      <div className="text-lg font-bold text-primary flex items-center gap-1"><TrendingUp className="h-3 w-3" />{s.ritmo}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">/dia</div>
                    </div>
                  </div>
                  <div className="text-xs flex items-center justify-between">
                    <span className="text-muted-foreground">Nutrição</span>
                    <span className={s.pct >= 70 ? "text-emerald-400" : s.pct >= 30 ? "text-amber-400" : "text-rose-400"}>
                      {s.enrolled}/{g.leads.length} ({s.pct}%)
                    </span>
                  </div>
                  {g.campaign_id && !hasSeq && (
                    <div className="text-[11px] text-amber-400 leading-5">⚠ Esta campanha não tem sequência padrão. Leads novos não entram em nutrição automaticamente.</div>
                  )}
                  {!g.campaign_id && (
                    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => createCampaignFromGroup(g)}>
                      <Rocket className="h-3 w-3 mr-1" /> Criar lançamento
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BulkEnrollDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        sequences={availableSequences as any}
        onDone={load}
      />
    </div>
  );
}
