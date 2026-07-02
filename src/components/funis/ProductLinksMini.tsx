import { ExternalLink, Copy, Pencil } from "lucide-react";
import { normalizeProductLinks, LINK_TIPOS } from "@/lib/produto-links";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  produto: any;
  onEdit?: () => void;
  maxItems?: number;
}

const TIPO_LABEL: Record<string, string> = Object.fromEntries(LINK_TIPOS.map(t => [t.value, t.label]));

const PRIO_COLOR: Record<string, string> = {
  preferido: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  alternativo: "bg-muted/30 text-muted-foreground border-muted-foreground/30",
  evitar: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

export function ProductLinksMini({ produto, onEdit, maxItems = 6 }: Props) {
  const links = normalizeProductLinks(produto).filter(l => l.ativo !== false);
  if (!links.length && !onEdit) return null;

  const shown = links.slice(0, maxItems);
  const rest = Math.max(0, links.length - shown.length);

  return (
    <div className="space-y-1" data-node onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Links</span>
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="text-[9px] text-muted-foreground hover:text-primary flex items-center gap-1"
            title="Editar links no briefing"
          >
            <Pencil className="h-2.5 w-2.5" /> editar
          </button>
        )}
      </div>
      {shown.length === 0 && (
        <p className="text-[9px] text-muted-foreground/50 italic">Nenhum link. Clique em editar.</p>
      )}
      {shown.map((l, i) => (
        <div key={i} className="group flex items-center gap-1.5 text-[10px] rounded border border-border/40 bg-background/40 px-1.5 py-1">
          <span className={cn("shrink-0 px-1 rounded border text-[8px] font-semibold uppercase", PRIO_COLOR[l.prioridade_ia || "alternativo"])}>
            {TIPO_LABEL[l.tipo || "outro"] || l.tipo}
          </span>
          <span className="flex-1 truncate text-foreground/80" title={l.label || l.url}>
            {l.label || l.url.replace(/^https?:\/\//, "")}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(l.url); toast.success("Link copiado"); }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
            title="Copiar"
          >
            <Copy className="h-2.5 w-2.5" />
          </button>
          <a
            href={l.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-cyan-400 hover:text-cyan-300"
            title="Abrir"
          >
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      ))}
      {rest > 0 && (
        <p className="text-[9px] text-muted-foreground/70 text-center">+{rest} link{rest > 1 ? "s" : ""}</p>
      )}
    </div>
  );
}
