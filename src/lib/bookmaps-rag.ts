import { supabase } from "@/integrations/supabase/client";

export interface BookmapNode {
  id: string;
  bookmap_id: string;
  parent_id: string | null;
  title: string;
  path: string;
  level: number;
  node_type: "root" | "section" | "chapter" | "framework" | "rule" | "formula" | "concept";
  content: string;
  highlight: boolean;
  image_url: string | null;
  formula: string | null;
  tags: string[];
  operational_rules?: {
    raw_html?: string;
    color?: string | null;
    has_image?: boolean;
  };
  position: number;
  children?: BookmapNode[];
}

export interface BookmapSummary {
  id: string;
  title: string;
  author: string;
  subtitle?: string | null;
  cover_url?: string | null;
  category: string;
  color?: string | null;
  tags: string[];
  summary?: string | null;
  total_nodes: number;
  tree_data?: BookmapNode;
  created_at: string;
  updated_at: string;
}

/**
 * Busca nos nós de todos os Bookmaps por palavras-chave ou filtros
 */
export async function searchBookmapNodes(params: {
  query?: string;
  bookmapId?: string;
  onlyHighlights?: boolean;
  onlyWithImages?: boolean;
  limit?: number;
}): Promise<BookmapNode[]> {
  const { query, bookmapId, onlyHighlights, onlyWithImages, limit = 40 } = params;

  let q = supabase
    .from("imphq_bookmap_nodes" as any)
    .select("*")
    .order("position", { ascending: true })
    .limit(limit);

  if (bookmapId && bookmapId !== "all") {
    q = q.eq("bookmap_id", bookmapId);
  }

  if (onlyHighlights) {
    q = q.eq("highlight", true);
  }

  if (onlyWithImages) {
    q = q.not("image_url", "is", null);
  }

  if (query && query.trim()) {
    const term = query.trim();
    q = q.or(`title.ilike.%${term}%,content.ilike.%${term}%,path.ilike.%${term}%`);
  }

  const { data, error } = await q;
  if (error) {
    console.error("Erro ao buscar nós de bookmaps:", error);
    return [];
  }

  return (data || []) as unknown as BookmapNode[];
}

/**
 * Lista todos os bookmaps disponíveis
 */
export async function listBookmaps(): Promise<BookmapSummary[]> {
  const { data, error } = await supabase
    .from("imphq_bookmaps" as any)
    .select("id, title, author, subtitle, cover_url, category, color, tags, summary, total_nodes, created_at, updated_at")
    .order("title");

  if (error) {
    console.error("Erro ao listar bookmaps:", error);
    return [];
  }

  return (data || []) as unknown as BookmapSummary[];
}

/**
 * Busca um bookmap completo com a árvore hierárquica
 */
export async function getBookmapWithTree(id: string): Promise<BookmapSummary | null> {
  const { data, error } = await supabase
    .from("imphq_bookmaps" as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    console.error("Erro ao carregar árvore do bookmap:", error);
    return null;
  }

  return data as unknown as BookmapSummary;
}
