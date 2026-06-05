import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Search, Brain, FileText, RefreshCw, Layers, Compass, 
  BookOpen, AlertCircle, BarChart3, Database, Sparkles, CheckCircle2, ChevronRight
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectFilter: string; // "all" ou ID do projeto
}

interface MatchResult {
  id: string;
  pergunta: string;
  resposta: string;
  similarity: number;
}

interface DocItem {
  id: string;
  title: string;
  tags: string[];
  project_id: string;
  created_at: string;
}

interface ChunkItem {
  id: string;
  pergunta: string;
  resposta: string;
  source: string;
  created_at: string;
}

export default function RagInspector({ projectFilter = "all" }: Props) {
  const [projectId, setProjectId] = useState<string>("");
  const [projects, setProjects] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>("inspector");

  // RAG Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [minSimilarity, setMinSimilarity] = useState<number>(0.35);
  const [matchCount, setMatchCount] = useState<number>(5);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLogs, setSearchLogs] = useState<string[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);

  // Docs Base States
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [chunkCounts, setChunkCounts] = useState<Record<string, number>>({});
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [trainingIds, setTrainingIds] = useState<string[]>([]);

  // View Chunks Modal
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [docChunks, setDocChunks] = useState<ChunkItem[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  // Fetch projects list
  useEffect(() => {
    supabase.from("imphq_projects").select("id, name, icon").then(({ data }) => {
      const projs = data || [];
      setProjects(projs);
      
      // Auto-select project if filter is set, else pick first available
      if (projectFilter !== "all") {
        setProjectId(projectFilter);
      } else if (projs.length > 0) {
        setProjectId(projs[0].id);
      }
    });
  }, [projectFilter]);

  // Sync project select when parent filter changes
  useEffect(() => {
    if (projectFilter !== "all" && projectFilter !== projectId) {
      setProjectId(projectFilter);
    }
  }, [projectFilter]);

  // Fetch trained documents and count chunks in background
  const fetchTrainedData = async () => {
    if (!projectId) return;
    setIsLoadingDocs(true);
    try {
      // 1. Fetch documents tagged with ia_treinada for this project
      const { data: docData, error: docErr } = await supabase
        .from("imphq_docs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (docErr) throw docErr;
      
      const allDocs: DocItem[] = (docData as any[]) || [];
      const trainedDocs = allDocs.filter(d => Array.isArray(d.tags) && d.tags.includes("ia_treinada"));
      setDocs(trainedDocs);

      // 2. Count chunks in imphq_wa_knowledge by doc source tag
      const { data: knowledgeData, error: knowErr } = await supabase
        .from("imphq_wa_knowledge")
        .select("source")
        .eq("project_id", projectId);

      if (knowErr) throw knowErr;

      const counts: Record<string, number> = {};
      (knowledgeData || []).forEach((k) => {
        if (k.source && k.source.startsWith("doc:")) {
          counts[k.source] = (counts[k.source] || 0) + 1;
        }
      });
      setChunkCounts(counts);

    } catch (err: any) {
      console.error("[RagInspector] Error fetching trained base:", err);
      toast.error("Erro ao carregar base de conhecimento");
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchTrainedData();
  }, [projectId]);

  // Trigger RAG search embedding & RPC matching
  const handleRagSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Por favor, digite uma pergunta.");
      return;
    }
    if (!projectId) {
      toast.error("Por favor, selecione um projeto.");
      return;
    }

    setIsSearching(true);
    setResults([]);
    setSearchLogs([
      "🧬 Iniciando busca RAG autônoma...",
      "📡 Conectando ao OpenRouter..."
    ]);

    try {
      // Step 1: Call edge function to generate vector embedding from text
      const logs = ["🧬 Iniciando busca RAG autônoma...", "📡 Conectando ao OpenRouter..."];
      
      setSearchLogs([...logs, "🧠 Gerando embedding 768-dim utilizando openai/text-embedding-3-small..."]);
      
      const { data: embData, error: embErr } = await supabase.functions.invoke("wa-doc-embedder", {
        body: {
          action: "get_embedding",
          text: searchQuery.trim()
        }
      });

      if (embErr) throw embErr;
      if (embData?.error) throw new Error(embData.error);
      
      const embedding = embData?.embedding;
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error("Resposta de embedding inválida do servidor.");
      }

      setSearchLogs(prev => [
        ...prev, 
        `✅ Vetor gerado com sucesso (${embedding.length} dimensões).`,
        `🔍 Consultando banco de vetores Postgres (cosseno similarity)...`
      ]);

      // Step 2: Query RPC function for cosine similarity matching
      const { data: matchData, error: matchErr } = await supabase.rpc("match_wa_knowledge", {
        query_embedding: embedding as any,
        p_project_id: projectId,
        match_count: matchCount,
        min_similarity: minSimilarity
      });

      if (matchErr) throw matchErr;

      const formattedResults = (matchData || []).map((m: any) => ({
        id: m.id,
        pergunta: m.pergunta,
        resposta: m.resposta,
        similarity: Number(m.similarity || 0)
      }));

      setResults(formattedResults);
      setSearchLogs(prev => [
        ...prev,
        `🎉 Busca concluída! Encontrados ${formattedResults.length} blocos acima da nota de corte.`
      ]);

      if (formattedResults.length === 0) {
        toast.warning("Nenhum bloco de conhecimento correspondeu à pergunta com a similaridade mínima configurada.");
      } else {
        toast.success(`Encontrados ${formattedResults.length} resultados correspondentes!`);
      }

    } catch (err: any) {
      console.error("[RagInspector] Search error:", err);
      setSearchLogs(prev => [...prev, `❌ Erro: ${err.message || err}`]);
      toast.error(`Busca RAG falhou: ${err.message || err}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Inspect Chunks for a specific Document
  const handleViewDocChunks = async (doc: DocItem) => {
    setSelectedDoc(doc);
    setDocChunks([]);
    setIsLoadingChunks(true);
    try {
      const { data, error } = await supabase
        .from("imphq_wa_knowledge")
        .select("id, pergunta, resposta, source, created_at")
        .eq("project_id", projectId)
        .eq("source", `doc:${doc.id}`)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setDocChunks(data || []);
    } catch (err: any) {
      console.error("[RagInspector] Error fetching chunks:", err);
      toast.error("Falha ao buscar blocos de texto");
    } finally {
      setIsLoadingChunks(false);
    }
  };

  // Trigger retraining for a specific document
  const handleRetrainDoc = async (doc: DocItem) => {
    setTrainingIds(prev => [...prev, doc.id]);
    toast.info(`Retreinando "${doc.title}"... Isso pode levar alguns segundos.`);
    try {
      const { data, error } = await supabase.functions.invoke("wa-doc-embedder", {
        body: {
          doc_id: doc.id,
          project_id: projectId,
          active: true // Força re-vetorização
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Treinamento concluído com sucesso! Documento vetorizado em ${data.chunks || 0} blocos.`);
      
      // Update counts
      fetchTrainedData();
    } catch (err: any) {
      console.error("[RagInspector] Retraining failed:", err);
      toast.error(`Falha no treinamento: ${err.message || err}`);
    } finally {
      setTrainingIds(prev => prev.filter(id => id !== doc.id));
    }
  };

  // Color coding for similarity scores
  const getScoreColorClass = (score: number) => {
    if (score >= 0.75) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (score >= 0.60) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-red-400 bg-red-500/10 border-red-500/20";
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 0.75) return "bg-emerald-500";
    if (score >= 0.60) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <Card className="bg-secondary/20 border-primary/20 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 h-40 w-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-serif text-primary">
              <Brain className="h-5 w-5 text-primary" />
              Inspetor de RAG & Base de Conhecimento da IA
            </CardTitle>
            <CardDescription className="text-xs mt-1 text-muted-foreground">
              Abra a caixa-preta do cérebro da IA. Teste pesquisas, inspecione a pontuação de relevância semântica e audite os blocos de dados.
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-3">
            {projectFilter === "all" && projects.length > 0 && (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="bg-secondary/80 border border-border/60 text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon || "📁"} {p.name}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-border/60 hover:bg-secondary text-xs"
              onClick={fetchTrainedData}
              disabled={isLoadingDocs}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoadingDocs ? "animate-spin" : ""}`} />
              Sincronizar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] bg-secondary/60">
            <TabsTrigger value="inspector" className="text-xs">
              <Compass className="h-3.5 w-3.5 mr-1.5" />
              Testar RAG
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="text-xs">
              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              Base de Dados ({docs.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: RAG INSPECTOR (TESTER) */}
          <TabsContent value="inspector" className="space-y-6">
            <div className="bg-secondary/40 rounded-xl p-5 border border-border/40 space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Search className="h-3 w-3 text-primary" /> Pergunta de Teste
                  </label>
                  <Input
                    placeholder="Ex: Qual o preço do produto? / Qual o horário de atendimento?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRagSearch()}
                    className="bg-card border-border/60 focus-visible:ring-primary h-10 text-xs"
                  />
                </div>

                <div className="w-full md:w-[150px] space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Similaridade Mínima</label>
                  <select
                    value={minSimilarity}
                    onChange={(e) => setMinSimilarity(Number(e.target.value))}
                    className="w-full bg-card border border-border/60 h-10 text-xs rounded-md px-2.5"
                  >
                    <option value="0.2">0.20 (Mais amplo)</option>
                    <option value="0.3">0.30</option>
                    <option value="0.35">0.35 (Padrão IA)</option>
                    <option value="0.4">0.40</option>
                    <option value="0.5">0.50</option>
                    <option value="0.6">0.60</option>
                    <option value="0.7">0.70 (Mais restrito)</option>
                  </select>
                </div>

                <div className="w-full md:w-[100px] space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Blocos (Max)</label>
                  <select
                    value={matchCount}
                    onChange={(e) => setMatchCount(Number(e.target.value))}
                    className="w-full bg-card border border-border/60 h-10 text-xs rounded-md px-2.5"
                  >
                    <option value="3">3</option>
                    <option value="5">5</option>
                    <option value="8">8</option>
                    <option value="10">10</option>
                  </select>
                </div>

                <Button 
                  onClick={handleRagSearch} 
                  disabled={isSearching}
                  className="w-full md:w-auto h-10 bg-primary hover:bg-primary/95 text-primary-foreground font-medium text-xs shadow-md shadow-primary/20 px-6 shrink-0"
                >
                  <Search className="h-4 w-4 mr-1.5" />
                  {isSearching ? "Buscando..." : "Testar RAG"}
                </Button>
              </div>

              {/* Real-time search logs console */}
              {(isSearching || searchLogs.length > 0) && (
                <div className="bg-card/80 border border-border/40 rounded-lg p-3 font-mono text-[10px] text-muted-foreground space-y-1">
                  <div className="text-[10px] font-semibold text-primary mb-1 uppercase tracking-wider flex items-center gap-1">
                    <Database className="h-3 w-3" /> Console de Rastreamento (RAG Trace):
                  </div>
                  {searchLogs.map((log, idx) => (
                    <div key={idx} className="leading-5">
                      {log}
                    </div>
                  ))}
                  {isSearching && (
                    <div className="flex items-center gap-1.5 text-primary mt-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>Processando consulta vetorial...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Results output */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="h-3.5 w-3.5 text-primary" /> Blocos de Conhecimento Recuperados ({results.length})
              </h3>

              {results.length === 0 ? (
                <div className="border border-dashed border-border/40 rounded-xl py-12 flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Compass className="h-8 w-8 mb-3 text-muted-foreground/40 animate-pulse" />
                  <p className="text-xs font-medium">Nenhum bloco recuperado</p>
                  <p className="text-[10px] text-muted-foreground/60 max-w-[320px] mt-1 leading-normal">
                    Digite uma pergunta de teste e clique em "Testar RAG" para ver quais dados a IA extrai em tempo real.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {results.map((res, index) => {
                    const progressValue = Math.min(100, Math.max(0, res.similarity * 100));
                    return (
                      <div 
                        key={res.id} 
                        className="bg-card/40 border border-border/60 hover:border-primary/30 transition-all rounded-xl p-4 space-y-3 relative group"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] text-primary bg-primary/5">
                              #{index + 1}
                            </Badge>
                            <span className="text-[11px] font-medium text-foreground max-w-[200px] sm:max-w-xs md:max-w-md truncate">
                              {res.pergunta}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground">
                              Similaridade Cosseno:
                            </span>
                            <Badge className={`text-xs px-2.5 py-0.5 border ${getScoreColorClass(res.similarity)}`}>
                              {(res.similarity * 100).toFixed(1)}%
                            </Badge>
                          </div>
                        </div>

                        {/* Similarity Progress Bar */}
                        <div className="w-full bg-secondary/40 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${getScoreBarColor(res.similarity)}`}
                            style={{ width: `${progressValue}%` }}
                          />
                        </div>

                        {/* Content text */}
                        <div className="text-xs leading-relaxed text-muted-foreground bg-secondary/15 rounded-lg p-3 font-sans border border-border/20 whitespace-pre-wrap">
                          {res.resposta}
                        </div>

                        {/* Helper indicator if AI will accept it */}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 mt-1">
                          <span className="flex items-center gap-1">
                            {res.similarity >= 0.35 ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                            )}
                            {res.similarity >= 0.35 
                              ? "Aprovado pela Nota de Corte padrão da IA (>= 0.35)" 
                              : "Ignorado pela IA por pontuação abaixo da nota de corte (0.35)"
                            }
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: KNOWLEDGE BASE DOCUMENTS */}
          <TabsContent value="knowledge" className="space-y-4">
            <div className="border border-border/40 rounded-xl overflow-hidden bg-card/10">
              {isLoadingDocs ? (
                <div className="p-8 space-y-4">
                  <div className="h-6 bg-muted/40 animate-pulse rounded w-1/4" />
                  <div className="h-20 bg-muted/20 animate-pulse rounded" />
                  <div className="h-20 bg-muted/20 animate-pulse rounded" />
                </div>
              ) : docs.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center text-muted-foreground">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-xs font-semibold">Nenhum documento treinado ainda</p>
                  <p className="text-[10px] text-muted-foreground/60 max-w-[360px] mt-1 leading-normal">
                    Para que a IA saiba responder seus clientes, acesse a aba <strong>Documentos</strong> do projeto e marque a opção <strong>"Treinar IA"</strong> em seus arquivos de texto!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {docs.map((doc) => {
                    const chunkCount = chunkCounts[`doc:${doc.id}`] || 0;
                    const isTraining = trainingIds.includes(doc.id);

                    return (
                      <div key={doc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-secondary/10 transition-colors">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 bg-primary/10 rounded-lg shrink-0 mt-0.5">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-foreground truncate max-w-sm sm:max-w-md">
                              {doc.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 font-normal">
                                <Sparkles className="h-2.5 w-2.5 mr-1" /> IA Treinada
                              </Badge>
                              <Badge variant="outline" className="text-[9px] text-muted-foreground border-border/60 font-normal">
                                <Layers className="h-2.5 w-2.5 mr-1" /> {chunkCount} Blocos (Chunks)
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                Importado em: {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary"
                            onClick={() => handleViewDocChunks(doc)}
                          >
                            Inspecionar Blocos
                            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-border/60 hover:bg-secondary text-[11px]"
                            onClick={() => handleRetrainDoc(doc)}
                            disabled={isTraining}
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${isTraining ? "animate-spin" : ""}`} />
                            {isTraining ? "Treinando..." : "Retreinar IA"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* CHUNKS VIEWER MODAL */}
      <Dialog open={selectedDoc !== null} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-2xl bg-background border-border max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="pb-3 border-b border-border/60">
            <DialogTitle className="flex items-center gap-2 text-base font-serif text-primary">
              <Layers className="h-4 w-4" /> Chunks de: {selectedDoc?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Abaixo estão listados todos os pedaços de texto em que este documento foi quebrado (chunking) e enviado ao banco de vetores do cérebro da IA.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {isLoadingChunks ? (
              <div className="space-y-4">
                <div className="h-16 bg-muted/30 animate-pulse rounded" />
                <div className="h-16 bg-muted/30 animate-pulse rounded" />
                <div className="h-16 bg-muted/30 animate-pulse rounded" />
              </div>
            ) : docChunks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-6">Nenhum bloco de conhecimento gerado para este documento.</p>
            ) : (
              docChunks.map((chunk, index) => (
                <div key={chunk.id} className="bg-secondary/20 border border-border/40 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-border/20 pb-2">
                    <span className="text-[10px] font-bold text-primary font-mono">
                      Bloco #{index + 1}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      ID: {chunk.id.substring(0, 8)}...
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono select-all">
                    {chunk.resposta}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
