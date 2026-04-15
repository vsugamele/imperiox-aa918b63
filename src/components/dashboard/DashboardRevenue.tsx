import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Zap, MessageCircle, Crown, Lock } from "lucide-react";
import { subDays } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Props {
  period: string;
  projectFilter: string;
  productFilter?: string;
  isAdmin: boolean;
}

export default function DashboardRevenue({ period, projectFilter, productFilter, isAdmin }: Props) {
  const [totalReceita, setTotalReceita] = useState(0);
  const [receitaBreakdown, setReceitaBreakdown] = useState<{ vendas: number; manual: number }>({ vendas: 0, manual: 0 });
  const [autoExecCount, setAutoExecCount] = useState(0);
  const [waStats, setWaStats] = useState<{ sent: number; received: number; sessions: number }>({ sent: 0, received: 0, sessions: 0 });
  const [hotLeads, setHotLeads] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [finResumo, autoCount, waMsgRes, hubSessionsRes, hotLeadsRes] = await Promise.all([
        supabase.from("vw_financas_resumo").select("*").gt("receita_total", 0).order("lucro_liquido", { ascending: false }).limit(5),
        supabase.from("imphq_activity_log").select("id", { count: "exact", head: true }).eq("action", "automacao_executada"),
        supabase.from("imphq_wa_messages").select("direction", { count: "exact" }).gte("created_at", subDays(new Date(), 30).toISOString()),
        supabase.from("wa_hub_iso_sessions").select("id, status"),
        supabase.from("imphq_leads").select("id, nome, score, phone, email, project_id, criado_em").neq("status", "cliente").order("score", { ascending: false }).limit(5),
      ]);

      // Revenue
      const totalRevFromView = (finResumo.data || []).reduce((s: number, f: any) => s + (Number(f.receita_total) || 0), 0);
      const totalVendasFromView = (finResumo.data || []).reduce((s: number, f: any) => s + (Number(f.total_vendas) || 0), 0);
      const totalManualFromView = (finResumo.data || []).reduce((s: number, f: any) => s + (Number(f.total_receita_manual) || 0), 0);
      setTotalReceita(totalRevFromView);
      setReceitaBreakdown({ vendas: totalVendasFromView, manual: totalManualFromView });

      setAutoExecCount(autoCount.count || 0);

      // WhatsApp stats
      const waMessages = waMsgRes.data || [];
      const waSent = waMessages.filter((m: any) => m.direction === "outgoing").length;
      const waReceived = waMessages.filter((m: any) => m.direction === "incoming").length;
      const waConnected = (hubSessionsRes.data || []).filter((s: any) => s.status === "connected").length;
      setWaStats({ sent: waSent, received: waReceived, sessions: waConnected });

      // Hot Leads
      setHotLeads((hotLeadsRes.data || []).filter((l: any) => (l.score || 0) > 0));
    }
    load();
  }, [period, projectFilter]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-primary/5 border-border">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400"><DollarSign className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Receita Total</p>
              <p className={`text-2xl font-mono font-bold text-emerald-400 ${!isAdmin ? "blur-md select-none" : ""}`}>
                R$ {totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              {isAdmin && (receitaBreakdown.vendas > 0 || receitaBreakdown.manual > 0) && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Vendas (webhook): R$ {receitaBreakdown.vendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  {receitaBreakdown.manual > 0 && ` + Manual: R$ ${receitaBreakdown.manual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                </p>
              )}
            </div>
            {!isAdmin && <div className="ml-auto flex items-center gap-1 text-muted-foreground"><Lock className="h-4 w-4" /><span className="text-[10px]">Admin only</span></div>}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-500/10 to-primary/5 border-border">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-3 rounded-xl bg-cyan-500/15 text-cyan-400"><Zap className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Automações Executadas</p>
              <p className="text-2xl font-mono font-bold text-cyan-400">{autoExecCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-border">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400"><MessageCircle className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">WhatsApp</p>
              <p className="text-lg font-mono font-bold text-emerald-400">{waStats.sent} enviadas · {waStats.received} recebidas</p>
              <p className="text-[10px] text-muted-foreground">{waStats.sessions} sessão(ões) ativa(s)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hot Leads */}
      {hotLeads.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" /> Leads Quentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hotLeads.map((l: any) => (
              <div key={l.id} onClick={() => navigate("/leads")} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{(l.nome || "?")[0].toUpperCase()}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{l.nome || l.email || l.phone}</p>
                    <p className="text-[10px] text-muted-foreground">{l.email || l.phone || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px] font-mono">{l.score || 0} pts</Badge>
                  {l.criado_em && <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(l.criado_em), { locale: ptBR, addSuffix: true })}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
