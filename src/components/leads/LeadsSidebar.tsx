import { useMemo } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Zap, ExternalLink } from "lucide-react";

interface Props {
  projects: any[];
  leads: any[];
  allVendasRaw: any[];
  projectFilter: string;
  productFilter: string;
  expandedProjects: Set<string>;
  onProjectFilter: (pid: string) => void;
  onProductFilter: (prod: string) => void;
  onToggleProject: (pid: string) => void;
  realtimeActive: boolean;
  projectCounts?: { totalAll: number; byProject: Record<string, number>; noProject: number };
  topTags?: Array<{ tag: string; count: number }>;
  onCreateRuleForTag?: (tag: string) => void;
  tagFilter?: string;
  onTagFilter?: (tag: string) => void;
}

export default function LeadsSidebar({
  projects, leads, allVendasRaw, projectFilter, productFilter,
  expandedProjects, onProjectFilter, onProductFilter, onToggleProject, realtimeActive,
  projectCounts, topTags, onCreateRuleForTag, tagFilter = "all", onTagFilter,
}: Props) {

  const projectProductMap = useMemo(() => {
    const map = new Map<string, { products: Map<string, number>; totalLeads: number }>();
    const productLeadMap = new Map<string, Set<string>>();
    allVendasRaw.forEach((v: any) => {
      if (!v.produto_nome || !v.lead_id) return;
      if (!productLeadMap.has(v.produto_nome)) productLeadMap.set(v.produto_nome, new Set());
      productLeadMap.get(v.produto_nome)!.add(v.lead_id);
    });
    projects.forEach((p: any) => {
      const projectLeads = leads.filter((l: any) => l.project_id === p.id);
      const projectLeadIdsSet = new Set(projectLeads.map((l: any) => l.id));
      const prodMap = new Map<string, number>();
      productLeadMap.forEach((leadIds, prodName) => {
        const count = [...leadIds].filter(id => projectLeadIdsSet.has(id)).length;
        if (count > 0) prodMap.set(prodName, count);
      });
      const globalCount = projectCounts?.byProject?.[p.id] ?? projectLeads.length;
      if (globalCount > 0) map.set(p.id, { products: prodMap, totalLeads: globalCount });
    });
    return map;
  }, [projects, leads, allVendasRaw, projectCounts]);


  const noLeadsInProject = projectCounts?.noProject ?? leads.filter((l: any) => !l.project_id).length;
  const totalAllLeads = projectCounts?.totalAll ?? leads.length;

  return (
    <div className="w-56 shrink-0 hidden lg:block">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-2xl font-semibold text-gold leading-none">Leads</h2>
        {realtimeActive && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="Realtime ativo" />}
      </div>
      <p className="text-[10px] uppercase tracking-editorial text-muted-foreground/70 mb-3">
        {totalAllLeads} no total
      </p>
      <div className="editorial-divider mb-3" />
      <div className="space-y-0.5 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
        <button
          className={cn(
            "w-full text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center justify-between",
            projectFilter === "all" && productFilter === "all"
              ? "bg-gold/10 text-gold border-l-2 border-gold"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-l-2 border-transparent",
          )}
          onClick={() => { onProjectFilter("all"); onProductFilter("all"); }}
        >
          <span>🌐 Todos os leads</span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-1">{totalAllLeads}</Badge>
        </button>
        {noLeadsInProject > 0 && (
          <button
            className={cn(
              "w-full text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center justify-between",
              projectFilter === "none"
                ? "bg-gold/10 text-gold border-l-2 border-gold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-l-2 border-transparent",
            )}
            onClick={() => { onProjectFilter("none"); onProductFilter("all"); }}
          >
            <span>📂 Sem projeto</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-1">{noLeadsInProject}</Badge>
          </button>
        )}
        {projects.length > 0 && (
          <p className="text-[9px] uppercase tracking-editorial text-muted-foreground/50 mt-4 mb-1 px-2">
            Por projeto
          </p>
        )}
        {projects.map((p: any) => {
          const info = projectProductMap.get(p.id);
          if (!info || info.totalLeads === 0) return null;
          const isExpanded = expandedProjects.has(p.id);
          const isSelected = projectFilter === p.id && productFilter === "all";
          return (
            <div key={p.id}>
              <div className="flex items-center">
                <button
                  className="p-1 text-muted-foreground hover:text-gold transition-colors"
                  onClick={(e) => { e.stopPropagation(); onToggleProject(p.id); }}
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
                <button
                  className={cn(
                    "flex-1 text-left text-xs px-1 py-1.5 rounded transition-colors truncate flex items-center justify-between border-l-2",
                    isSelected
                      ? "bg-gold/10 text-gold border-gold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-transparent",
                  )}
                  onClick={() => { onProjectFilter(p.id); onProductFilter("all"); }}
                >
                  <span className="truncate">{p.icon || "📁"} {p.name}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-1 shrink-0">{info.totalLeads}</Badge>
                </button>
              </div>
              {isExpanded && info.products.size > 0 && (
                <div className="ml-5 space-y-0.5 mt-0.5 border-l border-border/40 pl-2">
                  {Array.from(info.products.entries()).sort((a, b) => b[1] - a[1]).map(([prodName, count]) => (
                    <button
                      key={prodName}
                      className={cn(
                        "w-full text-left text-[11px] px-2 py-1 rounded transition-colors truncate flex items-center justify-between",
                        productFilter === prodName && projectFilter === p.id
                          ? "bg-gold/10 text-gold"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
                      )}
                      onClick={() => { onProjectFilter(p.id); onProductFilter(prodName); }}
                      title={prodName}
                    >
                      <span className="truncate">🏷️ {prodName}</span>
                      <span className="text-[9px] text-muted-foreground/70 ml-1 shrink-0">{count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {topTags && topTags.length > 0 && (
          <>
            <p className="text-[9px] uppercase tracking-editorial text-muted-foreground/50 mt-4 mb-1 px-2 flex items-center justify-between">
              <span>Top tags</span>
              {tagFilter !== "all" && onTagFilter && (
                <button onClick={() => onTagFilter("all")} className="text-gold hover:text-gold-light normal-case tracking-normal" title="Limpar filtro">limpar</button>
              )}
            </p>
            {topTags.slice(0, 20).map(({ tag, count }) => {
              const selected = tagFilter === tag;
              return (
                <div key={tag} className={cn(
                  "group flex items-center gap-1 px-2 py-1 rounded border-l-2",
                  selected ? "bg-gold/10 border-gold" : "hover:bg-secondary/40 border-transparent",
                )}>
                  <button
                    onClick={() => onTagFilter?.(selected ? "all" : tag)}
                    className={cn("flex-1 text-left text-xs truncate", selected ? "text-gold" : "text-muted-foreground hover:text-foreground")}
                    title={`Filtrar leads com tag "${tag}"`}
                  >
                    🏷️ {tag}
                  </button>
                  <span className="text-[9px] text-muted-foreground/70">{count}</span>
                  {onCreateRuleForTag && (
                    <button
                      onClick={() => onCreateRuleForTag(tag)}
                      title="Criar regra de roteamento para esta tag"
                      className="opacity-0 group-hover:opacity-100 text-primary hover:text-gold transition-opacity"
                    >
                      <Zap className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
