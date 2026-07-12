import { memo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, ExternalLink, UserCheck, Archive, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lead {
  id: string;
  nome: string | null;
  phone: string | null;
  email: string | null;
  score: number | null;
  status: string | null;
  created_at: string | null;
}

interface Props {
  lead: Lead;
  onOpen: (id: string) => void;
  onWhats: (phone: string) => void;
  onQualify?: (lead: Lead) => void;
  onTag?: (lead: Lead) => void;
  onArchive?: (lead: Lead) => void;
}

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 220;

function MobileLeadCardImpl({ lead, onOpen, onWhats, onQualify, onTag, onArchive }: Props) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    moved.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (Math.abs(dx) > 6) moved.current = true;
    const clamped = Math.max(-MAX_SWIPE, Math.min(0, dx));
    setOffset(clamped);
  };
  const onTouchEnd = () => {
    if (offset < -SWIPE_THRESHOLD) setOffset(-MAX_SWIPE);
    else setOffset(0);
    startX.current = null;
  };

  const scoreBadge = typeof lead.score === "number" && lead.score > 0 ? (
    <Badge className={cn(
      "text-xs font-bold px-2 py-0.5",
      lead.score >= 70 ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
      : lead.score >= 40 ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : "bg-slate-700/40 text-slate-300 border-slate-600/40"
    )}>{lead.score}</Badge>
  ) : null;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Actions reveal layer */}
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        {lead.phone && (
          <button
            onClick={() => { onWhats(lead.phone!); setOffset(0); }}
            className="w-[70px] flex flex-col items-center justify-center gap-0.5 bg-emerald-600/90 text-white text-[10px] font-semibold"
          >
            <ExternalLink className="h-4 w-4" /> WhatsApp
          </button>
        )}
        <button
          onClick={() => { onQualify?.(lead); setOffset(0); }}
          className="w-[70px] flex flex-col items-center justify-center gap-0.5 bg-amber-600/90 text-white text-[10px] font-semibold"
        >
          <UserCheck className="h-4 w-4" /> Qualificar
        </button>
        <button
          onClick={() => { onArchive?.(lead); setOffset(0); }}
          className="w-[70px] flex flex-col items-center justify-center gap-0.5 bg-slate-700 text-white text-[10px] font-semibold"
        >
          <Archive className="h-4 w-4" /> Arquivar
        </button>
      </div>

      <Card
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (!moved.current && offset === 0) onOpen(lead.id); else setOffset(0); }}
        style={{ transform: `translateX(${offset}px)`, transition: startX.current === null ? "transform 200ms" : "none" }}
        className="bg-slate-900 border-border/40 shadow-md cursor-pointer relative"
      >
        <CardContent className="p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-base font-bold text-white truncate">{lead.nome || "Sem nome"}</h4>
              <p className="text-sm text-muted-foreground font-mono truncate">{lead.phone || lead.email || "—"}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {scoreBadge}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="truncate max-w-[60%]">{lead.status || "Lead"}</span>
            {lead.created_at && (
              <span className="shrink-0 text-xs">
                {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            )}
          </div>
          {lead.phone && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); onWhats(lead.phone!); }}
              className="w-full text-sm h-10 gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              <ExternalLink className="h-4 w-4" /> WhatsApp
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground/60 text-center">← Arraste para ações rápidas</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Memo: card only re-renders when the lead object itself changes.
export const MobileLeadCard = memo(MobileLeadCardImpl, (a, b) =>
  a.lead === b.lead &&
  a.onOpen === b.onOpen &&
  a.onWhats === b.onWhats &&
  a.onArchive === b.onArchive
);
