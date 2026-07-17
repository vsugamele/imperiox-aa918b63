import { useState, forwardRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Pencil, Trash2, Star, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const BLOCKS: { key: string; label: string }[] = [
  { key: "gancho", label: "GANCHO — 0–3s" },
  { key: "participacao_ativa", label: "PARTICIPAÇÃO ATIVA — 3–8s" },
  { key: "narrativa", label: "BODY — 8–45s" },
  { key: "reframe", label: "REFRAME — 45–52s" },
];

interface Props {
  swipe: any;
  label: string;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChanged?: (patch: any) => void;
}

export const SwipeRoteiroCard = forwardRef<HTMLDivElement, Props>(
  ({ swipe: s, label, selected, onToggleSelect, onEdit, onDelete, onChanged }, ref) => {
    const [ctaTab, setCtaTab] = useState<"engajamento" | "venda">("engajamento");
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const copy = async (text: string, key: string) => {
      try {
        await navigator.clipboard.writeText(text || "");
        setCopiedKey(key);
        toast.success("Copiado");
        setTimeout(() => setCopiedKey(null), 1500);
      } catch {
        toast.error("Falha ao copiar");
      }
    };

    const blocks = s.blocks || {};
    const title = String(s.title || "").replace(/^ROTEIRO\s+[A-Z0-9]+\s*[—-]\s*/i, "");

    return (
      <Card
        ref={ref}
        id={`swipe-${s.id}`}
        className={cn(
          "scroll-mt-24 bg-secondary/15 border-border/50 p-5 space-y-4 transition",
          selected && "ring-1 ring-[hsl(var(--gold))]/50",
        )}
      >
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="mt-1.5 accent-[hsl(var(--gold))]"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--gold))]/80">
                  · Roteiro {label}
                </span>
              </div>
              <h3 className="font-display text-xl italic leading-tight">{title}</h3>
              {s.mecanismo && (
                <p className="text-[11px] text-muted-foreground mt-1 italic">{s.mecanismo}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {s.nicho && (
                  <Badge variant="outline" className="text-[9px] border-border/60">{s.nicho}</Badge>
                )}
                {(s.tags || []).slice(0, 4).map((t: string) => (
                  <Badge key={t} variant="outline" className="text-[9px] border-border/60">{t}</Badge>
                ))}
                {s.criador && (
                  <Badge variant="secondary" className="text-[9px]">{s.criador}</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-[hsl(var(--gold))] text-background text-xs font-bold">
              {label}
            </span>
          </div>
        </div>

        {/* BLOCOS */}
        <div className="space-y-3 border-t border-border/30 pt-4">
          {BLOCKS.map((b) => {
            const text = blocks[b.key];
            if (!text) return null;
            return (
              <div key={b.key} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="inline-block px-2 py-0.5 rounded bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))] text-[10px] font-bold uppercase tracking-[0.18em]">
                    {b.label}
                  </span>
                  <button
                    onClick={() => copy(text, b.key)}
                    className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-foreground p-1"
                    title="Copiar bloco"
                  >
                    {copiedKey === b.key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <p className="text-sm leading-7 text-foreground/85 whitespace-pre-wrap">{text}</p>
              </div>
            );
          })}
        </div>

        {/* CTA TABS */}
        {(blocks.cta_engajamento || blocks.cta_venda) && (
          <div className="border-t border-border/30 pt-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCtaTab("engajamento")}
                className={cn(
                  "text-[11px] uppercase tracking-[0.22em] font-semibold py-2 rounded border transition",
                  ctaTab === "engajamento"
                    ? "bg-[hsl(var(--gold))]/15 border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))]"
                    : "bg-secondary/30 border-border/40 text-muted-foreground hover:text-foreground",
                )}
              >
                💬 CTA Engajamento
              </button>
              <button
                onClick={() => setCtaTab("venda")}
                className={cn(
                  "text-[11px] uppercase tracking-[0.22em] font-semibold py-2 rounded border transition",
                  ctaTab === "venda"
                    ? "bg-[hsl(var(--gold))]/15 border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))]"
                    : "bg-secondary/30 border-border/40 text-muted-foreground hover:text-foreground",
                )}
              >
                🔗 CTA Triplo para Venda
              </button>
            </div>
            <div className="bg-background/40 border border-border/30 rounded p-3 relative group">
              <button
                onClick={() =>
                  copy(
                    ctaTab === "engajamento" ? blocks.cta_engajamento : blocks.cta_venda,
                    `cta-${ctaTab}`,
                  )
                }
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-foreground p-1"
              >
                {copiedKey === `cta-${ctaTab}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
              <p className="text-sm leading-7 text-foreground/85 whitespace-pre-wrap pr-8">
                {(ctaTab === "engajamento" ? blocks.cta_engajamento : blocks.cta_venda) || (
                  <span className="italic text-muted-foreground">— sem CTA cadastrada —</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* TOOLBAR */}
        <div className="flex items-center gap-2 pt-3 border-t border-border/30">
          <Button size="sm" variant="outline" className="h-7 text-[10px] uppercase tracking-[0.22em]" onClick={onEdit}>
            <Pencil className="h-3 w-3 mr-1" /> Editar / IA
          </Button>
          {s.reverse_engineering && Object.keys(s.reverse_engineering).length > 0 && (
            <Badge className="text-[9px] bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/40">
              🔬 Eng. Reversa
            </Badge>
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </Card>
    );
  },
);
SwipeRoteiroCard.displayName = "SwipeRoteiroCard";
