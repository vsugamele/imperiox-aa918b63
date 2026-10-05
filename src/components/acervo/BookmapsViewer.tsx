import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BookOpen,
  Search,
  Sparkles,
  ImageIcon,
  ChevronRight,
  ChevronDown,
  Copy,
  ExternalLink,
  Layers,
  Check,
  Flame,
  ListFilter,
  Maximize2
} from "lucide-react";
import { toast } from "sonner";
import {
  type BookmapSummary,
  type BookmapNode,
  listBookmaps,
  getBookmapWithTree,
  searchBookmapNodes
} from "@/lib/bookmaps-rag";

export function BookmapsViewer() {
  const [bookmaps, setBookmaps] = useState<BookmapSummary[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>("100m-leads");
  const [activeBook, setActiveBook] = useState<BookmapSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [onlyHighlights, setOnlyHighlights] = useState<boolean>(false);
  const [onlyImages, setOnlyImages] = useState<boolean>(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "feed">("tree");
  const [searchResults, setSearchResults] = useState<BookmapNode[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Carregar lista de bookmaps
  useEffect(() => {
    listBookmaps().then(list => {
      setBookmaps(list);
      if (list.length > 0 && !selectedBookId) {
        setSelectedBookId(list[0].id);
      }
    });
  }, []);

  // Carregar o bookmap selecionado com a árvore completa
  useEffect(() => {
    if (!selectedBookId) return;
    setLoading(true);
    getBookmapWithTree(selectedBookId).then(book => {
      setActiveBook(book);
      setLoading(false);
      // Auto-expandir o nó raiz e os filhos de nível 1
      if (book?.tree_data) {
        const toExpand = new Set<string>();
        toExpand.add(book.tree_data.id);
        (book.tree_data.children || []).forEach(c => toExpand.add(c.id));
        setExpandedNodes(toExpand);
      }
    });
  }, [selectedBookId]);

  // Busca rápida de nós quando há termo de busca ou filtros ativos
  useEffect(() => {
    const isFiltered = searchTerm.trim().length > 1 || onlyHighlights || onlyImages;
    if (isFiltered) {
      searchBookmapNodes({
        query: searchTerm,
        bookmapId: selectedBookId,
        onlyHighlights,
        onlyWithImages: onlyImages,
        limit: 80
      }).then(res => {
        setSearchResults(res);
      });
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, selectedBookId, onlyHighlights, onlyImages]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!activeBook?.tree_data) return;
    const all = new Set<string>();
    function collect(n: BookmapNode) {
      all.add(n.id);
      (n.children || []).forEach(collect);
    }
    collect(activeBook.tree_data);
    setExpandedNodes(all);
    toast.success("Todos os ramos expandidos");
  };

  const collapseAll = () => {
    if (!activeBook?.tree_data) return;
    const rootOnly = new Set<string>([activeBook.tree_data.id]);
    setExpandedNodes(rootOnly);
    toast.success("Ramos recolhidos");
  };

  const copyRule = (node: BookmapNode) => {
    const text = `[${activeBook?.title || "Bookmap"}] ${node.path}\n\n👉 Regra: ${node.content}${node.formula ? `\n📐 Fórmula: ${node.formula}` : ""}`;
    navigator.clipboard.writeText(text);
    setCopiedId(node.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Regra copiada com caminho de referência!");
  };

  const isFiltering = searchTerm.trim().length > 1 || onlyHighlights || onlyImages;

  return (
    <div className="space-y-6">
      {/* 1. SELETOR DE LIVROS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bookmaps.map(bm => {
          const isSelected = bm.id === selectedBookId;
          return (
            <div
              key={bm.id}
              onClick={() => setSelectedBookId(bm.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${
                isSelected
                  ? "bg-slate-900 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30"
                  : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/40"
              }`}
            >
              {bm.cover_url ? (
                <img
                  src={bm.cover_url}
                  alt={bm.title}
                  className="w-16 h-22 object-cover rounded-md border border-slate-700 shadow-md shrink-0"
                />
              ) : (
                <div className="w-16 h-22 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <BookOpen className="h-7 w-7 text-amber-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-100 truncate">{bm.title}</h3>
                  <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                    {bm.total_nodes} nós
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 font-medium">{bm.author}</p>
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{bm.subtitle || bm.summary}</p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <Badge className="text-[9px] bg-slate-800 text-slate-300 border-slate-700">
                    {bm.category}
                  </Badge>
                  {bm.tags?.slice(0, 3).map(t => (
                    <span key={t} className="text-[9px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. BARRA DE FILTROS & AÇÕES */}
      <Card className="bg-slate-950/60 border-slate-800">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar regras, fórmulas, ganchos, orçamentos, scripts..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-800 text-slate-100 text-xs h-9"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
              <Button
                size="sm"
                variant={onlyHighlights ? "default" : "outline"}
                onClick={() => setOnlyHighlights(!onlyHighlights)}
                className={`text-xs h-8 gap-1.5 ${
                  onlyHighlights
                    ? "bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold"
                    : "border-slate-800 text-slate-300 hover:bg-slate-900"
                }`}
              >
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                Regras de Ouro
              </Button>
              <Button
                size="sm"
                variant={onlyImages ? "default" : "outline"}
                onClick={() => setOnlyImages(!onlyImages)}
                className={`text-xs h-8 gap-1.5 ${
                  onlyImages
                    ? "bg-sky-500 text-slate-950 hover:bg-sky-400 font-bold"
                    : "border-slate-800 text-slate-300 hover:bg-slate-900"
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5 text-sky-400" />
                Diagramas
              </Button>
              {!isFiltering && (
                <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                  <Button size="sm" variant="ghost" onClick={expandAll} className="h-8 text-xs text-slate-400 hover:text-slate-200">
                    Expandir tudo
                  </Button>
                  <Button size="sm" variant="ghost" onClick={collapseAll} className="h-8 text-xs text-slate-400 hover:text-slate-200">
                    Recolher
                  </Button>
                </div>
              )}
            </div>
          </div>
          {isFiltering && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
              <span>{searchResults.length} nó(s) encontrado(s) nos filtros</span>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setOnlyHighlights(false);
                  setOnlyImages(false);
                }}
                className="text-amber-400 hover:underline"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. VISUALIZAÇÃO: RESULTADOS FILTRADOS (FEED) OU ÁRVORE INTERATIVA */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Carregando mapa mental estruturado...</div>
      ) : isFiltering ? (
        /* FEED DE RESULTADOS FILTRADOS */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {searchResults.map(node => (
            <div
              key={node.id}
              className={`p-4 rounded-xl border space-y-2.5 transition-all ${
                node.highlight
                  ? "bg-amber-950/20 border-amber-500/40 shadow-sm"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] text-slate-400 font-mono tracking-tight line-clamp-1">
                  {node.path}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyRule(node)}
                  className="h-6 px-2 text-[10px] text-slate-400 hover:text-amber-400 shrink-0"
                >
                  {copiedId === node.id ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  Copiar
                </Button>
              </div>

              {node.highlight ? (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-semibold leading-relaxed">
                  ⭐ {node.content}
                </div>
              ) : (
                <p className="text-xs text-slate-200 leading-relaxed">{node.content}</p>
              )}

              {node.image_url && (
                <div
                  onClick={() => setLightboxImage({ url: node.image_url!, title: node.title })}
                  className="relative group rounded-lg overflow-hidden border border-slate-700 cursor-pointer bg-slate-950"
                >
                  <img
                    src={node.image_url}
                    alt={node.title}
                    className="w-full max-h-48 object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs text-white font-medium">
                    <Maximize2 className="h-3.5 w-3.5" /> Ampliar Diagrama
                  </div>
                </div>
              )}
            </div>
          ))}
          {searchResults.length === 0 && (
            <div className="col-span-2 py-12 text-center text-slate-400 text-sm">
              Nenhuma regra ou nó corresponde à busca.
            </div>
          )}
        </div>
      ) : activeBook?.tree_data ? (
        /* ÁRVORE HIERÁRQUICA COMPLETA */
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 overflow-x-auto shadow-2xl">
          <NodeRenderer
            node={activeBook.tree_data}
            expandedNodes={expandedNodes}
            toggleExpand={toggleExpand}
            onOpenImage={(url, title) => setLightboxImage({ url, title })}
            onCopy={copyRule}
            copiedId={copiedId}
          />
        </div>
      ) : (
        <div className="py-12 text-center text-slate-400 text-sm">Nenhum dado encontrado para este livro.</div>
      )}

      {/* 4. MODAL DE ILUSTRAÇÃO / DIAGRAMA FULL HD */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl bg-slate-950 border-slate-800 text-slate-100 p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-slate-200">
              {lightboxImage?.title || "Diagrama do Livro"}
            </DialogTitle>
          </DialogHeader>
          {lightboxImage && (
            <div className="flex items-center justify-center p-2 bg-slate-900/60 rounded-xl border border-slate-800 max-h-[75vh] overflow-auto">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[70vh] w-auto object-contain rounded-md"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── RENDERIZADOR RECURSIVO DE NÓS DA ÁRVORE ─────────────────────────────────
function NodeRenderer({
  node,
  expandedNodes,
  toggleExpand,
  onOpenImage,
  onCopy,
  copiedId
}: {
  node: BookmapNode;
  expandedNodes: Set<string>;
  toggleExpand: (id: string) => void;
  onOpenImage: (url: string, title: string) => void;
  onCopy: (node: BookmapNode) => void;
  copiedId: string | null;
}) {
  const hasChildren = (node.children || []).length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isRoot = node.level === 0;

  return (
    <div className={`space-y-1.5 ${node.level > 0 ? "ml-5 pl-3 border-l border-slate-800/80" : ""}`}>
      <div
        className={`flex items-start gap-2 py-1.5 px-2.5 rounded-lg group transition-colors ${
          isRoot
            ? "bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold"
            : node.highlight
            ? "bg-amber-500/10 border border-amber-500/30 text-amber-200 font-medium"
            : "hover:bg-slate-900/60 text-slate-300"
        }`}
      >
        {/* Toggle Expandir */}
        {hasChildren ? (
          <button
            onClick={() => toggleExpand(node.id)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition shrink-0 mt-0.5"
            aria-label={isExpanded ? "Recolher" : "Expandir"}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Conteúdo do Nó */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              onClick={() => hasChildren && toggleExpand(node.id)}
              className={`text-xs ${
                isRoot
                  ? "text-base font-extrabold text-amber-400"
                  : node.level === 1
                  ? "font-bold text-slate-100"
                  : node.highlight
                  ? "text-amber-200 font-semibold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20"
                  : "text-slate-200"
              } cursor-pointer`}
            >
              {node.content || node.title}
            </span>

            {node.highlight && (
              <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border-amber-500/40 shrink-0">
                REGRA DE OURO
              </Badge>
            )}

            {node.image_url && (
              <button
                onClick={() => onOpenImage(node.image_url!, node.title)}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 transition shrink-0"
              >
                <ImageIcon className="h-3 w-3" /> Ver Diagrama
              </button>
            )}

            {/* Ação de Copiar */}
            <button
              onClick={() => onCopy(node)}
              className="opacity-0 group-hover:opacity-100 transition p-1 hover:text-amber-400 text-slate-500 ml-auto shrink-0"
              title="Copiar regra e caminho"
            >
              {copiedId === node.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>

          {/* Miniatura do Diagrama se houver */}
          {node.image_url && isExpanded && (
            <div
              onClick={() => onOpenImage(node.image_url!, node.title)}
              className="mt-2 w-48 rounded-lg overflow-hidden border border-slate-700/60 cursor-pointer bg-slate-900 group/img"
            >
              <img
                src={node.image_url}
                alt={node.title}
                className="w-full h-24 object-cover object-center group-hover/img:scale-105 transition-transform duration-200"
              />
            </div>
          )}
        </div>
      </div>

      {/* Filhos Recursivos */}
      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {node.children!.map(child => (
            <NodeRenderer
              key={child.id}
              node={child}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              onOpenImage={onOpenImage}
              onCopy={onCopy}
              copiedId={copiedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
