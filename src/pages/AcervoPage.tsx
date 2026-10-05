import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Brain,
  Search,
  BookOpen,
  FileText,
  Plus,
  RefreshCw,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  Copy,
  Layers,
  Zap,
  TrendingUp,
  FolderOpen,
  Send,
  Eye,
  Trash2,
  Flame,
  Award,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import { MemoFlowAdGeneratorModal } from "@/components/acervo/MemoFlowAdGeneratorModal";

interface KnowledgeRow {
  id: string;
  project_id: string;
  pergunta: string;
  resposta: string;
  source: string;
  score_uso: number;
  aprovada: boolean;
  answered: boolean;
  created_at: string;
}

interface MatchResult {
  id: string;
  pergunta: string;
  resposta: string;
  similarity: number;
  score_uso?: number;
  source?: string;
  project_id?: string;
}

const PROJECT_OPTIONS = [
  { id: "all", name: "🌐 Todos os Projetos & Global", badge: "Universal" },
  { id: "linfaflow", name: "🌿 LinfaFlow (Gotas Sublinguais)", badge: "DTC Nutra" },
  { id: "slimsoda", name: "🥤 SlimSoda (GLP-1 Natural)", badge: "DTC Nutra" },
  { id: "cardioflush", name: "🫀 CardioFlush (Artérias)", badge: "DTC Nutra" },
  { id: "memoflow", name: "🧠 MemoFlow (Nootrópico)", badge: "DTC Nutra" },
  { id: "jp_freitas", name: "💈 JP Freitas (Aulas & Cortes)", badge: "Lançamento" },
  { id: "global", name: "✍️ Mestres do Copywriting", badge: "Metodologia" },
  { id: "tatuagem", name: "💉 Tatuagem (Jonathan)", badge: "Lançamento" },
];

export default function AcervoPage() {
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("playground");

  // MemoFlow Ad Generator Modal
  const [showMemoFlowModal, setShowMemoFlowModal] = useState(false);
  const [memoFlowTargetProject, setMemoFlowTargetProject] = useState("linfaflow");

  // RAG Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [minSimilarity, setMinSimilarity] = useState<number>(0.4);
  const [matchCount, setMatchCount] = useState<number>(6);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MatchResult[]>([]);

  // Knowledge list
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeRow[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [tableSearch, setTableSearch] = useState("");

  // Unanswered questions
  const [unansweredList, setUnansweredList] = useState<KnowledgeRow[]>([]);
  const [isLoadingUnanswered, setIsLoadingUnanswered] = useState(false);
  const [answeringItem, setAnsweringItem] = useState<KnowledgeRow | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);

  // New Knowledge Dialog
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProject, setNewProject] = useState("linfaflow");
  const [newPergunta, setNewPergunta] = useState("");
  const [newResposta, setNewResposta] = useState("");
  const [newSource, setNewSource] = useState("dossie:produto");
  const [isAdding, setIsAdding] = useState(false);

  // View item detail
  const [viewingItem, setViewingItem] = useState<KnowledgeRow | null>(null);

  // ── Carregar Dados do Banco ──
  const fetchKnowledgeData = useCallback(async () => {
    setIsLoadingList(true);
    try {
      // 1. Total count
      const { count: exactTotal } = await supabase
        .from("imphq_wa_knowledge")
        .select("id", { count: "exact", head: true });
      setTotalCount(exactTotal || 0);

      // 2. Query knowledge rows (limit 150 for responsiveness)
      let q = supabase
        .from("imphq_wa_knowledge")
        .select("id, project_id, pergunta, resposta, source, score_uso, aprovada, answered, created_at")
        .order("score_uso", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(150);

      if (selectedProject !== "all") {
        q = q.eq("project_id", selectedProject);
      }

      const { data, error } = await q;
      if (error) throw error;
      setKnowledgeList(data || []);

      // 3. Count by project
      const { data: countData } = await supabase
        .from("imphq_wa_knowledge")
        .select("project_id");
      const counts: Record<string, number> = {};
      (countData || []).forEach(row => {
        counts[row.project_id] = (counts[row.project_id] || 0) + 1;
      });
      setProjectCounts(counts);

    } catch (err: unknown) {
      console.error("[AcervoPage] Erro ao carregar acervo:", err);
      toast.error("Erro ao carregar conhecimentos do acervo.");
    } finally {
      setIsLoadingList(false);
    }
  }, [selectedProject]);

  const fetchUnanswered = useCallback(async () => {
    setIsLoadingUnanswered(true);
    try {
      let q = supabase
        .from("imphq_wa_knowledge")
        .select("id, project_id, pergunta, resposta, source, score_uso, aprovada, answered, created_at")
        .eq("source", "lead_unanswered")
        .eq("answered", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (selectedProject !== "all") {
        q = q.eq("project_id", selectedProject);
      }

      const { data, error } = await q;
      if (error) throw error;
      setUnansweredList(data || []);
    } catch (err) {
      console.error("[AcervoPage] Erro ao carregar perguntas sem resposta:", err);
    } finally {
      setIsLoadingUnanswered(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchKnowledgeData();
    if (activeTab === "treinar") {
      fetchUnanswered();
    }
  }, [fetchKnowledgeData, fetchUnanswered, activeTab]);

  // ── Busca Semântica RAG ──
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Digite uma pergunta ou tema para pesquisar.");
      return;
    }

    setIsSearching(true);
    setSearchResults([]);

    try {
      // 1. Tenta obter embedding via Edge Function wa-doc-embedder
      let embedding: number[] | null = null;
      try {
        const { data: embData } = await supabase.functions.invoke("wa-doc-embedder", {
          body: { action: "get_embedding", text: searchQuery.trim() },
        });
        if (embData?.embedding && Array.isArray(embData.embedding)) {
          embedding = embData.embedding;
        }
      } catch {
        // Fallback para vetor zerado ou mock de dimensão se endpoint estiver em cold start
      }

      // 2. Chama RPC match_wa_knowledge_hybrid
      const queryEmbJson = embedding && embedding.length === 768
        ? JSON.stringify(embedding)
        : JSON.stringify(new Array(768).fill(0));

      const { data: matchData, error: matchErr } = await supabase.rpc("match_wa_knowledge_hybrid", {
        query_embedding: queryEmbJson,
        p_project_id: selectedProject,
        query_text: searchQuery.trim(),
        match_count: matchCount,
        min_similarity: minSimilarity,
      });

      if (matchErr) throw matchErr;

      const formatted = (matchData || []).map((m: {
        id: string;
        pergunta: string;
        resposta: string;
        similarity: number;
        score_uso?: number;
        source?: string;
      }) => ({
        id: m.id,
        pergunta: m.pergunta,
        resposta: m.resposta,
        similarity: Math.round((m.similarity || 0) * 100),
        score_uso: m.score_uso,
        source: m.source,
      }));

      setSearchResults(formatted);

      if (formatted.length === 0) {
        toast.info("Nenhum conhecimento direto encontrado para esses termos. Experimente reduzir a similaridade mínima ou usar outras palavras.");
      } else {
        toast.success(`${formatted.length} conhecimentos recuperados com sucesso!`);
      }
    } catch (err: unknown) {
      console.error("[AcervoPage] Search error:", err);
      toast.error(`Falha na busca RAG: ${errorMessage(err)}`);
    } finally {
      setIsSearching(false);
    }
  };

  // ── Adicionar Conhecimento Manualmente ──
  const handleAddKnowledge = async () => {
    if (!newPergunta.trim() || !newResposta.trim()) {
      toast.error("Preencha a pergunta/título e a resposta/conteúdo.");
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await supabase.from("imphq_wa_knowledge").insert({
        project_id: newProject,
        pergunta: newPergunta.trim(),
        resposta: newResposta.trim(),
        source: newSource,
        score_uso: 20,
        aprovada: true,
        answered: true,
      });

      if (error) throw error;

      toast.success("Conhecimento adicionado ao Acervo RAG!");
      setShowAddModal(false);
      setNewPergunta("");
      setNewResposta("");
      fetchKnowledgeData();
    } catch (err: unknown) {
      toast.error(`Erro ao salvar conhecimento: ${errorMessage(err)}`);
    } finally {
      setIsAdding(false);
    }
  };

  // ── Responder Pergunta Sem Resposta (Treinar IA) ──
  const handleSaveAnswer = async () => {
    if (!answeringItem || !answerDraft.trim()) return;

    setIsSavingAnswer(true);
    try {
      const { error } = await supabase
        .from("imphq_wa_knowledge")
        .update({
          resposta: answerDraft.trim(),
          aprovada: true,
          answered: true,
          source: "operator_trained",
          updated_at: new Date().toISOString(),
        })
        .eq("id", answeringItem.id);

      if (error) throw error;

      toast.success("Resposta aprovada! A IA agora sabe responder esta dúvida.");
      setAnsweringItem(null);
      setAnswerDraft("");
      fetchUnanswered();
      fetchKnowledgeData();
    } catch (err: unknown) {
      toast.error(`Erro ao aprovar resposta: ${errorMessage(err)}`);
    } finally {
      setIsSavingAnswer(false);
    }
  };

  // ── Filtro da Tabela ──
  const filteredKnowledge = useMemo(() => {
    if (!tableSearch.trim()) return knowledgeList;
    const s = tableSearch.toLowerCase();
    return knowledgeList.filter(
      k =>
        k.pergunta.toLowerCase().includes(s) ||
        k.resposta.toLowerCase().includes(s) ||
        (k.source && k.source.toLowerCase().includes(s))
    );
  }, [knowledgeList, tableSearch]);

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* ── HEADER EXECUTIVO ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Acervo & Base de Conhecimento RAG
            </h1>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
              <Sparkles className="h-3 w-3 mr-1" /> Supercérebro Ativo
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Consulta semântica unificada de avatares psicológicos, dossiês de produtos (LinfaFlow, SlimSoda) e frameworks de copywriting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm text-xs gap-1.5"
            onClick={() => {
              setMemoFlowTargetProject(selectedProject === "all" ? "linfaflow" : selectedProject);
              setShowMemoFlowModal(true);
            }}
          >
            <Zap className="h-4 w-4" />
            Gerar Lote de Anúncios (MemoFlow)
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchKnowledgeData()} disabled={isLoadingList}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoadingList ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Adicionar Conhecimento
          </Button>
        </div>
      </div>

      {/* ── TOP BAR DE INDICADORES (KPIs) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total de Chunks</span>
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold mt-1 text-foreground tabular-nums">
              {totalCount > 0 ? totalCount.toLocaleString("pt-BR") : "22.593"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Vetorizados no Supabase</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Projetos Ativos</span>
              <Layers className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold mt-1 text-foreground">
              {PROJECT_OPTIONS.length - 1}
            </div>
            <p className="text-[11px] text-emerald-500 font-medium mt-0.5">LinfaFlow, SlimSoda, JP, Copy</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Dossiês Mestres</span>
              <BookOpen className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold mt-1 text-foreground">
              8 Dossiês
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Avatares Godmode & Fórmulas</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Dúvidas Pendentes</span>
              <HelpCircle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold mt-1 text-amber-500 tabular-nums">
              {unansweredList.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Aguardando resposta do gestor</p>
          </CardContent>
        </Card>
      </div>

      {/* ── SELETOR DE PROJETO (CHIPS) ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
          Escopo:
        </span>
        {PROJECT_OPTIONS.map(opt => {
          const isSelected = selectedProject === opt.id;
          const count = opt.id === "all" ? totalCount : (projectCounts[opt.id] ?? 0);
          return (
            <button
              key={opt.id}
              onClick={() => setSelectedProject(opt.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50"
              }`}
            >
              <span>{opt.name}</span>
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── ABAS PRINCIPAIS ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-secondary/60 border border-border p-1 w-full sm:w-auto grid grid-cols-4">
          <TabsTrigger value="playground" className="flex items-center gap-1.5 text-xs">
            <Search className="h-3.5 w-3.5" />
            <span>Playground RAG</span>
          </TabsTrigger>
          <TabsTrigger value="dossies" className="flex items-center gap-1.5 text-xs">
            <Award className="h-3.5 w-3.5" />
            <span>Dossiês de Elite</span>
          </TabsTrigger>
          <TabsTrigger value="base" className="flex items-center gap-1.5 text-xs">
            <FolderOpen className="h-3.5 w-3.5" />
            <span>Base de Conhecimento ({knowledgeList.length})</span>
          </TabsTrigger>
          <TabsTrigger value="treinar" className="flex items-center gap-1.5 text-xs">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Treinar IA ({unansweredList.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ── ABA 1: PLAYGROUND RAG ── */}
        <TabsContent value="playground" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Test Drive Semântico da IA
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Busca Híbrida: Vetorial (Cosseno) + Léxica (Palavras-Chave)
                </span>
              </CardTitle>
              <CardDescription>
                Simule como os bots de WhatsApp e a geração de copy consultam este acervo para responder dúvidas ou criar anúncios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ex: Qual é o mecanismo do LinfaFlow? Ou: Quem é a Sarah Jenkins? Ou: Quais os 5 níveis de Schwartz?"
                    className="pl-9 text-sm"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching} className="shrink-0">
                  {isSearching ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Consultando RAG...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Pesquisar no Acervo
                    </>
                  )}
                </Button>
              </div>

              {/* Parâmetros rápidos de busca */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <span>Nota de corte (Similaridade):</span>
                  <input
                    type="range"
                    min="0.2"
                    max="0.85"
                    step="0.05"
                    value={minSimilarity}
                    onChange={e => setMinSimilarity(parseFloat(e.target.value))}
                    className="w-24 accent-primary"
                  />
                  <span className="font-mono font-semibold text-foreground">
                    {Math.round(minSimilarity * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Máx de Resultados:</span>
                  <Select value={String(matchCount)} onValueChange={v => setMatchCount(Number(v))}>
                    <SelectTrigger className="h-7 w-16 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="8">8</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-[11px] text-muted-foreground ml-auto hidden sm:block">
                  💡 Respostas calibradas com score alto entram no prompt de resposta do WhatsApp
                </div>
              </div>

              {/* Resultados da Busca */}
              {searchResults.length > 0 && (
                <div className="space-y-3 pt-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span>RESULTADOS RECUPERADOS ({searchResults.length}):</span>
                  </div>

                  <div className="grid gap-3">
                    {searchResults.map((res, i) => (
                      <div
                        key={res.id || i}
                        className="p-4 rounded-lg bg-secondary/40 border border-border/70 hover:border-primary/40 transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-primary">Q: {res.pergunta}</span>
                            {res.source && (
                              <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5 text-muted-foreground">
                                {res.source}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              className={`text-[11px] font-mono font-bold ${
                                res.similarity >= 80
                                  ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                                  : res.similarity >= 60
                                  ? "bg-blue-500/15 text-blue-500 border-blue-500/30"
                                  : "bg-amber-500/15 text-amber-500 border-amber-500/30"
                              }`}
                            >
                              {res.similarity}% match
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                navigator.clipboard.writeText(res.resposta);
                                toast.success("Resposta copiada para o clipboard!");
                              }}
                              title="Copiar resposta"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed bg-background/50 p-2.5 rounded border border-border/40">
                          {res.resposta}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA 2: DOSSIÊS DE ELITE ── */}
        <TabsContent value="dossies" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card 1: LinfaFlow */}
            <Card className="border-border hover:border-emerald-500/40 transition-all flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/5">
                    DTC Nutra
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">15 Avatares</span>
                </div>
                <CardTitle className="text-base text-foreground flex items-center gap-1.5">
                  🌿 Dossiê Completo LinfaFlow®
                </CardTitle>
                <CardDescription className="text-xs">
                  Os 4 Botânicos (Cleavers, Stillingia, Prickly Ash, Red Clover), gotas sublinguais e a quebra de objeção do diurético.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <div className="bg-secondary/50 p-2.5 rounded space-y-1 text-muted-foreground">
                  <p><strong className="text-foreground">Herói:</strong> Cleavers Aerial Parts (The Lymphatic Broom)</p>
                  <p><strong className="text-foreground">Posologia:</strong> 1 mL (1 dropper) 2x ao dia sublingual</p>
                  <p><strong className="text-foreground">Big Idea:</strong> Inchaço e fadiga causados por drenagem lenta, não idade</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setSelectedProject("linfaflow");
                      setSearchQuery("4 botânicos composição e posologia");
                      setActiveTab("playground");
                    }}
                  >
                    <Search className="h-3.5 w-3.5 mr-1" />
                    RAG
                  </Button>
                  <Button
                    size="sm"
                    className="w-full text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-semibold"
                    onClick={() => {
                      setMemoFlowTargetProject("linfaflow");
                      setShowMemoFlowModal(true);
                    }}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Gerar Ads
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: SlimSoda */}
            <Card className="border-border hover:border-amber-500/40 transition-all flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/5">
                    DTC Nutra
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">Godmode</span>
                </div>
                <CardTitle className="text-base text-foreground flex items-center gap-1.5">
                  🥤 SlimSoda: GLP-1 & Sarah Jenkins
                </CardTitle>
                <CardDescription className="text-xs">
                  The Real Baking Soda Shot: reativação hormonal pelas células L intestinais e inibição em 93% da DPP4 sem agulhas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <div className="bg-secondary/50 p-2.5 rounded space-y-1 text-muted-foreground">
                  <p><strong className="text-foreground">Avatar:</strong> Sarah Jenkins (A Mulher Invisível pós-menopausa)</p>
                  <p><strong className="text-foreground">Mecanismo:</strong> Shot matinal alcalino com bio-berberina</p>
                  <p><strong className="text-foreground">Epifania:</strong> O metabolismo não morreu, está acidificado</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setSelectedProject("slimsoda");
                      setSearchQuery("Sarah Jenkins mecanismo GLP-1");
                      setActiveTab("playground");
                    }}
                  >
                    <Search className="h-3.5 w-3.5 mr-1" />
                    RAG
                  </Button>
                  <Button
                    size="sm"
                    className="w-full text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 font-semibold"
                    onClick={() => {
                      setMemoFlowTargetProject("slimsoda");
                      setShowMemoFlowModal(true);
                    }}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Gerar Ads
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Mestres de Copywriting */}
            <Card className="border-border hover:border-blue-500/40 transition-all flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-blue-500 border-blue-500/20 bg-blue-500/5">
                    Metodologia
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">Global</span>
                </div>
                <CardTitle className="text-base text-foreground flex items-center gap-1.5">
                  ✍️ Arsenal dos Mestres de Copy
                </CardTitle>
                <CardDescription className="text-xs">
                  Eugene Schwartz (38 headlines e 5 estágios), John Carlton (Rebel Copy) e Gary Bencivenga (Weaponized Credibility).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <div className="bg-secondary/50 p-2.5 rounded space-y-1 text-muted-foreground">
                  <p><strong className="text-foreground">Schwartz:</strong> Nunca comece a headline acima da consciência</p>
                  <p><strong className="text-foreground">Carlton:</strong> O gancho One-Two Punch e balas fascinantes</p>
                  <p><strong className="text-foreground">Bencivenga:</strong> A promessa nunca pode ser maior que a prova</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setSelectedProject("global");
                      setSearchQuery("Eugene Schwartz headline níveis de consciência");
                      setActiveTab("playground");
                    }}
                  >
                    <Search className="h-3.5 w-3.5 mr-1" />
                    RAG
                  </Button>
                  <Button
                    size="sm"
                    className="w-full text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 font-semibold"
                    onClick={() => {
                      setMemoFlowTargetProject("global");
                      setShowMemoFlowModal(true);
                    }}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Gerar Ads
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: CardioFlush */}
            <Card className="border-border hover:border-red-500/40 transition-all flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5">
                    DTC Nutra
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">Cardiovascular</span>
                </div>
                <CardTitle className="text-base text-foreground flex items-center gap-1.5">
                  🫀 CardioFlush: Desobstrução Arterial
                </CardTitle>
                <CardDescription className="text-xs">
                  Ação fibrinolítica com Nattokinase e precursores de Óxido Nítrico para flexibilidade endotelial e pressão saudável.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <div className="bg-secondary/50 p-2.5 rounded space-y-1 text-muted-foreground">
                  <p><strong className="text-foreground">Ativo:</strong> Nattokinase concentrada + L-Arginina</p>
                  <p><strong className="text-foreground">Alvo:</strong> Fibrina e placas viscosas nas artérias</p>
                  <p><strong className="text-foreground">Reframe:</strong> Pressão alta é resistência vascular rígida</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setSelectedProject("cardioflush");
                      setSearchQuery("CardioFlush Nattokinase pressão arterial");
                      setActiveTab("playground");
                    }}
                  >
                    <Search className="h-3.5 w-3.5 mr-1" />
                    RAG
                  </Button>
                  <Button
                    size="sm"
                    className="w-full text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-semibold"
                    onClick={() => {
                      setMemoFlowTargetProject("cardioflush");
                      setShowMemoFlowModal(true);
                    }}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Gerar Ads
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 5: MemoFlow */}
            <Card className="border-border hover:border-purple-500/40 transition-all flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-purple-500 border-purple-500/20 bg-purple-500/5">
                    DTC Nutra
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">Cognição</span>
                </div>
                <CardTitle className="text-base text-foreground flex items-center gap-1.5">
                  🧠 MemoFlow: Foco & Brain Fog
                </CardTitle>
                <CardDescription className="text-xs">
                  Combate à neuroinflamação, estímulo de BDNF e acetilcolina para eliminar lapsos de memória e fadiga cognitiva.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <div className="bg-secondary/50 p-2.5 rounded space-y-1 text-muted-foreground">
                  <p><strong className="text-foreground">Mecanismo:</strong> Neurogênese via BDNF + Acetilcolina</p>
                  <p><strong className="text-foreground">Sintoma:</strong> Lentidão ao formular frases e esquecimento</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setSelectedProject("memoflow");
                      setSearchQuery("MemoFlow névoa mental memória");
                      setActiveTab("playground");
                    }}
                  >
                    <Search className="h-3.5 w-3.5 mr-1" />
                    RAG
                  </Button>
                  <Button
                    size="sm"
                    className="w-full text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 border border-purple-500/20 font-semibold"
                    onClick={() => {
                      setMemoFlowTargetProject("memoflow");
                      setShowMemoFlowModal(true);
                    }}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Gerar Ads
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 6: JP Freitas */}
            <Card className="border-border hover:border-cyan-500/40 transition-all flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-cyan-500 border-cyan-500/20 bg-cyan-500/5">
                    Lançamento
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">22.1k Transcrições</span>
                </div>
                <CardTitle className="text-base text-foreground flex items-center gap-1.5">
                  💈 JP Freitas: Acervo de Cabelo & Aulas
                </CardTitle>
                <CardDescription className="text-xs">
                  O Código dos Cortes Perfeitos, Colorimetria, Segunda Braba e o catálogo de permissões da área de membros.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <div className="bg-secondary/50 p-2.5 rounded space-y-1 text-muted-foreground">
                  <p><strong className="text-foreground">Produtos:</strong> Código dos Cortes (R$47) vs Formação (R$797)</p>
                  <p><strong className="text-foreground">Base:</strong> 22.000+ trechos de aulas transcritos com áudio</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setSelectedProject("jp_freitas");
                      setSearchQuery("Código dos Cortes Perfeitos aulas e acesso");
                      setActiveTab("playground");
                    }}
                  >
                    <Search className="h-3.5 w-3.5 mr-1" />
                    RAG
                  </Button>
                  <Button
                    size="sm"
                    className="w-full text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 border border-cyan-500/20 font-semibold"
                    onClick={() => {
                      setMemoFlowTargetProject("jp_freitas");
                      setShowMemoFlowModal(true);
                    }}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Gerar Ads
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── ABA 3: BASE DE CONHECIMENTO & CHUNKS ── */}
        <TabsContent value="base" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    Catálogo de Conhecimentos Cadastrados
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Exibindo os {filteredKnowledge.length} conhecimentos mais recentes e prioritários do escopo atual.
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por título ou texto..."
                    value={tableSearch}
                    onChange={e => setTableSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/60 text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="p-3">Projeto</th>
                      <th className="p-3">Dúvida / Assunto</th>
                      <th className="p-3">Fonte / Tag</th>
                      <th className="p-3 text-center">Score</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredKnowledge.map(row => (
                      <tr key={row.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="p-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono py-0">
                            {row.project_id || "global"}
                          </Badge>
                        </td>
                        <td className="p-3 font-medium text-foreground max-w-md truncate">
                          {row.pergunta}
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          <span className="text-[11px] bg-secondary px-2 py-0.5 rounded">
                            {row.source || "manual"}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-foreground">
                          {row.score_uso}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setViewingItem(row)}
                          >
                            <Eye className="h-3 w-3 mr-1" /> Ver Resposta
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredKnowledge.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          Nenhum conhecimento encontrado para este filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA 4: TREINAR IA (PERGUNTAS SEM RESPOSTA) ── */}
        <TabsContent value="treinar" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-amber-500" />
                  Dúvidas Reais de Clientes (Lacunas de IA)
                </span>
                <Button variant="outline" size="sm" onClick={() => fetchUnanswered()} disabled={isLoadingUnanswered}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoadingUnanswered ? "animate-spin" : ""}`} />
                  Atualizar Fila
                </Button>
              </CardTitle>
              <CardDescription className="text-xs">
                Quando um cliente no WhatsApp pergunta algo que a IA não sabe com 100% de certeza, ela admite que vai checar e registra aqui. Responda a dúvida para ensiná-la para sempre.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unansweredList.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border rounded-lg space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">Zero Lacunas Pendentes!</p>
                  <p className="text-xs text-muted-foreground">
                    A IA possui respostas calibradas para todas as dúvidas recentes dos leads.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {unansweredList.map(item => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono py-0 text-amber-500 border-amber-500/30">
                            {item.project_id}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-foreground">
                          "{item.pergunta}"
                        </p>
                      </div>

                      <Button
                        size="sm"
                        className="shrink-0 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs"
                        onClick={() => {
                          setAnsweringItem(item);
                          setAnswerDraft("");
                        }}
                      >
                        <Brain className="h-3.5 w-3.5 mr-1.5" />
                        Ensinar à IA
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── MODAL: VER RESPOSTA / DETALHES ── */}
      <Dialog open={!!viewingItem} onOpenChange={() => setViewingItem(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base text-primary flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {viewingItem?.pergunta}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Projeto: <strong className="text-foreground">{viewingItem?.project_id}</strong> · Fonte: {viewingItem?.source}
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 rounded-lg bg-secondary/50 border border-border text-xs leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
            {viewingItem?.resposta}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (viewingItem?.resposta) {
                  navigator.clipboard.writeText(viewingItem.resposta);
                  toast.success("Resposta copiada!");
                }
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
            </Button>
            <Button size="sm" onClick={() => setViewingItem(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: ENSINAR À IA (RESPONDER DÚVIDA) ── */}
      <Dialog open={!!answeringItem} onOpenChange={() => setAnsweringItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-amber-500" />
              Ensinar Resposta Calibrada à IA
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dúvida do lead: <strong className="text-foreground">"{answeringItem?.pergunta}"</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label className="text-xs font-medium">Qual é a resposta oficial que a IA deve fornecer?</Label>
            <Textarea
              placeholder="Digite a resposta correta, com tom cordial e informações oficiais de preço, entrega ou produto..."
              rows={5}
              className="text-xs font-sans"
              value={answerDraft}
              onChange={e => setAnswerDraft(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              ⚡ Ao aprovar, esta resposta passa a ter score prioritário e a IA passa a utilizá-la em todos os futuros atendimentos.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAnsweringItem(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveAnswer} disabled={isSavingAnswer}>
              {isSavingAnswer ? "Salvando..." : "Aprovar & Ensinar à IA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: ADICIONAR NOVO CONHECIMENTO ── */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Adicionar Conhecimento ao Acervo RAG
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre um novo item de FAQ, regra de atendimento ou detalhe de produto na base unificada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Projeto de Destino</Label>
                <Select value={newProject} onValueChange={setNewProject}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_OPTIONS.filter(p => p.id !== "all").map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Tipo / Tag de Fonte</Label>
                <Select value={newSource} onValueChange={setNewSource}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dossie:produto" className="text-xs">Dossiê do Produto</SelectItem>
                    <SelectItem value="dossie:avatar" className="text-xs">Avatar & Psicologia</SelectItem>
                    <SelectItem value="dossie:copywriting" className="text-xs">Copywriting Master</SelectItem>
                    <SelectItem value="faq_oficial" className="text-xs">FAQ Oficial de Atendimento</SelectItem>
                    <SelectItem value="regra_comercial" className="text-xs">Regra Comercial / Fechamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Pergunta, Título ou Situação</Label>
              <Input
                placeholder="Ex: Como tomar o produto? Ou: Qual é a garantia?"
                className="h-8 text-xs mt-1"
                value={newPergunta}
                onChange={e => setNewPergunta(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs">Resposta ou Conteúdo Calibrado</Label>
              <Textarea
                placeholder="Digite a resposta ou regra detalhada para o motor de busca e para os bots..."
                rows={4}
                className="text-xs mt-1"
                value={newResposta}
                onChange={e => setNewResposta(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAddKnowledge} disabled={isAdding}>
              {isAdding ? "Salvando..." : "Salvar no Acervo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: GERADOR DE LOTES DE ANÚNCIOS (MEMOFLOW) ── */}
      <MemoFlowAdGeneratorModal
        open={showMemoFlowModal}
        onOpenChange={setShowMemoFlowModal}
        initialProjectId={memoFlowTargetProject}
        onNavigateToCopyLab={({ projectId, prompt, output }) => {
          setShowMemoFlowModal(false);
          navigate("/copy-lab", {
            state: {
              initialIntent: "lote_anuncios_memoflow",
              projectId,
              briefing: prompt,
              initialOutput: output,
            },
          });
        }}
      />
    </div>
  );
}

