import { useMemo, useState } from "react";
import { AlertTriangle, Plus, X, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface GapRule {
  id: string;
  title: string;
  desc: string;
  impact: "alto" | "medio" | "baixo";
  suggest: { kind: string; label: string };
}

export interface NodeLite {
  id?: string;
  kind: string;
  label: string;
  description?: string | null;
}

export interface EdgeLite { source: string; target: string; }


const impactStyle: Record<string, string> = {
  alto: "bg-red-500/10 text-red-400 border-red-500/30",
  medio: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  baixo: "bg-muted text-muted-foreground border-border/40",
};

export function analyzeGaps(nodes: NodeLite[], edges: EdgeLite[] = []): GapRule[] {
  const has = (k: string) => nodes.some(n => n.kind === k);
  const gaps: GapRule[] = [];

  if (!has("captura")) gaps.push({
    id: "no-captura", title: "Sem Página de Captura",
    desc: "Você está queimando tráfego sem coletar lead. Sem página de captura, todo anúncio é desperdício.",
    impact: "alto", suggest: { kind: "captura", label: "Página de Captura" },
  });
  if (!has("vsl") && !has("pagina_vendas")) gaps.push({
    id: "no-vsl", title: "Sem ativo de conversão principal",
    desc: "Nenhuma VSL ou página de vendas no mapa. Você não tem onde converter o lead em cliente.",
    impact: "alto", suggest: { kind: "vsl", label: "VSL Principal" },
  });
  if (!has("checkout")) gaps.push({
    id: "no-checkout", title: "Sem nó de Checkout",
    desc: "Sem checkout mapeado você não vê onde o dinheiro entra — nem consegue anexar orderbump.",
    impact: "alto", suggest: { kind: "checkout", label: "Checkout" },
  });
  if (has("checkout") && !has("orderbump")) gaps.push({
    id: "no-orderbump", title: "Checkout sem Orderbump",
    desc: "Ticket médio limitado. Orderbump é a forma mais barata de aumentar receita por cliente.",
    impact: "medio", suggest: { kind: "orderbump", label: "Orderbump" },
  });
  if (has("checkout") && !has("upsell")) gaps.push({
    id: "no-upsell", title: "Checkout sem Upsell",
    desc: "Você está deixando ticket na mesa. Cliente comprando é o momento mais quente para vender de novo.",
    impact: "alto", suggest: { kind: "upsell", label: "Upsell 1" },
  });
  if (has("upsell") && !has("downsell")) gaps.push({
    id: "no-downsell", title: "Upsell sem Downsell",
    desc: "Quem recusa o upsell some sem chance de recuperação. Downsell resgata parte da receita perdida.",
    impact: "medio", suggest: { kind: "downsell", label: "Downsell" },
  });
  if (!has("email")) gaps.push({
    id: "no-email", title: "Sem sequência de e-mail",
    desc: "Lead frio sem nurture. Sequência de e-mail é o que aquece quem não comprou de primeira.",
    impact: "medio", suggest: { kind: "email", label: "Sequência de Nurture" },
  });
  if (!has("whatsapp")) gaps.push({
    id: "no-wa", title: "Sem canal WhatsApp",
    desc: "Recuperação de carrinho e follow-up de lead quente rodam no WhatsApp. Sem chip, você perde 30-50% da conversão.",
    impact: "alto", suggest: { kind: "whatsapp", label: "WhatsApp de Vendas" },
  });
  if (!has("anuncio")) gaps.push({
    id: "no-ads", title: "Sem nó de tráfego pago",
    desc: "Nenhum anúncio mapeado. Difícil escalar sem previsibilidade de aquisição.",
    impact: "baixo", suggest: { kind: "anuncio", label: "Campanha de Anúncios" },
  });
  if (has("anuncio") && !has("captura")) gaps.push({
    id: "ads-no-capt", title: "Anúncio sem captura vinculada",
    desc: "Você tem anúncio rodando mas ninguém sendo capturado. Todo o investimento vai pro ralo.",
    impact: "alto", suggest: { kind: "captura", label: "Captura para o Anúncio" },
  });
  if (has("vsl") && !has("pagina_vendas") && !has("checkout")) gaps.push({
    id: "vsl-no-next", title: "VSL sem próximo passo",
    desc: "VSL sem página de vendas ou checkout depois. Quem assiste até o fim não tem para onde ir.",
    impact: "alto", suggest: { kind: "pagina_vendas", label: "Página pós-VSL" },
  });

  // Detecção de nós órfãos (sem nenhuma conexão)
  if (edges.length > 0 && nodes.some(n => n.id)) {
    const connected = new Set<string>();
    edges.forEach(e => { connected.add(e.source); connected.add(e.target); });
    const orphans = nodes.filter(n => n.id && !connected.has(n.id) && !["doc", "meta"].includes(n.kind));
    if (orphans.length > 0) gaps.push({
      id: "orphans", title: `${orphans.length} nó(s) órfão(s)`,
      desc: `Sem conexão: ${orphans.slice(0, 3).map(o => o.label).join(", ")}${orphans.length > 3 ? "…" : ""}. Nó isolado não gera fluxo.`,
      impact: "medio", suggest: { kind: "__orphan__", label: "Ver órfãos" },
    });
  }

  return gaps;
}

interface Props {
  nodes: NodeLite[];
  onCreateNode: (kind: string, label: string) => void;
}

export function StrategicGapsPanel({ nodes, onCreateNode }: Props) {
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const gaps = useMemo(() => analyzeGaps(nodes).filter(g => !dismissed.has(g.id)), [nodes, dismissed]);

  if (gaps.length === 0) {
    return (
      <div className="w-[300px] bg-card/90 backdrop-blur border border-emerald-500/30 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <p className="text-xs font-medium text-emerald-400">Ecossistema completo</p>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Nenhum gap estratégico detectado neste mapa.</p>
      </div>
    );
  }

  const criticos = gaps.filter(g => g.impact === "alto").length;

  return (
    <div className="w-[320px] bg-card/95 backdrop-blur border border-border/60 rounded-lg overflow-hidden shadow-xl">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-xs font-semibold truncate">Gaps estratégicos</span>
          <Badge variant="outline" className="h-4 px-1.5 text-[9px]">{gaps.length}</Badge>
          {criticos > 0 && (
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] bg-red-500/10 text-red-400 border-red-500/30">
              {criticos} crítico{criticos > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="max-h-[420px] overflow-y-auto border-t border-border/40">
          {gaps.map(g => (
            <div key={g.id} className="p-3 border-b border-border/30 last:border-b-0 hover:bg-secondary/20">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs font-medium leading-4">{g.title}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className={`text-[9px] h-4 px-1 ${impactStyle[g.impact]}`}>{g.impact}</Badge>
                  <button
                    onClick={() => setDismissed(s => new Set(s).add(g.id))}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                    title="Ignorar"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-4 mb-2">{g.desc}</p>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] gap-1 w-full"
                onClick={() => onCreateNode(g.suggest.kind, g.suggest.label)}
              >
                <Plus className="h-3 w-3" /> Criar {g.suggest.label}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
