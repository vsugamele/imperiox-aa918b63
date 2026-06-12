import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Flame, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HotLead {
  id: string;
  nome: string;
  phone: string;
  email: string;
  evento: string;
  produto: string;
  valor: number;
  minutos_ago: number;
  updated_at: string;
}

interface Props {
  projectFilter?: string;
}

export default function HotLeadAlerts({ projectFilter }: Props) {
  const [leads, setLeads] = useState<HotLead[]>([]);

  useEffect(() => {
    async function load() {
      // Leads that generated PIX/boleto in last 2 hours but didn't buy
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();

      let query = supabase
        .from("imphq_leads")
        .select("id, nome, phone, email, data, updated_at, total_gasto")
        .neq("status", "cliente")
        .gte("updated_at", twoHoursAgo)
        .order("updated_at", { ascending: false })
        .limit(20);
      
      if (projectFilter && projectFilter !== "all") {
        query = query.eq("project_id", projectFilter);
      }

      const { data } = await query;

      const hot: HotLead[] = [];
      (data || []).forEach((lead: any) => {
        const d = lead.data || {};
        const evento = d.ultimo_evento || "";
        const hotEvents = [
          "aguardando_pagamento", "pix_gerado", "pix_created",
          "boleto_gerado", "purchase_billet_printed",
          "pagamento_recusado", "refused", "pagamento_pendente",
        ];
        if (!hotEvents.includes(evento)) return;
        if (parseFloat(lead.total_gasto || 0) > 0) return;

        const minutesAgo = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 60000);
        hot.push({
          id: lead.id,
          nome: lead.nome || "Sem nome",
          phone: lead.phone || "",
          email: lead.email || "",
          evento,
          produto: d.ultimo_produto || "",
          valor: d.ultimo_valor || 0,
          minutos_ago: minutesAgo,
          updated_at: lead.updated_at,
        });
      });

      setLeads(hot);
    }
    load();
    // Realtime: atualiza imediatamente quando um lead muda de status
    // Onda 7: filtra por project_id no servidor quando possível para reduzir broadcast
    const rtFilter: any = { event: "UPDATE", schema: "public", table: "imphq_leads" };
    if (projectFilter && projectFilter !== "all" && projectFilter !== "none") {
      rtFilter.filter = `project_id=eq.${projectFilter}`;
    }
    const ch = supabase
      .channel(`hot_leads_rt_${projectFilter || "all"}`)
      .on("postgres_changes", rtFilter, load)
      .subscribe();
    const interval = setInterval(() => { if (document.visibilityState === "visible") load(); }, 5 * 60_000); // safety fallback a cada 5min, pausa em tab oculta
    return () => { clearInterval(interval); supabase.removeChannel(ch); };
  }, [projectFilter]);

  if (leads.length === 0) return null;

  const eventLabel = (ev: string) => {
    const map: Record<string, { label: string; color: string }> = {
      aguardando_pagamento: { label: "PIX Gerado", color: "bg-amber-500/20 text-amber-400" },
      pix_gerado: { label: "PIX Gerado", color: "bg-amber-500/20 text-amber-400" },
      pix_created: { label: "PIX Gerado", color: "bg-amber-500/20 text-amber-400" },
      boleto_gerado: { label: "Boleto", color: "bg-blue-500/20 text-blue-400" },
      purchase_billet_printed: { label: "Boleto", color: "bg-blue-500/20 text-blue-400" },
      pagamento_recusado: { label: "Cartão Recusado", color: "bg-destructive/20 text-destructive" },
      refused: { label: "Cartão Recusado", color: "bg-destructive/20 text-destructive" },
      pagamento_pendente: { label: "Pendente", color: "bg-amber-500/20 text-amber-400" },
    };
    return map[ev] || { label: ev, color: "bg-muted text-muted-foreground" };
  };

  return (
    <Card className="bg-card border-border border-l-4 border-l-amber-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4 text-amber-500" />
          Leads Quentes — Ação Imediata
          <Badge className="bg-amber-500/20 text-amber-400 text-[9px] ml-auto">{leads.length}</Badge>
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">PIX/Boleto gerado nas últimas 2h sem conversão</p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-2">
            {leads.map((lead) => {
              const ev = eventLabel(lead.evento);
              const urgency = lead.minutos_ago < 15 ? "🔴" : lead.minutos_ago < 30 ? "🟡" : "🟠";
              return (
                <div key={lead.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-sm">{urgency}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{lead.nome}</span>
                      <Badge className={`text-[8px] ${ev.color}`}>{ev.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="truncate">{lead.produto}</span>
                      {lead.valor > 0 && <span className="font-mono">R${lead.valor}</span>}
                      <span className="flex items-center gap-0.5 ml-auto shrink-0">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  {lead.phone && (
                    <a
                      href={`https://wa.me/${(() => { const d = lead.phone!.replace(/\D/g, ""); return d.startsWith("55") ? d : "55" + d; })()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 shrink-0"
                      title="Abrir WhatsApp"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
