import { useEffect, useState } from "react";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EditableTagList } from "@/components/projeto/EditableTagList";
import { FileUpload } from "@/components/FileUpload";
import { Plus, Search, Star, ExternalLink, Trash2, Image, Layout, Mail, Video, FileText, Palette, List, Grid3X3, FolderPlus, Upload, BookmarkPlus, Camera, Megaphone, Play, LayoutGrid, Smartphone, ChevronRight, ChevronDown, Folder, FolderOpen, RefreshCw, PanelLeft, PanelLeftClose, Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TIPOS = ["criativo", "landing_page", "email", "video", "copy"];
const PLATAFORMAS = ["Meta Ads", "Google Ads", "TikTok", "YouTube", "Instagram", "Email", "Outro"];

const TIPO_STYLES: Record<string, { border: string; badge: string; icon: any; gradient: string }> = {
  criativo: { border: "border-l-rose-500", badge: "bg-rose-500/15 text-rose-400 border-rose-500/30", icon: Palette, gradient: "from-rose-500/20 to-rose-500/5" },
  landing_page: { border: "border-l-blue-500", badge: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Layout, gradient: "from-blue-500/20 to-blue-500/5" },
  email: { border: "border-l-amber-500", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Mail, gradient: "from-amber-500/20 to-amber-500/5" },
  video: { border: "border-l-violet-500", badge: "bg-violet-500/15 text-violet-400 border-violet-500/30", icon: Video, gradient: "from-violet-500/20 to-violet-500/5" },
  copy: { border: "border-l-emerald-500", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: FileText, gradient: "from-emerald-500/20 to-emerald-500/5" },
};

const CATEGORY_META: Record<string, { label: string; icon: any; color: string }> = {
  expert: { label: "Expert", icon: Camera, color: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30" },
  produtos: { label: "Produtos", icon: LayoutGrid, color: "text-orange-400 bg-orange-500/15 border-orange-500/30" },
  anuncios: { label: "Anúncios", icon: Megaphone, color: "text-rose-400 bg-rose-500/15 border-rose-500/30" },
  reels: { label: "Reels", icon: Play, color: "text-violet-400 bg-violet-500/15 border-violet-500/30" },
  stories: { label: "Stories", icon: Smartphone, color: "text-pink-400 bg-pink-500/15 border-pink-500/30" },
  feed: { label: "Feed", icon: Image, color: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
  complementar: { label: "Complementar", icon: FileText, color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
};

type SourceType = "manual" | "library" | "ads";

interface Ref {
  id: string; project_id?: string; tipo?: string; titulo: string;
  url?: string; image_url?: string; tags?: string[]; notas?: string;
  score?: number; plataforma?: string; created_at?: string;
  pasta?: string; produto?: string;
  source: SourceType;
  content_category?: string;
  project_name?: string;
  is_video?: boolean;
  transcricao?: string | null;
  transcribe_status?: string | null;
  transcribe_error?: string | null;
  transcribed_at?: string | null;
}

/** Check if a URL points to a video file */
function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return ["mp4", "webm", "mov", "avi", "mkv"].includes(ext || "");
}

const LS_KEY = "referencias.filters.v1";
const loadLS = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } };

function TranscriptionBlock({ refItem, onChange }: { refItem: Ref; onChange: (patch: Partial<Ref>) => void }) {
  const [busy, setBusy] = useState(false);
  const status = refItem.transcribe_status || "idle";
  const hasText = !!(refItem.transcricao && refItem.transcricao.trim());

  const run = async () => {
    setBusy(true);
    onChange({ transcribe_status: "processing", transcribe_error: null });
    try {
      const { data, error } = await supabase.functions.invoke("referencia-video-transcribe", {
        body: { referencia_id: refItem.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const transcript = (data as any)?.transcript || "";
      onChange({ transcricao: transcript, transcribe_status: "done", transcribed_at: new Date().toISOString() });
      toast.success("Transcrição concluída");
    } catch (e: any) {
      const msg = e?.message || "Falha ao transcrever";
      onChange({ transcribe_status: "error", transcribe_error: msg });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!refItem.transcricao) return;
    await navigator.clipboard.writeText(refItem.transcricao);
    toast.success("Transcrição copiada");
  };

  return (
    <div className="mt-3 rounded-md border border-border bg-secondary/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          Transcrição do vídeo
          {status === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
          {status === "done" && <Badge variant="outline" className="h-4 text-[10px]">pronta</Badge>}
          {status === "error" && <Badge variant="destructive" className="h-4 text-[10px]">erro</Badge>}
        </div>
        <div className="flex items-center gap-1">
          {hasText && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={copy}>
              Copiar
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy || status === "processing"} onClick={run}>
            {busy || status === "processing"
              ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processando…</>
              : hasText ? "Refazer" : "Transcrever"}
          </Button>
        </div>
      </div>
      {hasText ? (
        <Textarea
          value={refItem.transcricao || ""}
          onChange={(e) => onChange({ transcricao: e.target.value })}
          className="text-xs min-h-[120px] max-h-[240px] leading-6"
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          {status === "error"
            ? (refItem.transcribe_error || "Falha ao transcrever. Tente novamente.")
            : "Gere a transcrição automática (áudio do vídeo) — limite 24MB."}
        </p>
      )}
    </div>
  );
}

export default function Referencias() {
  const _ls = loadLS();
  const [refs, setRefs] = useState<Ref[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState(_ls.search ?? "");
  const [search, setSearch] = useState(_ls.search ?? "");
  const [filterTipo, setFilterTipo] = useState(_ls.filterTipo ?? "all");
  const [filterPlat, setFilterPlat] = useState(_ls.filterPlat ?? "all");
  const [filterProject, setFilterProject] = useState(_ls.filterProject ?? "all");
  const [filterPasta, setFilterPasta] = useState(_ls.filterPasta ?? "all");
  const [filterOrigem, setFilterOrigem] = useState<"all" | "manual" | "library" | "ads">(_ls.filterOrigem ?? "all");
  const [filterCategory, setFilterCategory] = useState(_ls.filterCategory ?? "all");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Ref | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Ref>>({ titulo: "", tipo: "criativo", tags: [] });
  const [viewMode, setViewMode] = useState<"grid" | "list">(_ls.viewMode ?? "grid");
  const [showNewPasta, setShowNewPasta] = useState(false);
  const [newPastaName, setNewPastaName] = useState("");
  const [currentFolder, setCurrentFolder] = useState<string[]>([]); // breadcrumb path
  const [syncing, setSyncing] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState<boolean>(() => {
    try { return localStorage.getItem("referencias.sidebar.hidden.v1") === "1"; } catch { return false; }
  });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("referencias.sidebar.expanded.v1");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });
  const [emptyFolders, setEmptyFolders] = useState<string[]>([]);

  const loadEmptyFolders = async () => {
    const { data } = await supabase.from("imphq_referencias_pastas" as any).select("path");
    setEmptyFolders(((data || []) as any[]).map((r: any) => r.path));
  };

  const addEmptyFolder = async (path: string) => {
    if (emptyFolders.includes(path)) return;
    const { error } = await supabase.from("imphq_referencias_pastas" as any).insert({ path } as any);
    if (error && !error.message.includes("duplicate")) {
      toast.error("Erro ao salvar pasta: " + error.message);
      return;
    }
    setEmptyFolders(prev => [...prev, path]);
  };

  const removeEmptyFolder = async (path: string) => {
    await supabase.from("imphq_referencias_pastas" as any).delete().eq("path", path);
    setEmptyFolders(prev => prev.filter(p => p !== path));
  };

  const renameEmptyFolder = async (oldPath: string, newPath: string) => {
    await supabase.from("imphq_referencias_pastas" as any).update({ path: newPath } as any).eq("path", oldPath);
    setEmptyFolders(prev => prev.map(p => p === oldPath ? newPath : p));
  };

  const toggleSidebar = () => {
    setSidebarHidden(v => {
      const nv = !v;
      try { localStorage.setItem("referencias.sidebar.hidden.v1", nv ? "1" : "0"); } catch {}
      return nv;
    });
  };
  const toggleFolderExpanded = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      try { localStorage.setItem("referencias.sidebar.expanded.v1", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // Debounce search input -> search (250ms)
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Persist filters
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      search: searchInput, filterTipo, filterPlat, filterProject,
      filterPasta, filterOrigem, filterCategory, viewMode,
    }));
  }, [searchInput, filterTipo, filterPlat, filterProject, filterPasta, filterOrigem, filterCategory, viewMode]);

  const hasActiveFilters = !!(search || filterTipo !== "all" || filterPlat !== "all" || filterProject !== "all" || filterPasta !== "all" || filterOrigem !== "all" || filterCategory !== "all");
  const clearFilters = () => {
    setSearchInput(""); setSearch("");
    setFilterTipo("all"); setFilterPlat("all"); setFilterProject("all");
    setFilterPasta("all"); setFilterOrigem("all"); setFilterCategory("all");
    setCurrentFolder([]);
  };

  const load = async () => {
    const [rRes, lRes, pRes, adsRes] = await Promise.all([
      supabase.from("imphq_referencias").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_content_library" as any).select("id, project_id, title, file_url, file_type, thumbnail_url, tags, description, content_category, created_at").order("created_at", { ascending: false }),
      supabase.from("imphq_projects").select("id, name").order("name"),
      supabase.from("imphq_ads_spend" as any).select("id, project_id, campanha, conjunto_anuncios, anuncio, plataforma, ctr, impressoes, cliques, compras, valor, custo_por_compra, data_ref, created_at").order("created_at", { ascending: false }).limit(200),
    ]);

    const projs = pRes.data || [];
    setProjects(projs);
    const projMap = Object.fromEntries(projs.map((p: any) => [p.id, p.name]));

    const manualRefs: Ref[] = ((rRes.data || []) as any[]).map(r => {
      // Auto-repair legacy rows where `pasta` was saved with the project segment
      // prefix (bug pré-fix). Strip the leading "<ProjectName>/" or "Sem Projeto/".
      let pasta = r.pasta as string | null;
      if (pasta) {
        const projSeg = (projMap[r.project_id] || "").replace(/\//g, "-").trim() || (r.project_id ? "Projeto" : "Sem Projeto");
        if (pasta === projSeg) {
          pasta = null;
        } else if (pasta.startsWith(projSeg + "/")) {
          pasta = pasta.slice(projSeg.length + 1);
        }
        if (pasta !== r.pasta) {
          // Fire-and-forget DB cleanup
          supabase.from("imphq_referencias").update({ pasta }).eq("id", r.id).then(() => {});
        }
      }
      return {
        ...r,
        pasta,
        source: "manual" as SourceType,
        is_video: isVideoUrl(r.image_url) || isVideoUrl(r.url),
      };
    });

    const libraryRefs: Ref[] = ((lRes.data || []) as any[])
      .filter((m: any) => m.file_type === "image" || m.file_type === "video")
      .map((m: any) => {
        const isVid = m.file_type === "video";
        const thumbUrl = m.thumbnail_url || (!isVid ? m.file_url : null);
        return {
          id: `lib_${m.id}`,
          project_id: m.project_id || undefined,
          titulo: m.title || m.file_url?.split("/").pop() || "Sem título",
          image_url: thumbUrl || undefined,
          url: m.file_url,
          tags: m.tags || [],
          notas: m.description || undefined,
          score: 0,
          tipo: isVid ? "video" : "criativo",
          created_at: m.created_at,
          content_category: m.content_category || undefined,
          source: "library" as SourceType,
          project_name: projMap[m.project_id] || undefined,
          is_video: isVid,
        };
      });

    // Aggregate ads by unique ad name per project
    const adsMap = new Map<string, any>();
    ((adsRes.data || []) as any[]).forEach((ad: any) => {
      const key = `${ad.project_id}_${ad.anuncio || ad.conjunto_anuncios || ad.campanha}`;
      const existing = adsMap.get(key);
      if (!existing || (ad.ctr && ad.ctr > (existing.ctr || 0))) {
        adsMap.set(key, ad);
      }
    });

    const adsRefs: Ref[] = Array.from(adsMap.values())
      .filter((ad: any) => ad.anuncio || ad.campanha)
      .slice(0, 50)
      .map((ad: any) => {
        const ctr = Number(ad.ctr ?? 0);
        const impr = Number(ad.impressoes ?? 0);
        const compras = Number(ad.compras ?? 0);
        const cpc = Number(ad.custo_por_compra ?? 0);
        // Score 1-5 ponderando CTR, volume e compras
        let s = 1;
        if (compras >= 3 && cpc > 0 && cpc < 100) s = 5;
        else if (ctr >= 2 && impr >= 1000) s = 5;
        else if (ctr >= 1.5 && impr >= 500) s = 4;
        else if (ctr >= 1) s = 3;
        else if (ctr >= 0.5) s = 2;
        return ({
          id: `ads_${ad.id}`,
          project_id: ad.project_id || undefined,
          titulo: ad.anuncio || ad.conjunto_anuncios || ad.campanha || "Anúncio",
          tags: [ad.plataforma, ctr ? `CTR ${ctr.toFixed(2)}%` : null, compras ? `${compras} venda${compras > 1 ? "s" : ""}` : null].filter(Boolean) as string[],
          notas: `Campanha: ${ad.campanha || "—"} | Impr: ${impr} | Cliques: ${ad.cliques || 0}${compras ? ` | Compras: ${compras}` : ""}${cpc ? ` | CPA: R$ ${cpc.toFixed(0)}` : ""}`,
          score: s,
          tipo: "criativo" as const,
          plataforma: ad.plataforma || "Meta Ads",
          created_at: ad.data_ref || ad.created_at,
          source: "ads" as SourceType,
          project_name: projMap[ad.project_id] || undefined,
        });
      });

    setRefs([...manualRefs, ...libraryRefs, ...adsRefs]);
  };

  useEffect(() => { load(); loadEmptyFolders(); }, []);

  // Auto-clean: remove emptyFolders that now have real refs
  useEffect(() => {
    if (refs.length === 0 || emptyFolders.length === 0) return;
    const derived = new Set(refs.map(r => {
      const projSeg = (r.project_name || "").replace(/\//g, "-").trim() || (r.project_id ? "Projeto" : "Sem Projeto");
      if (r.source === "manual" && r.pasta) return `${projSeg}/${r.pasta}`;
      return null;
    }).filter(Boolean) as string[]);
    const toRemove = emptyFolders.filter(f => derived.has(f) || [...derived].some(d => d.startsWith(f + "/")));
    if (toRemove.length > 0) {
      toRemove.forEach(p => { removeEmptyFolder(p); });
    }
  }, [refs]);

  // Build full folder path string from breadcrumb
  const currentFolderPath = currentFolder.join("/");

  // Subpath relative to the project segment. The `pasta` column stores the path
  // WITHOUT the project prefix — getVirtualPath() re-adds the project segment.
  // currentFolder[0] is always the project name segment ("Sem Projeto" or the project's name).
  const currentSubPath = currentFolder.length > 1 ? currentFolder.slice(1).join("/") : "";

  // Normalize a segment for use in a path (no slashes)
  const norm = (s?: string | null) => (s || "").replace(/\//g, "-").trim();

  // Derive a virtual hierarchical path for every ref:
  //   {Projeto}/{Tipo}/{Plataforma?}    (or "Sem Projeto" / "Sem Tipo")
  // For manual refs that already have `pasta`, prepend project so they live inside it.
  const getVirtualPath = (r: Ref): string => {
    const projSeg = norm(r.project_name) || (r.project_id ? "Projeto" : "Sem Projeto");
    if (r.source === "manual" && r.pasta) {
      return `${projSeg}/${r.pasta}`;
    }
    const tipoLabel: Record<string, string> = {
      criativo: "Criativos",
      landing_page: "Landing Pages",
      email: "Emails",
      video: "Vídeos",
      copy: "Copys",
    };
    const tipoSeg = tipoLabel[r.tipo || ""] || "Outros";
    const platSeg = norm(r.plataforma);
    return platSeg ? `${projSeg}/${tipoSeg}/${platSeg}` : `${projSeg}/${tipoSeg}`;
  };

  // Compute virtual paths once per render
  const refsWithPath = refs.map(r => ({ ...r, _vpath: getVirtualPath(r) }));

  // All unique virtual paths (used to build the tree)
  const derivedPastas = [...new Set(refsWithPath.map(r => r._vpath).filter(Boolean))] as string[];
  const allPastas = [...new Set([...derivedPastas, ...emptyFolders])];
  const categories = [...new Set(refs.filter(r => r.source === "library").map(r => r.content_category).filter(Boolean))] as string[];

  // Get subfolders at current level (for FolderCard grid)
  const getSubfoldersAtLevel = () => {
    const prefix = currentFolderPath ? currentFolderPath + "/" : "";
    const subfolders = new Set<string>();
    allPastas.forEach(p => {
      if (currentFolderPath) {
        if (p.startsWith(prefix) && p !== currentFolderPath) {
          const rest = p.slice(prefix.length);
          const nextSegment = rest.split("/")[0];
          if (nextSegment) subfolders.add(nextSegment);
        }
      } else {
        const topSegment = p.split("/")[0];
        if (topSegment) subfolders.add(topSegment);
      }
    });
    return [...subfolders].sort();
  };

  const subfolders = getSubfoldersAtLevel();

  // Match everything except the folder/pasta filter — reused by folder counters
  const matchesNonFolder = (r: Ref & { _vpath?: string }) => {
    const ms = !search || r.titulo?.toLowerCase().includes(search.toLowerCase()) || r.notas?.toLowerCase().includes(search.toLowerCase());
    const mt = filterTipo === "all" || r.tipo === filterTipo;
    const mp = filterPlat === "all" || r.plataforma === filterPlat;
    const mpr = filterProject === "all" || r.project_id === filterProject;
    const mo = filterOrigem === "all" || r.source === filterOrigem;
    const mc = filterCategory === "all" || r.content_category === filterCategory;
    return ms && mt && mp && mpr && mo && mc;
  };

  const filteredRaw = refsWithPath.filter(r => {
    if (!matchesNonFolder(r)) return false;

    // Virtual folder filter: applies to ALL sources via _vpath, includes subfolders (cumulative)
    if (filterPasta !== "all") {
      return r._vpath === filterPasta || (r._vpath?.startsWith(filterPasta + "/") ?? false);
    }
    if (currentFolder.length > 0) {
      return r._vpath === currentFolderPath || (r._vpath?.startsWith(currentFolderPath + "/") ?? false);
    }
    return true;
  });

  // Count of items in the current folder ignoring only the type/origin/plat filters
  const rawInCurrentFolder = currentFolder.length > 0
    ? refsWithPath.filter(r => r._vpath === currentFolderPath || (r._vpath?.startsWith(currentFolderPath + "/") ?? false)).length
    : 0;

  // Sort: when viewing ads, show top performers first by default
  const filtered = filterOrigem === "ads"
    ? [...filteredRaw].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    : filteredRaw;


  // Group by project for display
  const groupedByProject = () => {
    if (filterProject !== "all") return null;
    const groups: Record<string, Ref[]> = {};
    const noProject: Ref[] = [];
    for (const r of filtered) {
      if (r.project_id) {
        const name = r.project_name || projectName(r.project_id) || r.project_id;
        if (!groups[name]) groups[name] = [];
        groups[name].push(r);
      } else {
        noProject.push(r);
      }
    }
    if (Object.keys(groups).length <= 1 && noProject.length === 0) return null;
    return { groups, noProject };
  };

  const typeCounts = TIPOS.reduce((acc, t) => {
    acc[t] = refs.filter(r => r.tipo === t).length;
    return acc;
  }, {} as Record<string, number>);

  const manualCount = refs.filter(r => r.source === "manual").length;
  const libraryCount = refs.filter(r => r.source === "library").length;
  const adsCount = refs.filter(r => r.source === "ads").length;

  const fetchLinkPreview = async (
    id: string,
    url: string,
    opts: { forceTitle?: boolean } = {},
  ) => {
    try {
      const { data } = await supabase.functions.invoke("link-preview", { body: { url } });
      if (!data || data.fallback) return;
      const patch: Record<string, unknown> = {};
      if (data.image) patch.image_url = data.image;
      if (data.video && !data.image) patch.url = data.video;
      if (opts.forceTitle && data.title) patch.titulo = data.title;
      if (Object.keys(patch).length === 0) return;
      await supabase.from("imphq_referencias").update(patch as any).eq("id", id);
      load();
    } catch (e) {
      console.warn("[link-preview]", e);
    }
  };

  const createRef = async () => {
    if (!form.titulo?.trim()) { toast.error("Título obrigatório"); return; }
    const id = crypto.randomUUID();
    const pastaValue = form.pasta || (currentSubPath || null);
    const { error } = await supabase.from("imphq_referencias").insert({
      id, titulo: form.titulo, tipo: form.tipo || "criativo",
      url: form.url || null, image_url: form.image_url || null,
      tags: form.tags || [], notas: form.notas || null,
      score: form.score || 0, plataforma: form.plataforma || null,
      project_id: filterProject !== "all" ? filterProject : (form.project_id || null),
      pasta: pastaValue, produto: form.produto || null,
    } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Referência criada!");
    setShowNew(false);
    if (form.url && !form.image_url) {
      toast.info("Buscando preview do link...");
      fetchLinkPreview(id, form.url);
    }
    setForm({ titulo: "", tipo: "criativo", tags: [] });
    load();
  };

  const saveEdit = async () => {
    if (!editing || editing.source === "library") return;
    const { error } = await supabase.from("imphq_referencias").update({
      titulo: editing.titulo, tipo: editing.tipo, url: editing.url,
      image_url: editing.image_url, tags: editing.tags, notas: editing.notas,
      score: editing.score, plataforma: editing.plataforma, project_id: editing.project_id,
      pasta: editing.pasta || null, produto: editing.produto || null,
      transcricao: editing.transcricao ?? null,
    } as any).eq("id", editing.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Salvo!"); setEditing(null); load();
  };

  const deleteRef = async (id: string) => {
    if (id.startsWith("lib_")) { toast.error("Itens do projeto são gerenciados na aba Mídia"); return; }
    await supabase.from("imphq_referencias").delete().eq("id", id);
    toast.success("Removido"); setEditing(null); load();
  };

  const saveAsRef = async (item: Ref) => {
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_referencias").insert({
      id, titulo: item.titulo, tipo: item.tipo || "criativo",
      image_url: item.image_url || null, url: item.url || null,
      tags: item.tags || [], notas: item.notas || null,
      score: 0, project_id: item.project_id || null,
      produto: item.content_category || null,
    } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Salvo como referência!");
    load();
  };

  const handleBulkUpload = async (urls: string[]) => {
    let count = 0;
    for (const url of urls) {
      const isVid = isVideoUrl(url);
      const { error } = await supabase.from("imphq_referencias").insert({
        id: crypto.randomUUID(),
        titulo: `${isVid ? "Vídeo" : "Upload"} ${new Date().toLocaleDateString()} #${count + 1}`,
        tipo: isVid ? "video" : "criativo",
        image_url: isVid ? null : url,
        url: isVid ? url : null,
        project_id: filterProject !== "all" ? filterProject : null,
        pasta: currentSubPath || (filterPasta !== "all" ? filterPasta : null),
        tags: [],
        score: 0,
      } as any);
      if (!error) count++;
    }
    toast.success(`${count} referências criadas via upload`);
    load();
  };

  const projectName = (id?: string) => projects.find(p => p.id === id)?.name || "";

  const ScoreStars = ({ score, onChange }: { score: number; onChange?: (s: number) => void }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 transition-colors ${s <= score ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.4)]" : "text-muted-foreground/30"} ${onChange ? "cursor-pointer hover:text-amber-300" : ""}`}
          onClick={() => onChange?.(s)}
        />
      ))}
    </div>
  );

  const RefForm = ({ data, setData }: { data: Partial<Ref>; setData: (d: any) => void }) => (
    <div className="space-y-3">
      <div><Label>Título *</Label><Input value={data.titulo || ""} onChange={e => setData({ ...data, titulo: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={data.tipo || "criativo"} onValueChange={v => setData({ ...data, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Plataforma</Label>
          <Select value={data.plataforma || "none"} onValueChange={v => setData({ ...data, plataforma: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {PLATAFORMAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Projeto</Label>
          <Select value={data.project_id || "none"} onValueChange={v => setData({ ...data, project_id: v === "none" ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Pasta</Label>
          <div className="flex gap-1">
            <Input
              value={data.pasta || ""}
              onChange={e => setData({ ...data, pasta: e.target.value || undefined })}
              placeholder={currentFolderPath ? `${currentFolderPath}/...` : "Ex: Anúncios/Meta"}
              className="flex-1"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Use "/" para criar subpastas</p>
        </div>
      </div>
      <div><Label>Produto</Label><Input value={data.produto || ""} onChange={e => setData({ ...data, produto: e.target.value })} placeholder="Ex: Curso X, Mentoria Y..." /></div>
      <div><Label>URL</Label><Input value={data.url || ""} onChange={e => setData({ ...data, url: e.target.value })} placeholder="https://..." /></div>
      <div>
        <Label>Mídia (imagem ou vídeo)</Label>
        <div className="flex items-center gap-2">
          <Input
            value={data.image_url || data.url || ""}
            onChange={e => {
              const v = e.target.value;
              if (isVideoUrl(v)) setData({ ...data, url: v, image_url: "", tipo: "video" });
              else setData({ ...data, image_url: v });
            }}
            placeholder="URL da imagem ou vídeo..."
            className="flex-1"
          />
          <FileUpload
            bucket="project-media"
            path="referencias"
            accept="image/*,video/*"
            onUpload={url => {
              if (isVideoUrl(url)) setData({ ...data, url, image_url: "", tipo: "video" });
              else setData({ ...data, image_url: url });
            }}
            label="Upload"
          />
        </div>
        {(() => {
          const media = data.url && isVideoUrl(data.url) ? data.url : (data.image_url && isVideoUrl(data.image_url) ? data.image_url : data.image_url);
          if (!media) return null;
          return isVideoUrl(media)
            ? <video src={media} controls muted className="mt-2 max-h-40 rounded border border-border" />
            : <img src={media} alt="preview" className="mt-2 max-h-40 rounded border border-border object-contain" />;
        })()}
      </div>
      <div><Label>Score</Label><ScoreStars score={data.score || 0} onChange={s => setData({ ...data, score: s })} /></div>
      <div><Label>Tags</Label><EditableTagList tags={data.tags || []} onChange={tags => setData({ ...data, tags })} /></div>
      <div><Label>Notas</Label><Textarea value={data.notas || ""} onChange={e => setData({ ...data, notas: e.target.value })} className="min-h-[80px]" /></div>
    </div>
  );

  /** Render a thumbnail area — handles images, videos, and fallbacks */
  const renderThumb = (r: Ref, height: string = "h-36") => {
    const style = TIPO_STYLES[r.tipo || "criativo"] || TIPO_STYLES.criativo;
    const Icon = style.icon;
    const isLib = r.source === "library";

    // Has a displayable image
    if (r.image_url && !isVideoUrl(r.image_url)) {
      return (
        <div className={`${height} bg-secondary overflow-hidden relative`}>
          <img
            src={r.image_url}
            alt={r.titulo}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          {r.url ? (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
              title="Abrir link original"
            >
              <ExternalLink className="h-5 w-5 text-white drop-shadow-lg" />
            </a>
          ) : (
            <button
              className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); setLightboxUrl(r.image_url!); }}
            >
              <ExternalLink className="h-5 w-5 text-white drop-shadow-lg" />
            </button>
          )}
          {isLib && (
            <button
              className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
              title="Salvar como Referência"
              onClick={(e) => { e.stopPropagation(); saveAsRef(r); }}
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      );
    }

    // Video file — show video element or play icon
    if (r.is_video && (r.url || r.image_url)) {
      const videoSrc = r.url || r.image_url;
      return (
        <div className={`${height} bg-secondary overflow-hidden relative`}>
          <video
            src={videoSrc}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
            onMouseOver={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
            onMouseOut={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 rounded-full p-2">
              <Play className="h-5 w-5 text-white fill-white" />
            </div>
          </div>
          {isLib && (
            <button
              className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
              title="Salvar como Referência"
              onClick={(e) => { e.stopPropagation(); saveAsRef(r); }}
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      );
    }

    // Fallback gradient — clickable when a URL exists
    const fallback = (
      <div className={`${height} bg-gradient-to-br ${style.gradient} flex flex-col items-center justify-center gap-2`}>
        <Icon className="h-10 w-10 text-muted-foreground/20" />
        {r.url && <span className="text-[10px] text-primary/70 flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Abrir link</span>}
      </div>
    );
    if (r.url) {
      return (
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block hover:opacity-90 transition-opacity"
        >
          {fallback}
        </a>
      );
    }
    return fallback;
  };

  const renderCard = (r: Ref, i: number) => {
    const style = TIPO_STYLES[r.tipo || "criativo"] || TIPO_STYLES.criativo;
    const catMeta = r.content_category ? CATEGORY_META[r.content_category] : null;
    const isLib = r.source === "library";

    return (
      <Card
        key={r.id}
        className={`bg-card border-border border-l-4 ${style.border} hover:scale-[1.02] cursor-pointer transition-all duration-200 group overflow-hidden animate-fade-in`}
        style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
        onClick={() => isLib ? setLightboxUrl(r.image_url || r.url || null) : setEditing({ ...r })}
      >
        {renderThumb(r)}
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm line-clamp-2">{r.titulo}</h3>
            {!isLib && (
              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" onClick={e => { e.stopPropagation(); deleteRef(r.id); }}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {isLib && (
              <Badge className="text-[9px] border bg-sky-500/15 text-sky-400 border-sky-500/30">📂 Projeto</Badge>
            )}
            {catMeta && (
              <Badge className={`text-[9px] border ${catMeta.color}`}>{catMeta.label}</Badge>
            )}
            {!isLib && r.tipo && <Badge className={`text-[9px] border ${style.badge}`}>{r.tipo.replace("_", " ")}</Badge>}
            {r.plataforma && <Badge variant="outline" className="text-[9px]">{r.plataforma}</Badge>}
            {r.pasta && <Badge variant="outline" className="text-[9px]">📁 {r.pasta}</Badge>}
            {r.produto && <Badge variant="outline" className="text-[9px]">📦 {r.produto}</Badge>}
          </div>
          {r.score && r.score > 0 && <ScoreStars score={r.score} />}
          {r.tags && r.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {r.tags.slice(0, 3).map(t => (
                <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{t}</span>
              ))}
              {r.tags.length > 3 && <span className="text-[9px] text-muted-foreground">+{r.tags.length - 3}</span>}
            </div>
          )}
          {r.project_id && <p className="text-[10px] text-muted-foreground">📁 {r.project_name || projectName(r.project_id)}</p>}
          {r.notas && <p className="text-[10px] text-muted-foreground/70 line-clamp-2">{r.notas}</p>}
          {r.url && !isLib && (
            <a href={r.url} target="_blank" rel="noopener" className="text-[10px] text-primary hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <ExternalLink className="h-2.5 w-2.5" /> Abrir link
            </a>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderListRow = (r: Ref) => {
    const style = TIPO_STYLES[r.tipo || "criativo"] || TIPO_STYLES.criativo;
    const catMeta = r.content_category ? CATEGORY_META[r.content_category] : null;
    const isLib = r.source === "library";

    return (
      <div
        key={r.id}
        className={`flex items-center gap-3 p-2 rounded-lg border border-border border-l-4 ${style.border} hover:bg-secondary/50 cursor-pointer transition-colors group`}
        onClick={() => isLib ? setLightboxUrl(r.image_url || r.url || null) : setEditing({ ...r })}
      >
        {r.image_url && !isVideoUrl(r.image_url) ? (
          <img src={r.image_url} alt="" className="h-10 w-14 rounded object-cover shrink-0" />
        ) : r.is_video ? (
          <div className="h-10 w-14 rounded bg-secondary flex items-center justify-center shrink-0">
            <Play className="h-4 w-4 text-violet-400" />
          </div>
        ) : (
          <div className={`h-10 w-14 rounded bg-gradient-to-br ${style.gradient} flex items-center justify-center shrink-0`}>
            {(() => { const Icon = style.icon; return <Icon className="h-4 w-4 text-muted-foreground/30" />; })()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{r.titulo}</p>
          <div className="flex gap-1 items-center flex-wrap">
            {isLib && <Badge className="text-[8px] border bg-sky-500/15 text-sky-400 border-sky-500/30">Projeto</Badge>}
            {catMeta && <Badge className={`text-[8px] border ${catMeta.color}`}>{catMeta.label}</Badge>}
            {!isLib && r.tipo && <Badge className={`text-[8px] border ${style.badge}`}>{r.tipo.replace("_", " ")}</Badge>}
            {r.plataforma && <Badge variant="outline" className="text-[8px]">{r.plataforma}</Badge>}
            {r.project_id && <span className="text-[9px] text-muted-foreground">📁 {r.project_name || projectName(r.project_id)}</span>}
            {r.pasta && <span className="text-[9px] text-muted-foreground">📂 {r.pasta}</span>}
            {r.produto && <span className="text-[9px] text-muted-foreground">📦 {r.produto}</span>}
          </div>
        </div>
        {r.score && r.score > 0 && <ScoreStars score={r.score} />}
        {r.tags && r.tags.length > 0 && (
          <div className="flex gap-1 shrink-0">
            {r.tags.slice(0, 2).map(t => (
              <span key={t} className="text-[8px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{t}</span>
            ))}
          </div>
        )}
        {isLib && (
          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0" title="Salvar como Referência" onClick={e => { e.stopPropagation(); saveAsRef(r); }}>
            <BookmarkPlus className="h-3 w-3 text-primary" />
          </Button>
        )}
        {!isLib && (
          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0" onClick={e => { e.stopPropagation(); deleteRef(r.id); }}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        )}
      </div>
    );
  };

  const grouped = groupedByProject();

  // Folder card component
  const FolderCard = ({ name }: { name: string }) => {
    const fullPath = currentFolderPath ? `${currentFolderPath}/${name}` : name;
    const itemCount = refsWithPath.filter(r => r._vpath === fullPath || r._vpath?.startsWith(fullPath + "/")).length;
    const canRename = fullPath.split("/").length >= 2;
    return (
      <Card
        className="bg-card border-border hover:bg-secondary/50 cursor-pointer transition-all duration-200 group"
        onClick={() => setCurrentFolder([...currentFolder, name])}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <FolderOpen className="h-8 w-8 text-amber-400" />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{name}</h3>
            <p className="text-[10px] text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "itens"}</p>
          </div>
          {canRename && (
            <button
              onClick={(e) => { e.stopPropagation(); startRename(fullPath); }}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition p-1"
              title="Renomear pasta"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </CardContent>
      </Card>
    );
  };


  // Build a hierarchical tree from flat virtual paths
  type FolderNode = { name: string; path: string; children: FolderNode[]; count: number };
  const buildFolderTree = (): FolderNode[] => {
    const root: FolderNode[] = [];
    const byPath = new Map<string, FolderNode>();
    const sorted = [...allPastas].sort();
    for (const fullPath of sorted) {
      const segments = fullPath.split("/").filter(Boolean);
      let parentArr = root;
      let acc = "";
      for (const seg of segments) {
        acc = acc ? `${acc}/${seg}` : seg;
        let node = byPath.get(acc);
        if (!node) {
          node = { name: seg, path: acc, children: [], count: 0 };
          byPath.set(acc, node);
          parentArr.push(node);
        }
        parentArr = node.children;
      }
    }
    const countItems = (path: string) =>
      refsWithPath.filter(r => matchesNonFolder(r) && (r._vpath === path || r._vpath?.startsWith(path + "/"))).length;
    byPath.forEach(n => { n.count = countItems(n.path); });

    return root;
  };
  const folderTree = buildFolderTree();
  const rootCount = refs.length;

  const navigateToFolder = (path: string) => {
    setCurrentFolder(path ? path.split("/") : []);
    setFilterPasta("all");
  };

  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);

  const startRename = (path: string) => {
    const segs = path.split("/");
    if (segs.length < 2) {
      toast.error("Renomeie o projeto na página Projetos");
      return;
    }
    setRenamingPath(path);
    setRenameDraft(segs[segs.length - 1]);
  };

  const renameFolder = async (oldPath: string, rawName: string) => {
    const newName = rawName.trim().replace(/\//g, "");
    if (!newName) { toast.error("Nome inválido"); return; }
    const segs = oldPath.split("/");
    if (segs.length < 2) { toast.error("Não é possível renomear o projeto aqui"); return; }
    if (newName === segs[segs.length - 1]) { setRenamingPath(null); return; }

    const parentPath = segs.slice(0, -1).join("/");
    const newPath = `${parentPath}/${newName}`;

    // Duplicate sibling check
    if (allPastas.some(p => p === newPath || p.startsWith(newPath + "/"))) {
      toast.error("Já existe uma pasta com esse nome");
      return;
    }

    // oldSub / newSub are the parts under the project (pasta column doesn't include project)
    const oldSub = segs.slice(1).join("/");
    const newSub = [...segs.slice(1, -1), newName].join("/");

    const affected = refsWithPath.filter(r =>
      r._vpath === oldPath || r._vpath?.startsWith(oldPath + "/")
    );
    const manualAffected = affected.filter(r => r.source === "manual");
    const nonManualCount = affected.length - manualAffected.length;

    if (manualAffected.length === 0) {
      toast.error(
        nonManualCount > 0
          ? "Essa pasta só tem itens de Projetos/Ads — não podem ser renomeados aqui"
          : "Nenhuma referência manual encontrada"
      );
      return;
    }

    setRenaming(true);
    try {
      const updates = manualAffected.map(r => {
        let nextPasta: string;
        if (r.pasta) {
          // r.pasta starts with oldSub or equals oldSub
          const rest = r.pasta.slice(oldSub.length);
          nextPasta = newSub + rest;
        } else {
          // virtual path — materialize as real pasta under project
          const vRest = (r._vpath || "").slice(oldPath.length); // "" or "/..."
          nextPasta = newSub + vRest;
        }
        return supabase.from("imphq_referencias").update({ pasta: nextPasta }).eq("id", r.id);
      });
      const results = await Promise.all(updates);
      const errors = results.filter((r: any) => r.error).length;
      if (errors > 0) {
        toast.error(`${errors} erros ao renomear`);
      } else {
        toast.success(
          nonManualCount > 0
            ? `${manualAffected.length} ref(s) renomeadas. ${nonManualCount} de Projetos/Ads mantidas no agrupamento original.`
            : `${manualAffected.length} ref(s) renomeadas`
        );
      }
      // Adjust currentFolder if we renamed inside it
      if (currentFolderPath === oldPath) {
        setCurrentFolder(newPath.split("/"));
      } else if (currentFolderPath.startsWith(oldPath + "/")) {
        setCurrentFolder((newPath + currentFolderPath.slice(oldPath.length)).split("/"));
      }
      setRenamingPath(null);
      // Rename any empty-folder entries (the path itself and any nested ones)
      const toRename = emptyFolders.filter(p => p === oldPath || p.startsWith(oldPath + "/"));
      for (const p of toRename) {
        await renameEmptyFolder(p, newPath + p.slice(oldPath.length));
      }
      await load();
    } finally {
      setRenaming(false);
    }
  };


  const FolderTreeNode = ({ node, level }: { node: FolderNode; level: number }) => {
    const isActive = currentFolderPath === node.path && filterPasta === "all";
    const isExpanded = expandedFolders.has(node.path);
    const hasChildren = node.children.length > 0;
    return (
      <div>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors ${
            isActive ? "bg-primary/15 text-primary" : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
          }`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleFolderExpanded(node.path); }}
              className="p-0.5 hover:bg-secondary rounded shrink-0"
              aria-label={isExpanded ? "Recolher" : "Expandir"}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          {renamingPath === node.path ? (
            <div className="flex-1 flex items-center gap-1 min-w-0">
              {isActive ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400/70" />}
              <input
                autoFocus
                value={renameDraft}
                disabled={renaming}
                onChange={e => setRenameDraft(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === "Enter") renameFolder(node.path, renameDraft);
                  if (e.key === "Escape") setRenamingPath(null);
                }}
                className="flex-1 min-w-0 h-5 px-1 rounded bg-background border border-primary/40 text-xs focus:outline-none"
              />
              <button onClick={(e) => { e.stopPropagation(); renameFolder(node.path, renameDraft); }} disabled={renaming} className="h-4 w-4 inline-flex items-center justify-center text-emerald-400 shrink-0">
                {renaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); setRenamingPath(null); }} disabled={renaming} className="h-4 w-4 inline-flex items-center justify-center text-red-400 shrink-0">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigateToFolder(node.path)}
              className="flex-1 flex items-center gap-1.5 min-w-0 text-left group/node"
            >
              {isActive ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400/70" />}
              <span className="truncate flex-1">{node.name}</span>
              {level > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); startRename(node.path); }}
                  className="opacity-0 group-hover/node:opacity-60 hover:!opacity-100 transition shrink-0"
                  title="Renomear"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
              )}
              <span className="text-[9px] opacity-60 shrink-0">{node.count}</span>
            </button>
          )}

        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => (
              <FolderTreeNode key={child.path} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const FolderSidebar = () => (
    <aside className="w-60 shrink-0 border-r border-border bg-card/30 rounded-lg flex flex-col max-h-[calc(100vh-8rem)] sticky top-4">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5">
          <FolderOpen className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold">Pastas</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleSidebar} title="Ocultar painel">
          <PanelLeftClose className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        <button
          onClick={() => navigateToFolder("")}
          className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
            currentFolder.length === 0 && filterPasta === "all"
              ? "bg-primary/15 text-primary"
              : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="w-4 shrink-0" />
          <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400/70" />
          <span className="flex-1 text-left">Raiz</span>
          <span className="text-[9px] opacity-60">{rootCount}</span>
        </button>
        {folderTree.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/60 px-2 py-3 text-center">Nenhuma pasta criada</p>
        ) : (
          folderTree.map(node => <FolderTreeNode key={node.path} node={node} level={0} />)
        )}
      </div>
      <div className="p-2 border-t border-border">
        <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setShowNewPasta(true)}>
          <FolderPlus className="h-3 w-3 mr-1" /> Nova pasta
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="flex gap-4 animate-fade-in">
      {!sidebarHidden && <FolderSidebar />}
      <div className="flex-1 min-w-0 space-y-6">
        {sidebarHidden && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={toggleSidebar}>
            <PanelLeft className="h-3.5 w-3.5 mr-1" /> Mostrar pastas
          </Button>
        )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">🗂️ Referências <SectionInfo {...sectionHelpTexts.referencias} /></h1>
          <p className="text-sm text-muted-foreground mt-1">
            {refs.length} referências — {manualCount} manuais · {libraryCount} de projetos · {adsCount} de ads
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              try {
                await load();
                toast.success("Referências atualizadas!");
              } finally {
                setSyncing(false);
              }
            }}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Atualizar"}
          </Button>
          <FileUpload
            bucket="project-media"
            path="referencias"
            accept="image/*,video/*"
            onUpload={url => handleBulkUpload([url])}
            onUploadMultiple={handleBulkUpload}
            label="Upload Múltiplo"
            multiple
          />
          <Button size="sm" onClick={() => {
            setForm({ titulo: "", tipo: "criativo", tags: [], pasta: currentFolderPath || undefined });
            setShowNew(true);
          }}><Plus className="h-4 w-4 mr-1" /> Nova Referência</Button>
        </div>
      </div>

      {/* Origin filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: "all" as const, label: "Todos", count: refs.length },
          { key: "manual" as const, label: "Minhas Refs", count: manualCount },
          { key: "library" as const, label: "Projetos", count: libraryCount },
          { key: "ads" as const, label: "📊 Ads", count: adsCount },
        ]).map(o => (
          <button
            key={o.key}
            onClick={() => { setFilterOrigem(o.key); if (o.key !== "library") setFilterCategory("all"); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              filterOrigem === o.key
                ? "bg-primary/15 text-primary border-primary/30"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {o.label}
            <span className="text-[10px] opacity-70">({o.count})</span>
          </button>
        ))}

        {(filterOrigem === "library" || filterOrigem === "all") && categories.length > 0 && (
          <>
            <span className="text-muted-foreground/30">|</span>
            {categories.map(cat => {
              const meta = CATEGORY_META[cat] || { label: cat, color: "text-muted-foreground bg-secondary border-border" };
              const count = refs.filter(r => r.source === "library" && r.content_category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    filterCategory === cat
                      ? `${meta.color} border-current`
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  {meta.label}
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Type counters */}
      {filterOrigem !== "library" && (
        <div className="flex items-center gap-2 flex-wrap">
          {TIPOS.map(t => {
            const style = TIPO_STYLES[t];
            const Icon = style.icon;
            const count = typeCounts[t] || 0;
            return (
              <button
                key={t}
                onClick={() => setFilterTipo(filterTipo === t ? "all" : t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  filterTipo === t
                    ? `${style.badge} border-current`
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                <Icon className="h-3 w-3" />
                <span className="capitalize">{t.replace("_", " ")}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 py-2 -mx-1 px-1 border-b border-border/40">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Buscar..." className="pl-9 bg-secondary" />
        </div>
        <Select value={filterPlat} onValueChange={setFilterPlat}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Plataforma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Plataformas</SelectItem>
            {PLATAFORMAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {filterOrigem !== "library" && (
          <Select value={filterPasta} onValueChange={v => { setFilterPasta(v); if (v !== "all") setCurrentFolder([]); }}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Pasta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Pastas</SelectItem>
              {allPastas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowNewPasta(true)} title="Nova pasta">
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
        <div className="flex border border-border rounded-md overflow-hidden">
          <button onClick={() => setViewMode("grid")} className={`p-1.5 ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setViewMode("list")} className={`p-1.5 ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
        <Badge variant="outline" className="text-xs">{filtered.length} refs</Badge>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Breadcrumb navigation */}
      {currentFolder.length > 0 && filterPasta === "all" && (
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => setCurrentFolder([])} className="text-primary hover:underline flex items-center gap-1">
            <Folder className="h-3.5 w-3.5" /> Raiz
          </button>
          {currentFolder.map((segment, idx) => (
            <span key={idx} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button
                onClick={() => setCurrentFolder(currentFolder.slice(0, idx + 1))}
                className={idx === currentFolder.length - 1 ? "font-medium text-foreground" : "text-primary hover:underline"}
              >
                {segment}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Subfolder cards */}
      {filterPasta === "all" && subfolders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {subfolders.map(name => (
            <FolderCard key={name} name={name} />
          ))}
        </div>
      )}

      {viewMode === "grid" ? (
        grouped ? (
          <div className="space-y-8">
            {Object.entries(grouped.groups).sort(([a], [b]) => a.localeCompare(b)).map(([projName, items]) => (
              <div key={projName}>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                  <span className="text-lg">📁</span>
                  <h2 className="font-semibold text-sm">{projName}</h2>
                  <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.map((r, i) => renderCard(r, i))}
                </div>
              </div>
            ))}
            {grouped.noProject.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                  <span className="text-lg">📋</span>
                  <h2 className="font-semibold text-sm">Sem Projeto</h2>
                  <Badge variant="outline" className="text-[10px]">{grouped.noProject.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {grouped.noProject.map((r, i) => renderCard(r, i))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((r, i) => renderCard(r, i))}
            {filtered.length === 0 && subfolders.length === 0 && (
              <div className="col-span-full text-center py-12 space-y-2">
                <Image className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhuma referência encontrada</p>
                <Button size="sm" variant="outline" onClick={() => setShowNew(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Criar primeira</Button>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="space-y-1">
          {filtered.map(r => renderListRow(r))}
          {filtered.length === 0 && subfolders.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <Image className="h-10 w-10 text-muted-foreground/20 mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhuma referência encontrada</p>
              <Button size="sm" variant="outline" onClick={() => setShowNew(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Criar primeira</Button>
            </div>
          )}
        </div>
      )}

      {/* New Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Referência</DialogTitle></DialogHeader>
          <RefForm data={form} setData={setForm} />
          <DialogFooter><Button onClick={createRef}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.source === "library" ? "Visualizar" : "Editar"} Referência</DialogTitle></DialogHeader>
          {editing && editing.image_url && !isVideoUrl(editing.image_url) && (
            <button onClick={() => setLightboxUrl(editing.image_url!)} className="w-full rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity">
              <img src={editing.image_url} alt={editing.titulo} className="w-full max-h-48 object-cover" />
            </button>
          )}
          {editing && editing.is_video && (editing.url || editing.image_url) && (
            <>
              <video
                src={editing.url || editing.image_url}
                controls
                className="w-full max-h-48 rounded-lg border border-border"
              />
              {editing.source === "manual" && (
                <TranscriptionBlock
                  refItem={editing}
                  onChange={(patch) => setEditing({ ...editing, ...patch } as any)}
                />
              )}
            </>
          )}
          {editing && editing.source === "library" ? (
            <div className="space-y-3">
              <p className="text-sm"><strong>Título:</strong> {editing.titulo}</p>
              {editing.project_name && <p className="text-sm"><strong>Projeto:</strong> {editing.project_name}</p>}
              {editing.content_category && <p className="text-sm"><strong>Categoria:</strong> {CATEGORY_META[editing.content_category]?.label || editing.content_category}</p>}
              {editing.notas && <p className="text-sm"><strong>Descrição:</strong> {editing.notas}</p>}
              {editing.tags && editing.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {editing.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Este item é gerenciado na aba Mídia do projeto.</p>
            </div>
          ) : (
            editing && <RefForm data={editing} setData={setEditing} />
          )}
          <DialogFooter className="flex justify-between">
            {editing?.source === "library" ? (
              <Button onClick={() => { if (editing) saveAsRef(editing); setEditing(null); }}>
                <BookmarkPlus className="h-4 w-4 mr-1" /> Salvar como Referência
              </Button>
            ) : (
              <>
                <Button variant="destructive" size="sm" onClick={() => editing && deleteRef(editing.id)}><Trash2 className="h-3 w-3 mr-1" /> Excluir</Button>
                <div className="flex gap-2">
                  {editing?.url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!editing?.url) return;
                        toast.info("Buscando preview...");
                        await fetchLinkPreview(editing.id, editing.url, { forceTitle: false });
                        toast.success("Preview atualizado (se disponível)");
                      }}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" /> Buscar preview
                    </Button>
                  )}
                  <Button onClick={saveEdit}>Salvar</Button>
                </div>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] p-2 bg-black/95 border-border">
          {lightboxUrl && (
            isVideoUrl(lightboxUrl) ? (
              <video src={lightboxUrl} controls autoPlay className="w-full max-h-[90vh] rounded" />
            ) : (
              <img src={lightboxUrl} alt="Referência" className="w-full h-full object-contain max-h-[90vh] rounded" />
            )
          )}
        </DialogContent>
      </Dialog>

      {/* New Pasta Dialog */}
      <Dialog open={showNewPasta} onOpenChange={setShowNewPasta}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Pasta</DialogTitle></DialogHeader>
          <div>
            <Label>Nome da pasta</Label>
            <Input
              value={newPastaName}
              onChange={e => setNewPastaName(e.target.value)}
              placeholder={currentFolderPath ? `Subpasta em "${currentFolderPath}"` : "Ex: Anúncios/Meta Jan"}
            />
            <p className="text-[10px] text-muted-foreground mt-1">Use "/" para criar hierarquia. Ex: "Anúncios/Meta/Janeiro"</p>
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              const name = newPastaName.trim().replace(/^\/+|\/+$/g, "");
              if (!name) { toast.error("Nome obrigatório"); return; }
              // Full virtual path includes project segment (matches getVirtualPath)
              let fullVPath: string;
              let pastaForRefs: string; // value to store in imphq_referencias.pasta (without project)
              if (currentFolderPath) {
                fullVPath = `${currentFolderPath}/${name}`;
                const segs = currentFolderPath.split("/");
                pastaForRefs = [...segs.slice(1), name].join("/");
              } else {
                const projSeg = filterProject !== "all"
                  ? (projects.find(p => p.id === filterProject)?.name || "Projeto")
                  : "Sem Projeto";
                fullVPath = `${projSeg}/${name}`;
                pastaForRefs = name;
              }
              await addEmptyFolder(fullVPath);
              setForm(f => ({ ...f, pasta: pastaForRefs }));
              setCurrentFolder(fullVPath.split("/"));
              setFilterPasta("all");
              setShowNewPasta(false);
              setNewPastaName("");
              toast.success(`Pasta "${fullVPath}" criada!`);
            }}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
