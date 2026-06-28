import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Workflow, User, Globe, BarChart3, Sparkles, ExternalLink, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  projectName?: string;
  produto?: any;
  briefing?: any;
  onProjectReload?: () => void | Promise<void>;
}

export function EcosystemDrawer({ open, onOpenChange, projectId, projectName, produto, briefing, onProjectReload }: Props) {
  const [tab, setTab] = useState("flows");
  const [flows, setFlows] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [kpis, setKpis] = useState<{ vendas7d: number; receita7d: number; leads7d: number; quentes: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [auditUrl, setAuditUrl] = useState("");
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [genAvatar, setGenAvatar] = useState(false);

  const avatar = briefing?.avatar || briefing?.avatars_por_produto || null;
  const produtoLinks: any[] = (produto?.links_meta || produto?.links || []) as any[];

  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    (async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const sb: any = supabase;
      const queries: PromiseLike<any>[] = [
        sb.from("imphq_automacoes")
          .select("id, nome, ativo, trigger_tipo, updated_at, project_id")
          .eq("project_id", projectId)
          .order("ativo", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(100),

        sb.from("imphq_project_sites").select("id, url, label, tipo").eq("project_id", projectId).limit(20),
        sb.from("imphq_vendas").select("valor, status").eq("project_id", projectId).gte("data_venda", since),
        sb.from("imphq_leads").select("id, score").eq("project_id", projectId).gte("created_at", since),
      ];
      const [aut, sit, ven, lead] = await Promise.all(queries);
      setFlows((aut.data as any) || []);
      setSites((sit.data as any) || []);
      const vendas = ((ven.data as any) || []).filter((v: any) => (v.status || "").toLowerCase().includes("aprov") || (v.status || "").toLowerCase().includes("paid"));
      const receita = vendas.reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
      const leads = ((lead.data as any) || []);
      setKpis({
        vendas7d: vendas.length,
        receita7d: receita,
        leads7d: leads.length,
        quentes: leads.filter((l: any) => Number(l.score || 0) >= 70).length,
      });
      setLoading(false);
    })();
  }, [open, projectId]);

  const runPageAudit = async (url: string) => {
    if (!url) return;
    setAuditing(true);
    setAuditResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("funnel-page-audit", {
        body: { url, project_id: projectId, produto, avatar },
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || "Falha");
      setAuditResult((data as any).audit);
      toast.success("Página auditada");
    } catch (e: any) {
      toast.error(e.message || "Erro ao auditar");
    } finally {
      setAuditing(false);
    }
  };

  const generateAvatar = async () => {
    if (!projectId) return;
    setGenAvatar(true);
    try {
      const { data, error } = await supabase.functions.invoke("avatar-pipeline", {
        body: { project_id: projectId, produto_nome: produto?.nome || produto?.name },
      });
      if (error) throw error;
      toast.success("Avatar gerado");
      await onProjectReload?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar avatar");
    } finally {
      setGenAvatar(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[520px] bg-[#0a0608] border-l border-border/60 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-foreground">
            🌐 Ecossistema · <span className="text-muted-foreground text-sm font-normal">{projectName}</span>
          </SheetTitle>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="flows"><Workflow className="h-3.5 w-3.5 mr-1" /> Fluxos</TabsTrigger>
            <TabsTrigger value="avatar"><User className="h-3.5 w-3.5 mr-1" /> Avatar</TabsTrigger>
            <TabsTrigger value="pages"><Globe className="h-3.5 w-3.5 mr-1" /> Páginas</TabsTrigger>
            <TabsTrigger value="kpis"><BarChart3 className="h-3.5 w-3.5 mr-1" /> KPIs</TabsTrigger>
          </TabsList>

          <TabsContent value="flows" className="mt-4 space-y-2">
            {loading ? <p className="text-xs text-muted-foreground">Carregando…</p> : flows.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum fluxo no OpenFlow para este projeto.</p>
            ) : (
              flows.map(f => (
                <div key={f.id} className="rounded-md border border-border/40 bg-secondary/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{f.nome || "Sem nome"}</p>
                      <p className="text-[10px] text-muted-foreground">{f.trigger_tipo || "—"}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {f.project_id == null && (
                        <Badge variant="outline" className="text-[9px]">Global</Badge>
                      )}
                      <Badge variant={f.ativo ? "default" : "outline"} className="text-[9px]">
                        {f.ativo ? "Ativo" : "Pausado"}
                      </Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] mt-2 gap-1"
                    onClick={() => window.open(`/openflow?id=${f.id}`, "_blank")}>
                    <ExternalLink className="h-3 w-3" /> Abrir no OpenFlow
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="avatar" className="mt-4 space-y-3">
            {avatar ? (
              <div className="rounded-md border border-border/40 bg-secondary/20 p-3 text-xs leading-6 max-h-[60vh] overflow-y-auto">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Avatar atual</p>
                <pre className="whitespace-pre-wrap text-foreground/85 font-sans">
                  {typeof avatar === "string" ? avatar : JSON.stringify(avatar, null, 2).slice(0, 3000)}
                </pre>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum avatar definido ainda.</p>
            )}
            <Button onClick={generateAvatar} disabled={genAvatar} size="sm" className="w-full gap-1.5 bg-gradient-to-r from-sky-600 to-violet-600 text-white">
              {genAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {avatar ? "Regenerar avatar com IA" : "Criar avatar com IA"}
            </Button>
          </TabsContent>

          <TabsContent value="pages" className="mt-4 space-y-3">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Auditar nova página</p>
              <div className="flex gap-2">
                <Input value={auditUrl} onChange={e => setAuditUrl(e.target.value)} placeholder="https://..." className="h-8 text-xs" />
                <Button size="sm" onClick={() => runPageAudit(auditUrl)} disabled={!auditUrl || auditing} className="h-8 gap-1">
                  {auditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Auditar
                </Button>
              </div>
            </div>

            {auditResult && (
              <div className="rounded-md border border-pink-500/40 bg-pink-500/5 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-pink-200">Score</span>
                  <span className="text-2xl font-bold text-pink-300">{auditResult.score ?? "—"}</span>
                </div>
                {auditResult.veredito && <p className="text-foreground/85 italic">"{auditResult.veredito}"</p>}
                {auditResult.issues?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase text-rose-300 mt-2">Problemas</p>
                    <ul className="list-disc list-inside text-foreground/80 space-y-0.5">
                      {auditResult.issues.map((i: string, k: number) => <li key={k}>{i}</li>)}
                    </ul>
                  </div>
                )}
                {auditResult.quick_wins?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase text-emerald-300 mt-2">Quick wins</p>
                    <ul className="list-disc list-inside text-foreground/80 space-y-0.5">
                      {auditResult.quick_wins.map((i: string, k: number) => <li key={k}>{i}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Páginas do projeto</p>
              {[...sites, ...produtoLinks].length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma página cadastrada.</p>
              ) : (
                <div className="space-y-1">
                  {sites.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 rounded border border-border/40 bg-secondary/20 px-2 py-1.5">
                      <div className="min-w-0">
                        <p className="text-xs text-foreground truncate">{s.label || s.tipo || s.url}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{s.url}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setAuditUrl(s.url); runPageAudit(s.url); }}>
                        Auditar
                      </Button>
                    </div>
                  ))}
                  {produtoLinks.map((l: any, k: number) => (
                    <div key={`pl-${k}`} className="flex items-center justify-between gap-2 rounded border border-border/40 bg-secondary/20 px-2 py-1.5">
                      <div className="min-w-0">
                        <p className="text-xs text-foreground truncate">{l.label || l.tipo || l.url}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{l.url}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setAuditUrl(l.url); runPageAudit(l.url); }}>
                        Auditar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="kpis" className="mt-4">
            {!kpis ? <p className="text-xs text-muted-foreground">Carregando…</p> : (
              <div className="grid grid-cols-2 gap-2">
                <KpiCard label="Vendas 7d" value={kpis.vendas7d} />
                <KpiCard label="Receita 7d" value={`R$ ${kpis.receita7d.toFixed(0)}`} />
                <KpiCard label="Leads 7d" value={kpis.leads7d} />
                <KpiCard label="Leads quentes" value={kpis.quentes} accent="text-pink-300" />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function KpiCard({ label, value, accent = "text-foreground" }: { label: string; value: any; accent?: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/20 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent}`}>{value}</p>
    </div>
  );
}
