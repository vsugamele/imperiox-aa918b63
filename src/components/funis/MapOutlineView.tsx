import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronRight, ExternalLink, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildOutline, filterOutline, type OutlineEdgeInput, type OutlineItem, type OutlineNodeInput } from "@/lib/map-outline";

export interface MapOutlineViewProps {
  title: string;
  nodes: OutlineNodeInput[];
  edges: OutlineEdgeInput[];
  onOpen: (id: string) => void;
  onSwitchToCanvas?: () => void;
}

/** Mapa de conhecimento como lista recolhível por seção (MAP3.1): ler é mais fácil que navegar 279 cartões no canvas. */
export function MapOutlineView({ title, nodes, edges, onOpen, onSwitchToCanvas }: MapOutlineViewProps) {
  const tree = useMemo(() => buildOutline(nodes, edges), [nodes, edges]);
  const [query, setQuery] = useState("");
  // Com uma raiz principal (o livro), ela já abre mostrando as seções; anotações soltas não contam.
  const [open, setOpen] = useState<Set<string>>(() => {
    const comFilhos = tree.filter((t) => t.children.length > 0);
    return new Set(comFilhos.length === 1 ? [comFilhos[0].id] : []);
  });
  const shown = useMemo(() => filterOutline(tree, query), [tree, query]);
  const searching = query.trim().length > 0;
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const all = (items: OutlineItem[]): string[] => items.flatMap((i) => (i.children.length ? [i.id, ...all(i.children)] : []));

  return (
    <div className="h-full overflow-y-auto bg-background p-4 md:p-6" aria-label="Mapa em lista">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><BookOpen className="h-3.5 w-3.5" /> Mapa de conhecimento</div>
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">{nodes.length} cartões organizados por seção. Clique para abrir; "Ver no mapa" leva ao cartão no canvas.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(new Set(all(tree)))}>Abrir tudo</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(new Set())}>Fechar tudo</Button>
            {onSwitchToCanvas && <Button size="sm" variant="outline" onClick={onSwitchToCanvas}>Ver no Mapa 2D</Button>}
          </div>
        </header>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar no mapa" className="pl-8" aria-label="Buscar no mapa" />
        </div>
        <ul className="space-y-1.5" role="tree" aria-label={title}>
          {shown.map((item, i) => <Row key={item.id} item={item} depth={0} index={i} open={open} forceOpen={searching} onToggle={toggle} onOpen={onOpen} />)}
        </ul>
        {!shown.length && <p className="py-8 text-center text-sm text-muted-foreground">Nada encontrado.</p>}
      </div>
    </div>
  );
}

function Row({ item, depth, index, open, forceOpen, onToggle, onOpen }: { item: OutlineItem; depth: number; index: number; open: Set<string>; forceOpen: boolean; onToggle: (id: string) => void; onOpen: (id: string) => void }) {
  const expanded = forceOpen || open.has(item.id);
  const hasKids = item.children.length > 0;
  return (
    <li role="treeitem" aria-expanded={hasKids ? expanded : undefined} aria-label={item.label}>
      <div className={cn("group rounded-md border bg-card", depth === 0 ? "border-primary/30" : "border-border", expanded && hasKids && "border-primary/40")}>
        <button type="button" onClick={() => hasKids && onToggle(item.id)} className="flex w-full items-start gap-2 p-2.5 text-left">
          <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90", !hasKids && "invisible")} />
          {item.image_url && <img src={item.image_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded object-cover" />}
          <span className="min-w-0 flex-1">
            <span className={cn("block text-foreground", depth === 0 ? "text-base font-semibold" : depth === 1 ? "text-sm font-medium" : "text-sm")}>
              {depth > 0 && <span className="mr-1 font-mono text-[11px] text-muted-foreground">{index + 1}.</span>}{item.label}
            </span>
            {item.description && <span className={cn("mt-0.5 block text-xs text-muted-foreground", !expanded && "line-clamp-2")}>{item.description}</span>}
          </span>
          {hasKids && <span className="shrink-0 rounded-full bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">{item.total}</span>}
        </button>
        <div className="flex gap-3 px-9 pb-2 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={() => onOpen(item.id)} className="inline-flex items-center gap-1 hover:text-foreground"><MapPin className="h-3 w-3" /> Ver no mapa</button>
          {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><ExternalLink className="h-3 w-3" /> Abrir link</a>}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && hasKids && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="ml-5 mt-1.5 space-y-1.5 overflow-hidden border-l border-border pl-3" role="group">
            {item.children.map((c, i) => <Row key={c.id} item={c} depth={depth + 1} index={i} open={open} forceOpen={forceOpen} onToggle={onToggle} onOpen={onOpen} />)}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}
