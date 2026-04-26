import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Link2, ShoppingBag, MousePointerClick, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type UtmSet = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

interface Props {
  lead: { id: string; email?: string | null; data?: any; _vendas?: any[] };
}

const UTM_KEYS: (keyof UtmSet)[] = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const UTM_LABELS: Record<keyof UtmSet, string> = {
  utm_source: "Source",
  utm_medium: "Medium",
  utm_campaign: "Campaign",
  utm_content: "Content",
  utm_term: "Term",
};

function hasAny(u?: UtmSet | null) {
  return !!u && UTM_KEYS.some(k => u[k]);
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-5 w-5 p-0 text-muted-foreground hover:text-primary shrink-0"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success("Copiado");
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function UtmRow({ k, value }: { k: keyof UtmSet; value: string }) {
  // Meta-style pipe split: criativo|123|video → segmenta visualmente
  const parts = value.includes("|") ? value.split("|").map(s => s.trim()).filter(Boolean) : null;
  const isUrl = /^https?:\/\//.test(value);
  return (
    <div className="flex items-start gap-2 text-[11px] py-1 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground font-medium min-w-[68px] uppercase tracking-wider text-[10px] pt-0.5">
        {UTM_LABELS[k]}
      </span>
      <div className="flex-1 min-w-0">
        {parts ? (
          <div className="flex flex-wrap gap-1">
            {parts.map((p, i) => (
              <span key={i} className="font-mono text-foreground bg-secondary/60 px-1.5 py-0.5 rounded text-[10px] break-all">
                {p}
              </span>
            ))}
          </div>
        ) : isUrl ? (
          <a href={value} target="_blank" rel="noreferrer" className="font-mono text-primary hover:underline break-all text-[11px]">
            {value}
          </a>
        ) : (
          <span className="font-mono text-foreground break-all text-[11px]">{value}</span>
        )}
      </div>
      <CopyBtn value={value} />
    </div>
  );
}

function UtmBlock({ title, icon, utms, accent, when }: { title: string; icon: React.ReactNode; utms: UtmSet; accent: string; when?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className={cn("flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider", accent)}>
          {icon}
          {title}
        </span>
        {when && <span className="text-[9px] text-muted-foreground">· {when}</span>}
      </div>
      <div className="bg-secondary/30 rounded-lg px-2.5 py-1 border border-border/50">
        {UTM_KEYS.filter(k => utms[k]).map(k => (
          <UtmRow key={k} k={k} value={String(utms[k])} />
        ))}
      </div>
    </div>
  );
}

export default function LeadUtmsPanel({ lead }: Props) {
  const [firstClick, setFirstClick] = useState<UtmSet | null>(null);
  const [firstClickAt, setFirstClickAt] = useState<string | null>(null);

  const captureUtms: UtmSet = (lead.data?.utms || {}) as UtmSet;
  const lastSale = lead._vendas?.[0];
  const saleUtms: UtmSet = (lastSale?.data?.utms || {}) as UtmSet;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!lead.email) return;
      // Tenta via visitor_id primeiro (mais preciso), depois por src/utm_source = email (legacy import)
      const { data } = await supabase
        .from("imphq_clicks")
        .select("utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_at")
        .or(`visitor_id.eq.${lead.id}`)
        .order("created_at", { ascending: true })
        .limit(1);
      if (cancelled) return;
      if (data && data.length > 0) {
        const c = data[0] as any;
        setFirstClick({
          utm_source: c.utm_source, utm_medium: c.utm_medium, utm_campaign: c.utm_campaign,
          utm_content: c.utm_content, utm_term: c.utm_term,
        });
        setFirstClickAt(c.created_at);
      }
    })();
    return () => { cancelled = true; };
  }, [lead.id, lead.email]);

  const showCapture = hasAny(captureUtms);
  const showSale = hasAny(saleUtms);
  const showClick = hasAny(firstClick);

  if (!showCapture && !showSale && !showClick) {
    return (
      <div className="space-y-1 border-t border-border pt-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">🔗 Origem & UTMs</p>
        <p className="text-[11px] text-muted-foreground italic">Sem UTMs registradas para este lead.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">🔗 Origem & UTMs</p>
        {showSale && showCapture && saleUtms.utm_campaign !== captureUtms.utm_campaign && (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-500/40 text-amber-400">
            Captura ≠ Venda
          </Badge>
        )}
      </div>

      {showCapture && (
        <UtmBlock
          title="Captura"
          icon={<Sparkles className="h-2.5 w-2.5" />}
          utms={captureUtms}
          accent="text-primary"
          when="origem do lead"
        />
      )}

      {showSale && (
        <UtmBlock
          title="Última venda"
          icon={<ShoppingBag className="h-2.5 w-2.5" />}
          utms={saleUtms}
          accent="text-emerald-400"
          when={lastSale?.criado_em ? new Date(lastSale.criado_em).toLocaleDateString("pt-BR") : "convertida"}
        />
      )}

      {showClick && (
        <UtmBlock
          title="Primeiro click"
          icon={<MousePointerClick className="h-2.5 w-2.5" />}
          utms={firstClick!}
          accent="text-cyan-400"
          when={firstClickAt ? new Date(firstClickAt).toLocaleDateString("pt-BR") : undefined}
        />
      )}
    </div>
  );
}
