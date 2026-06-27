import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLeadTimeline } from "@/hooks/useLeadTimeline";
import { Activity, MousePointerClick, MessageCircle, ShoppingCart, Mail, Zap, Eye, Tag, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  lead: any;
  automations?: any[];
}

const TYPE_META: Record<string, { icon: any; color: string }> = {
  click: { icon: MousePointerClick, color: "text-sky-400 bg-sky-500/15 border-sky-500/40" },
  pageview: { icon: Eye, color: "text-sky-400 bg-sky-500/15 border-sky-500/40" },
  whatsapp: { icon: MessageCircle, color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/40" },
  message: { icon: MessageCircle, color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/40" },
  venda: { icon: ShoppingCart, color: "text-amber-400 bg-amber-500/15 border-amber-500/40" },
  sale: { icon: ShoppingCart, color: "text-amber-400 bg-amber-500/15 border-amber-500/40" },
  email: { icon: Mail, color: "text-pink-400 bg-pink-500/15 border-pink-500/40" },
  automation: { icon: Zap, color: "text-violet-400 bg-violet-500/15 border-violet-500/40" },
  tag: { icon: Tag, color: "text-foreground/80 bg-secondary/40 border-border/40" },
  recovery: { icon: Activity, color: "text-rose-400 bg-rose-500/15 border-rose-500/40" },
};

export default function LeadJourneyDrawer({ open, onClose, lead, automations = [] }: Props) {
  const { timeline, loading } = useLeadTimeline(open ? lead : null, automations);

  const sorted = useMemo(
    () => [...timeline].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [timeline],
  );

  const stats = useMemo(() => {
    if (!sorted.length) return null;
    const first = new Date(sorted[0].timestamp).getTime();
    const last = new Date(sorted[sorted.length - 1].timestamp).getTime();
    const vendas = sorted.filter((e) => e.type === "venda" || e.type === "sale").length;
    return { toques: sorted.length, dias: Math.max(1, Math.round((last - first) / 86400000)), vendas };
  }, [sorted]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl bg-secondary/40 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <Activity className="h-4 w-4 text-pink-400" />
            Jornada — {lead?.data?.nome || lead?.nome || lead?.email || "Lead"}
          </SheetTitle>
        </SheetHeader>

        {stats && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-lg border border-border/40 bg-secondary/30 p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Toques</p>
              <p className="text-lg font-semibold">{stats.toques}</p>
            </div>
            <div className="rounded-lg border border-border/40 bg-secondary/30 p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Dias</p>
              <p className="text-lg font-semibold">{stats.dias}</p>
            </div>
            <div className="rounded-lg border border-border/40 bg-secondary/30 p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Vendas</p>
              <p className="text-lg font-semibold text-amber-300">{stats.vendas}</p>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {loading && <p className="text-xs text-muted-foreground">Carregando...</p>}
          {!loading && !sorted.length && (
            <p className="text-sm text-muted-foreground leading-7">Sem eventos registrados para este lead ainda.</p>
          )}
          {sorted.map((e, i) => {
            const meta = TYPE_META[e.type] || TYPE_META.tag;
            const Icon = meta.icon;
            const prev = i > 0 ? sorted[i - 1] : null;
            const gapMs = prev ? new Date(e.timestamp).getTime() - new Date(prev.timestamp).getTime() : 0;
            const bigGap = gapMs > 24 * 60 * 60 * 1000;
            return (
              <div key={e.id} className="relative pl-10">
                <div className={cn("absolute left-0 top-0 h-7 w-7 rounded-full border flex items-center justify-center", meta.color)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                {i < sorted.length - 1 && <div className="absolute left-[13px] top-7 bottom-[-12px] w-px bg-border/40" />}
                <div className="rounded-lg border border-border/40 bg-secondary/30 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground leading-tight">{e.title}</p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNowStrict(new Date(e.timestamp), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  {e.subtitle && <p className="text-xs text-muted-foreground leading-6">{e.subtitle}</p>}
                  {bigGap && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-300">
                      <AlertTriangle className="h-3 w-3" />
                      Gap de {Math.round(gapMs / 86400000)}d sem toque
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
