import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Sparkles, MessageSquare, Instagram, Check, X, RefreshCw, Loader2,
  AlertCircle, ArrowRight, MessageCircle, Bot, SlidersHorizontal, CheckCircle2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ConteudoTabs } from "@/components/planejar/ConteudoTabs";

interface AiDraft {
  id: string;
  conversation_id: string | null;
  project_id: string;
  incoming_message_id: string | null;
  incoming_text: string | null;
  suggested_text: string;
  final_text: string | null;
  diff_ratio: number | null;
  model: string | null;
  provider: "whatsapp" | "instagram" | "instagram_comment";
  status: "pending" | "approved" | "rejected";
  created_at: string;
  resolved_at: string | null;
  project_name: string | null;
  contact_identifier: string | null;
  contact_name: string | null;
  contact_username: string | null;
  metadata?: any;
}

// Levenshtein distance to measure human modifications
function calculateSimilarity(s1: string, s2: string): number {
  const str1 = (s1 || "").trim().toLowerCase();
  const str2 = (s2 || "").trim().toLowerCase();
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  const m = str1.length;
  const n = str2.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        d[i][j] = d[i - 1][j - 1];
      } else {
        d[i][j] = Math.min(
          d[i - 1][j] + 1,      // Deletion
          d[i][j - 1] + 1,      // Insertion
          d[i - 1][j - 1] + 1   // Substitution
        );
      }
    }
  }

  const distance = d[m][n];
  const maxLength = Math.max(m, n);
  return (maxLength - distance) / maxLength;
}

export default function Rascunhos() {
  const [drafts, setDrafts] = useState<AiDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState<Record<string, boolean>>({});
  
  // Projects filter
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  
  // Status filter
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  
  // Platform filter
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  // Edited drafts local state
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});

  // Load projects list
  useEffect(() => {
    async function loadProjects() {
      const { data } = await supabase.from("imphq_projects").select("id, name").order("name");
      if (data) setProjects(data);
    }
    loadProjects();
  }, []);

  // Fetch drafts
  const fetchDrafts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("imphq_v_ai_drafts")
        .select("*")
        .eq("status", statusFilter)
        .order("created_at", { ascending: false });

      if (selectedProjectId !== "all") {
        query = query.eq("project_id", selectedProjectId);
      }

      if (platformFilter !== "all") {
        query = query.eq("provider", platformFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      setDrafts((data as any[]) || []);
      
      // Initialize local inputs
      const initialTexts: Record<string, string> = {};
      (data as any[] || []).forEach((d: AiDraft) => {
        initialTexts[d.id] = d.suggested_text;
      });
      setEditedTexts(initialTexts);
    } catch (e: any) {
      toast.error("Erro ao carregar rascunhos: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, [selectedProjectId, statusFilter, platformFilter]);

  // Handle draft approval
  const handleApprove = async (draft: AiDraft) => {
    const finalContent = editedTexts[draft.id]?.trim();
    if (!finalContent) {
      toast.error("A mensagem final não pode estar vazia.");
      return;
    }

    setActioning(prev => ({ ...prev, [draft.id]: true }));
    try {
      const similarity = calculateSimilarity(draft.suggested_text, finalContent);
      console.log(`[rascunhos] Similaridade calculada para rascunho ${draft.id}: ${similarity}`);

      let sendResult: any = null;

      // Call appropriate API based on provider
      if (draft.provider === "whatsapp") {
        if (!draft.contact_identifier) throw new Error("Número de telefone do lead ausente.");
        
        sendResult = await supabase.functions.invoke("whatsapp-api", {
          body: {
            action: "send_message",
            project_id: draft.project_id,
            phone: draft.contact_identifier,
            content: finalContent,
            conversation_id: draft.conversation_id,
            sent_by: "ai"
          }
        });
      } else if (draft.provider === "instagram") {
        if (!draft.contact_identifier) throw new Error("ID de destinatário (PSID) do Instagram ausente.");

        sendResult = await supabase.functions.invoke("instagram-api", {
          body: {
            action: "send_text",
            project_id: draft.project_id,
            recipient_id: draft.contact_identifier,
            text: finalContent
          }
        });
      } else if (draft.provider === "instagram_comment") {
        const commentId = draft.metadata?.comment_id || draft.incoming_message_id;
        if (!commentId) throw new Error("ID do comentário do Instagram ausente nos metadados.");

        sendResult = await supabase.functions.invoke("instagram-api", {
          body: {
            action: "reply_comment",
            project_id: draft.project_id,
            comment_id: commentId,
            message: finalContent
          }
        });
      }

      if (sendResult?.error) {
        throw new Error(sendResult.error.message || JSON.stringify(sendResult.error));
      }

      const resData = sendResult?.data;
      if (resData && resData.success === false) {
        throw new Error(resData.error || "Falha ao enviar mensagem");
      }

      // Update draft status to approved in database
      const { error: updateError } = await supabase
        .from("imphq_wa_ai_drafts")
        .update({
          status: "approved",
          final_text: finalContent,
          diff_ratio: similarity,
          resolved_at: new Date().toISOString()
        } as any)
        .eq("id", draft.id);

      if (updateError) throw updateError;

      toast.success("Mensagem aprovada e enviada com sucesso!");
      
      // Remove from list or refresh
      setDrafts(prev => prev.filter(d => d.id !== draft.id));
    } catch (err: any) {
      console.error("[approve draft] error:", err);
      toast.error("Erro ao aprovar rascunho: " + err.message);
    } finally {
      setActioning(prev => ({ ...prev, [draft.id]: false }));
    }
  };

  // Handle draft rejection
  const handleReject = async (draft: AiDraft) => {
    setActioning(prev => ({ ...prev, [draft.id]: true }));
    try {
      const { error } = await supabase
        .from("imphq_wa_ai_drafts")
        .update({
          status: "rejected",
          resolved_at: new Date().toISOString()
        } as any)
        .eq("id", draft.id);

      if (error) throw error;

      toast.success("Rascunho rejeitado e descartado.");
      setDrafts(prev => prev.filter(d => d.id !== draft.id));
    } catch (err: any) {
      toast.error("Erro ao rejeitar rascunho: " + err.message);
    } finally {
      setActioning(prev => ({ ...prev, [draft.id]: false }));
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl font-sans">
      <ConteudoTabs />
      
      {/* ─── HEADER COM TÍTULO E ÍCONE ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-amber-500 to-amber-600 p-2.5 rounded-2xl shadow-lg shadow-amber-500/10">
            <Sparkles className="h-6 w-6 text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">Central de Rascunhos da IA</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Valide e edite respostas sugeridas pela Inteligência Artificial antes de enviar.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Refresh button */}
          <Button
            variant="outline"
            size="icon"
            onClick={fetchDrafts}
            disabled={loading}
            className="h-9 w-9 bg-secondary/20 hover:bg-secondary/40 border-border/60"
            title="Atualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ─── FILTROS DE PESQUISA / CATEGORIA ─── */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/60 shadow-lg">
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4 justify-between">
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            {/* Filter Project */}
            <div className="flex flex-col gap-1.5 w-full sm:w-48">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Projeto</Label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-secondary/40 border border-border/60 text-foreground text-xs rounded-lg block p-2 w-full focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="all">Todos os Projetos</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Filter Platform */}
            <div className="flex flex-col gap-1.5 w-full sm:w-48">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Plataforma</Label>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="bg-secondary/40 border border-border/60 text-foreground text-xs rounded-lg block p-2 w-full focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="all">Todas as Mídias</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram Direct (DM)</option>
                <option value="instagram_comment">Instagram Comentário</option>
              </select>
            </div>
          </div>

          {/* Status filter (tabs style) */}
          <div className="flex items-center gap-1.5 bg-secondary/30 p-1 rounded-xl border border-border/40 w-full md:w-auto justify-center">
            <Button
              variant={statusFilter === "pending" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("pending")}
              className="text-xs h-8 rounded-lg"
            >
              Pendentes
            </Button>
            <Button
              variant={statusFilter === "approved" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("approved")}
              className="text-xs h-8 rounded-lg"
            >
              Aprovados
            </Button>
            <Button
              variant={statusFilter === "rejected" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("rejected")}
              className="text-xs h-8 rounded-lg"
            >
              Rejeitados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── LISTAGEM DE CARDS DE RASCUNHO ─── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <span className="text-sm text-muted-foreground">Buscando rascunhos da IA...</span>
        </div>
      ) : drafts.length === 0 ? (
        <Card className="bg-card border-dashed border-border/60 py-16">
          <CardContent className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="bg-secondary/30 p-4 rounded-full text-muted-foreground/60">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="font-semibold text-lg">Nenhum rascunho encontrado</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Não há sugestões de mensagens com o status <strong>{statusFilter === "pending" ? "Pendente" : statusFilter === "approved" ? "Aprovado" : "Rejeitado"}</strong> para os filtros selecionados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {drafts.map((draft) => {
            const isActioning = actioning[draft.id] || false;
            const currentText = editedTexts[draft.id] ?? "";
            
            // Format contact display info
            const name = draft.contact_name || "Lead sem Nome";
            const identifier = draft.contact_identifier || "ID não informado";
            const isWhatsapp = draft.provider === "whatsapp";
            const isInstagramComment = draft.provider === "instagram_comment";

            return (
              <Card
                key={draft.id}
                className="bg-card border-border/60 shadow-lg transition duration-200 hover:border-amber-500/20 overflow-hidden flex flex-col md:flex-row"
              >
                {/* Lateral Badge Bar */}
                <div className={`w-full md:w-2 shrink-0 ${isWhatsapp ? "bg-emerald-500" : isInstagramComment ? "bg-pink-500" : "bg-gradient-to-b from-pink-500 via-red-500 to-yellow-500"}`} />

                {/* Left side: Context details */}
                <div className="flex-1 p-5 space-y-4 border-r border-border/20 md:max-w-md bg-secondary/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isWhatsapp ? (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex gap-1 items-center font-normal">
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </Badge>
                      ) : isInstagramComment ? (
                        <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/30 flex gap-1 items-center font-normal">
                          <Instagram className="h-3 w-3" /> IG Comentário
                        </Badge>
                      ) : (
                        <Badge className="bg-pink-500/15 text-pink-300 border-pink-500/30 flex gap-1 items-center font-normal">
                          <Instagram className="h-3 w-3" /> Instagram DM
                        </Badge>
                      )}
                      
                      <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/60">
                        {draft.project_name || "Sem projeto"}
                      </Badge>
                    </div>

                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatDistanceToNow(new Date(draft.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block">Lead</span>
                    <h3 className="font-bold text-base text-foreground leading-tight">{name}</h3>
                    {isWhatsapp ? (
                      <span className="text-xs text-muted-foreground font-mono block">+{identifier}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground block">
                        @{draft.contact_username || identifier}
                      </span>
                    )}
                  </div>

                  {draft.incoming_text && (
                    <div className="bg-secondary/20 p-3 rounded-xl border border-border/30">
                      <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Mensagem Recebida</span>
                      <p className="text-xs text-foreground leading-relaxed italic">
                        "{draft.incoming_text}"
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 text-[11px] text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Modelo IA:</span>
                      <span className="font-mono text-[10px]">{draft.model || "padrão"}</span>
                    </div>
                    {draft.diff_ratio !== null && (
                      <div className="flex justify-between">
                        <span>Similaridade (Humano x IA):</span>
                        <span className="font-semibold text-amber-500">
                          {Math.round(draft.diff_ratio * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Suggested text & editor */}
                <div className="flex-1 p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <Bot className="h-4 w-4 text-amber-500" /> Resposta Sugerida
                      </Label>
                      
                      {statusFilter !== "pending" && (
                        <Badge variant="outline" className={`capitalize ${draft.status === "approved" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" : "text-destructive border-destructive/30 bg-destructive/5"}`}>
                          {draft.status === "approved" ? "Aprovado e Enviado" : "Rejeitado"}
                        </Badge>
                      )}
                    </div>

                    {statusFilter === "pending" ? (
                      <Textarea
                        value={currentText}
                        onChange={(e) => setEditedTexts(prev => ({ ...prev, [draft.id]: e.target.value }))}
                        rows={4}
                        placeholder="Edite a resposta da IA aqui..."
                        className="bg-secondary/20 border-border/60 focus-visible:ring-amber-500 text-sm leading-relaxed"
                      />
                    ) : (
                      <div className="bg-secondary/15 p-4 rounded-xl border border-border/20 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {draft.final_text || draft.suggested_text}
                      </div>
                    )}
                  </div>

                  {statusFilter === "pending" && (
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        disabled={isActioning}
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(draft)}
                        className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-border/60 shrink-0"
                      >
                        {isActioning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <X className="h-3.5 w-3.5 mr-1.5" />}
                        Rejeitar
                      </Button>

                      <Button
                        disabled={isActioning || !currentText.trim()}
                        size="sm"
                        onClick={() => handleApprove(draft)}
                        className="text-xs bg-amber-500 text-black hover:bg-amber-400 font-semibold shrink-0"
                      >
                        {isActioning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Check className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Aprovar e Enviar
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
