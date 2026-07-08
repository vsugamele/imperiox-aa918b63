import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Brain, MessageSquare, ArrowUpRight } from "lucide-react";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface Item {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  meta: string;
  href: string;
  weight: number;
}

export function DecisionQueue() {
  const { data: items = [] } = useQuery({
    queryKey: ["cockpit", "decision-queue"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Item[]> => {
      const now = Date.now();
      const out: Item[] = [];

      // 1) Imperius actions proposed
      try {
        const { data } = await supabase
          .from("imphq_ai_actions")
          .select("id, title, impact_brl, created_at, priority_score, projeto_id")
          .eq("status", "proposed")
          .order("priority_score", { ascending: false, nullsFirst: false })
          .limit(5);
        (data || []).forEach((a: any) => {
          out.push({
            key: `ai:${a.id}`,
            icon: Brain,
            tone: "text-gold",
            title: a.title || "Ação Imperius",
            meta: `${a.impact_brl ? brl(Number(a.impact_brl)) + " · " : ""}${timeAgo(a.created_at)}`,
            href: "/imperius",
            weight: 100 + Number(a.priority_score || 0),
          });
        });
      } catch {}

      // 2) Hot leads: PIX/Boleto pendente < 2h
      try {
        const since = new Date(now - 2 * 3600_000).toISOString();
        const { data } = await supabase
          .from("imphq_vendas")
          .select("id, lead_id, produto_nome, valor, created_at, status, nome, data")
          .in("status", ["pendente", "pending", "waiting_payment"])
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(6);
        (data || []).forEach((v: any) => {
          const forma = v?.data?.metodo_pagamento ?? v?.data?.payment_method ?? v?.data?.forma_pagamento ?? "PIX/Boleto";
          out.push({
            key: `hot:${v.id}`,
            icon: Flame,
            tone: "text-amber-400",
            title: `${v.nome || v.produto_nome || "Lead quente"} · ${brl(Number(v.valor || 0))}`,
            meta: `${String(forma).toUpperCase()} · ${timeAgo(v.created_at)}`,
            href: v.lead_id ? `/lead/${v.lead_id}` : "/leads",
            weight: 80,
          });
        });
      } catch {}

      // 3) Conversas paradas > 2h aguardando resposta nossa
      try {
        const cutoff = new Date(now - 2 * 3600_000).toISOString();
        const { data } = await (supabase as any)
          .from("imphq_wa_conversations")
          .select("id, phone, contact_name, last_message_at, last_message_direction")
          .eq("last_message_direction", "in")
          .lte("last_message_at", cutoff)
          .order("last_message_at", { ascending: false })
          .limit(4);
        (data || []).forEach((c: any) => {
          out.push({
            key: `stale:${c.id}`,
            icon: MessageSquare,
            tone: "text-rose-400/80",
            title: c.contact_name || c.phone || "Conversa parada",
            meta: `Sem resposta · ${timeAgo(c.last_message_at)}`,
            href: `/inbox?conv=${c.id}`,
            weight: 60,
          });
        });
      } catch {}

      return out.sort((a, b) => b.weight - a.weight).slice(0, 12);
    },
  });

  return (
    <aside className="border border-border/50 bg-secondary/10 h-full flex flex-col">
      <div className="border-b border-border/40 px-4 py-3 flex items-baseline justify-between">
        <div>
          <div className="text-[9px] tracking-[0.32em] uppercase text-gold/70 font-medium">
            Fila viva
          </div>
          <div
            className="text-lg italic text-foreground leading-tight"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            Decisões pendentes
          </div>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border/30">
        {items.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground italic">
            Nenhuma decisão pendente. Aproveite o silêncio.
          </div>
        ) : (
          items.map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.key}
                to={it.href}
                className="group flex items-start gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors"
              >
                <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${it.tone}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-foreground truncate group-hover:text-gold transition-colors">
                    {it.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5 tabular-nums">
                    {it.meta}
                  </div>
                </div>
                <ArrowUpRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-gold shrink-0 mt-1" />
              </Link>
            );
          })
        )}
      </div>
    </aside>
  );
}
