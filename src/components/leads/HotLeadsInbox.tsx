import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Flame, MessageCircle, Eye, Copy, Search, RefreshCw } from "lucide-react";
import { calcHotLead, heatColor, type HotLeadResult, type LeadSignals } from "@/lib/hotLeadScore";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lead {
  id: string;
  nome?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  score?: number | null;
  total_gasto?: number | string | null;
  updated_at?: string | null;
  data?: any;
  project_id?: string | null;
}

interface Project { id: string; name: string; icon?: string | null }

interface Props {
  leads: Lead[];
  projects: Project[];
  onOpenLead: (leadId: string) => void;
}

export default function HotLeadsInbox({ leads, projects, onOpenLead }: Props) {
  const [predictions, setPredictions] = useState<Record<string, number>>({});
  const [contacted, setContacted] = useState<Record<string, string>>({}); // leadId -> ISO
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [hideContacted, setHideContacted] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Carrega predições e últimos contatos para os leads visíveis
  const loadAux = async () => {
    setRefreshing(true);
    const ids = leads.map((l) => l.id);
    if (ids.length === 0) { setRefreshing(false); return; }

    try {
      // Predições
      const { data: preds } = await supabase
        .from("imphq_lead_predictions" as any)
        .select("lead_id, probability")
        .in("lead_id", ids);
      const pmap: Record<string, number> = {};
      (preds || []).forEach((p: any) => { if (p?.lead_id) pmap[p.lead_id] = parseFloat(p.probability) || 0; });
      setPredictions(pmap);

      // Últimos contatos (activity log)
      const { data: acts } = await supabase
        .from("imphq_activity_log")
        .select("lead_id, created_at")
        .in("lead_id", ids)
        .order("created_at", { ascending: false })
        .limit(500);
      const cmap: Record<string, string> = {};
      (acts || []).forEach((a: any) => {
        if (a?.lead_id && !cmap[a.lead_id]) cmap[a.lead_id] = a.created_at;
      });
      setContacted(cmap);
    } catch (e) {
      console.warn("[HotLeadsInbox] aux load erro", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadAux(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [leads.length]);

  const ranked: (HotLeadResult & { lead: Lead })[] = useMemo(() => {
    const results = leads.map((lead) => {
      const signals: LeadSignals = {
        lead,
        predictionProbability: predictions[lead.id] ?? null,
        lastContactAt: contacted[lead.id] ?? null,
      };
      const r = calcHotLead(signals);
      return { ...r, lead };
    });
    return results
      .filter((r) => r.score >= 15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);
  }, [leads, predictions, contacted]);

  const allReasons = useMemo(() => {
    const s = new Set<string>();
    ranked.forEach((r) => r.reasons.forEach((rs) => s.add(rs.key)));
    return Array.from(s);
  }, [ranked]);

  const filtered = useMemo(() => {
    return ranked.filter((r) => {
      if (hideContacted && r.contacted) return false;
      if (projectFilter !== "all" && r.lead.project_id !== projectFilter) return false;
      if (reasonFilter !== "all" && !r.reasons.some((rs) => rs.key === reasonFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.lead.nome || ""} ${r.lead.email || ""} ${r.lead.phone || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ranked, hideContacted, projectFilter, reasonFilter, search]);

  const reasonLabel = (key: string): string => {
    const sample = ranked.flatMap((r) => r.reasons).find((rs) => rs.key === key);
    return sample?.label || key;
  };

  const waLink = (phone: string) => {
    const d = phone.replace(/\D/g, "");
    return `https://wa.me/${d.startsWith("55") ? d : "55" + d}`;
  };

  const copyValue = (v: string, label: string) => {
    navigator.clipboard.writeText(v);
    toast.success(`${label} copiado`);
  };

  const markContacted = async (leadId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error("Não autenticado");
      const { error } = await supabase.from("imphq_activity_log").insert({
        lead_id: leadId,
        user_id: userId,
        action: "marcado_contatado",
        details: { source: "hot_inbox" },
      });
      if (error) throw error;
      setContacted((prev) => ({ ...prev, [leadId]: new Date().toISOString() }));
      toast.success("Marcado como contatado");
    } catch (e) {
      toast.error("Erro ao marcar contatado");
      console.error(e);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-amber-500" />
          <h2 className="font-display text-lg font-bold text-foreground">Inbox de Leads Quentes</h2>
          <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">{filtered.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={loadAux} disabled={refreshing} className="ml-auto h-7 text-xs">
          <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap bg-secondary/30 rounded-lg p-2 border border-border/50">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, email, telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs bg-background"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-8 text-xs w-[160px] bg-background"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={reasonFilter} onValueChange={setReasonFilter}>
          <SelectTrigger className="h-8 text-xs w-[180px] bg-background"><SelectValue placeholder="Razão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as razões</SelectItem>
            {allReasons.map((k) => <SelectItem key={k} value={k}>{reasonLabel(k)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Switch id="hide-contacted" checked={hideContacted} onCheckedChange={setHideContacted} />
          <Label htmlFor="hide-contacted" className="text-[11px] cursor-pointer">Esconder contatados (24h)</Label>
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card className="bg-card/50">
          <CardContent className="py-8 text-center space-y-2">
            <Flame className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">Nenhum lead quente no momento.</p>
            <p className="text-[11px] text-muted-foreground/70">Sinais de calor aparecem aqui em tempo real.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(({ lead, score, reasons, contacted: wasContacted }) => {
            const heat = heatColor(score);
            const project = projects.find((p) => p.id === lead.project_id);
            const lastInteractionAt = lead.updated_at;

            return (
              <Card key={lead.id} className={`bg-card border ${heat.border} hover:bg-card/80 transition-colors`}>
                <CardContent className="p-3 flex items-start gap-3">
                  {/* Score */}
                  <div className={`flex flex-col items-center justify-center rounded-lg ${heat.bg} ${heat.border} border px-2 py-1.5 min-w-[52px]`}>
                    <span className={`text-lg font-mono font-bold ${heat.text}`}>{score}</span>
                    <span className={`text-[8px] uppercase tracking-wider ${heat.text} font-bold`}>{heat.label}</span>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{lead.nome || lead.email || "Sem nome"}</span>
                      {project && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{project.icon || "📁"} {project.name}</Badge>}
                      {wasContacted && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-500/40 text-emerald-400">contatado</Badge>}
                      {lastInteractionAt && (
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                          {formatDistanceToNow(new Date(lastInteractionAt), { addSuffix: true, locale: ptBR })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      {lead.email && (
                        <button onClick={() => copyValue(lead.email!, "Email")} className="flex items-center gap-1 hover:text-foreground truncate max-w-[200px]" title={lead.email}>
                          <Copy className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </button>
                      )}
                      {lead.phone && (
                        <button onClick={() => copyValue(lead.phone!, "Telefone")} className="flex items-center gap-1 hover:text-foreground">
                          <Copy className="h-2.5 w-2.5" />
                          <span className="font-mono">{lead.phone}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {reasons.map((r) => (
                        <Badge
                          key={r.key}
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 h-4 ${
                            r.intensity === "critical" ? "border-destructive/40 text-destructive bg-destructive/5" :
                            r.intensity === "high" ? "border-amber-500/40 text-amber-400 bg-amber-500/5" :
                            "border-border text-muted-foreground"
                          }`}
                        >
                          {r.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-1 shrink-0">
                    {lead.phone && (
                      <Button asChild size="sm" variant="outline" className="h-7 text-[10px] border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10">
                        <a href={waLink(lead.phone)} target="_blank" rel="noreferrer">
                          <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => onOpenLead(lead.id)}>
                      <Eye className="h-3 w-3 mr-1" /> Abrir
                    </Button>
                    {!wasContacted && (
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => markContacted(lead.id)}>
                        ✓ Contatado
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
