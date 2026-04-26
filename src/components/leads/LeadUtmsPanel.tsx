import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ShoppingBag, MousePointerClick, Sparkles, CornerDownRight } from "lucide-react";
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

/** Varre vários formatos comuns de payload e devolve um UtmSet normalizado. */
function extractUtms(source: any): UtmSet {
  if (!source || typeof source !== "object") return {};
  const candidates: any[] = [
    source.utms,
    source.tracking,
    source.checkout,
    source.checkout?.utms,
    source.tracking?.utms,
    source, // flat na raiz
  ].filter(Boolean);

  const out: UtmSet = {};
  for (const c of candidates) {
    for (const k of UTM_KEYS) {
      if (!out[k] && c[k]) out[k] = String(c[k]);
    }
  }
  return out;
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

function UtmBlock({ title, icon, utms, accent, when, inheritedBadge }: { title: string; icon: React.ReactNode; utms: UtmSet; accent: string; when?: string; inheritedBadge?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn("flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider", accent)}>
          {icon}
          {title}
        </span>
        {when && <span className="text-[9px] text-muted-foreground">· {when}</span>}
        {inheritedBadge && (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-500/40 text-amber-400 gap-0.5">
            <CornerDownRight className="h-2.5 w-2.5" />
            herdado do lead
          </Badge>
        )}
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

  // Captura: do payload do lead (vários formatos)
  const captureUtms: UtmSet = extractUtms(lead.data);

  // Última venda: tenta na própria venda; se vazio, herda do lead
  const lastSale = lead._vendas?.[0];
  const saleOwnUtms: UtmSet = extractUtms(lastSale?.data);
  const saleInherited = !hasAny(saleOwnUtms) && hasAny(captureUtms);
  const saleUtms: UtmSet = saleInherited ? captureUtms : saleOwnUtms;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!lead.id) return;
      const { data } = await (supabase
        .from("imphq_clicks")
        .select("utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_at")
        .eq("visitor_id", lead.id) as any)
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
  }, [lead.id]);

  const showCapture = hasAny(captureUtms);
  const showSale = hasAny(saleUtms) && !!lastSale;
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
        {showSale && showCapture && !saleInherited && saleUtms.utm_campaign && captureUtms.utm_campaign && saleUtms.utm_campaign !== captureUtms.utm_campaign && (
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
          when={lastSale?.created_at ? new Date(lastSale.created_at).toLocaleDateString("pt-BR") : "convertida"}
          inheritedBadge={saleInherited}
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
