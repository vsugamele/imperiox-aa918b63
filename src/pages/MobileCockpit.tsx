import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Smartphone, MessageSquare, Flame, Check, AlertTriangle,
  Play, Square, RefreshCw, DollarSign, ExternalLink, UserCheck, Bot
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversation {
  id: string;
  project_id: string;
  contact_name: string;
  phone: string;
  last_message: string | null;
  last_message_at: string | null;
  ai_paused_until: string | null;
  buy_intent_detected: boolean | null;
  temperature: string | null;
  status: string | null;
}

export default function MobileCockpit() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => localStorage.getItem("mc.selectedProject") || "");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [salesStats, setSalesStats] = useState({ today: 0, yesterday: 0, sevenDays: 0 });
  const [loadingStats, setLoadingStats] = useState(false);

  const loadProjects = async () => {
    const { data } = await supabase.from("imphq_projects").select("id, name");
    setProjects(data || []);
    if (data && data.length > 0 && !selectedProjectId) {
      setSelectedProjectId(data[0].id);
      localStorage.setItem("mc.selectedProject", data[0].id);
    }
  };

  const loadStats = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoadingStats(true);
    try {
      const { data: sales, error } = await supabase
        .from("imphq_vendas")
        .select("valor, data, status")
        .eq("project_id", selectedProjectId)
        .in("status", ["aprovado", "approved", "paid", "completed", "Aprovada", "aprovada", "Aprovado"]);

      if (error) throw error;

      const todayStr = new Date().toISOString().split("T")[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let todaySales = 0;
      let yesterdaySales = 0;
      let sevenDaysSales = 0;

      (sales || []).forEach((s) => {
        const sDate = s.data || "";
        const sVal = parseFloat(s.valor) || 0;

        if (sDate.startsWith(todayStr)) {
          todaySales += sVal;
        }
        if (sDate.startsWith(yesterdayStr)) {
          yesterdaySales += sVal;
        }
        if (new Date(sDate) >= sevenDaysAgo) {
          sevenDaysSales += sVal;
        }
      });

      setSalesStats({
        today: todaySales,
        yesterday: yesterdaySales,
        sevenDays: sevenDaysSales
      });
    } catch (err: any) {
      console.error("Erro ao carregar vendas:", err.message);
    } finally {
      setLoadingStats(false);
    }
  }, [selectedProjectId]);

  const loadConversations = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("imphq_wa_conversations")
        .select("*")
        .eq("project_id", selectedProjectId)
        .order("last_message_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setConversations((data || []) as unknown as Conversation[]);
    } catch (err: any) {
      console.error("Erro ao carregar conversas:", err.message);
      toast.error("Erro ao carregar conversas do WhatsApp.");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadStats();
      loadConversations();
    }
  }, [selectedProjectId, loadStats, loadConversations]);

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id);
    localStorage.setItem("mc.selectedProject", id);
  };

  const handleToggleAiPause = async (conv: Conversation) => {
    const isPaused = conv.ai_paused_until && new Date(conv.ai_paused_until) > new Date();
    const newPausedUntil = isPaused ? null : new Date(Date.now() + 30 * 60 * 1000).toISOString();

    try {
      const { error } = await supabase
        .from("imphq_wa_conversations")
        .update({ ai_paused_until: newPausedUntil } as any)
        .eq("id", conv.id);

      if (error) throw error;

      setConversations(prev =>
        prev.map(c => (c.id === conv.id ? { ...c, ai_paused_until: newPausedUntil } : c))
      );
      toast.success(isPaused ? "IA retomada com sucesso!" : "IA pausada por 30 minutos.");
    } catch (err: any) {
      toast.error("Erro ao alterar status da IA: " + err.message);
    }
  };

  const handleToggleCloserMode = async (conv: Conversation) => {
    const nextCloser = !conv.buy_intent_detected;
    try {
      const { error } = await supabase
        .from("imphq_wa_conversations")
        .update({
          buy_intent_detected: nextCloser,
          temperature: nextCloser ? "hot" : conv.temperature
        } as any)
        .eq("id", conv.id);

      if (error) throw error;

      setConversations(prev =>
        prev.map(c =>
          c.id === conv.id
            ? { ...c, buy_intent_detected: nextCloser, temperature: nextCloser ? "hot" : c.temperature }
            : c
        )
      );
      toast.success(nextCloser ? "Closer Mode Ativado! Próxima resposta enviará link de vendas." : "Closer Mode Desativado.");
    } catch (err: any) {
      toast.error("Erro ao alterar Closer Mode: " + err.message);
    }
  };

  const handleOpenWaDirect = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    window.open(`https://api.whatsapp.com/send?phone=${clean}`, "_blank");
  };

  return (
    <div className="p-4 space-y-5 max-w-md mx-auto bg-slate-950 min-h-screen text-slate-100 pb-20">
      {/* Header Selector */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-amber-500 animate-pulse" />
          <h2 className="font-display font-bold text-base tracking-tight text-white">Mobile Cockpit</h2>
        </div>
        <select
          value={selectedProjectId}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="h-8 px-2.5 rounded-md bg-secondary/60 border border-border/60 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-white"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Sales Stats Carousel/Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="bg-slate-900 border-border/50 text-center shadow-md">
          <CardContent className="p-2.5 space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Hoje</p>
            <p className="text-sm font-bold font-mono text-emerald-400">
              {loadingStats ? (
                <RefreshCw className="h-3 w-3 animate-spin mx-auto" />
              ) : (
                `R$ ${salesStats.today.toFixed(0)}`
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-border/50 text-center shadow-md">
          <CardContent className="p-2.5 space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Ontem</p>
            <p className="text-sm font-bold font-mono text-amber-400">
              {loadingStats ? (
                <RefreshCw className="h-3 w-3 animate-spin mx-auto" />
              ) : (
                `R$ ${salesStats.yesterday.toFixed(0)}`
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-border/50 text-center shadow-md">
          <CardContent className="p-2.5 space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">7 Dias</p>
            <p className="text-sm font-bold font-mono text-primary">
              {loadingStats ? (
                <RefreshCw className="h-3 w-3 animate-spin mx-auto" />
              ) : (
                `R$ ${salesStats.sevenDays.toFixed(0)}`
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Section Title */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-orange-500 fill-orange-500" />
          Conversas Quentes (WA)
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-white"
          onClick={() => {
            loadStats();
            loadConversations();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Hot Conversations List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : conversations.length === 0 ? (
        <Card className="bg-slate-900 border-border/40 text-center">
          <CardContent className="p-8 space-y-2 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto opacity-40" />
            <p className="text-xs">Nenhuma conversa recente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => {
            const isPaused = conv.ai_paused_until && new Date(conv.ai_paused_until) > new Date();
            const isHot = conv.temperature === "hot" || conv.buy_intent_detected;
            const remainingMinutes = conv.ai_paused_until
              ? Math.max(0, Math.ceil((new Date(conv.ai_paused_until).getTime() - Date.now()) / 60000))
              : 0;

            return (
              <Card
                key={conv.id}
                className={cn(
                  "bg-slate-900 border-border/40 transition-all shadow-md active:scale-[0.99]",
                  isHot && "border-orange-500/30 bg-gradient-to-br from-slate-900 to-orange-500/5",
                  isPaused && "border-blue-500/20 bg-gradient-to-br from-slate-900 to-blue-500/5"
                )}
              >
                <CardContent className="p-3.5 space-y-3">
                  {/* Top row */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">
                        {conv.contact_name || "Sem Nome"}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {conv.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isHot && (
                        <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-[9px] font-bold px-1.5 py-0">
                          QUENTE
                        </Badge>
                      )}
                      {isPaused && (
                        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[9px] font-bold px-1.5 py-0 animate-pulse">
                          IA PAUSADA
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Message snippet */}
                  {conv.last_message && (
                    <div className="bg-slate-950/40 p-2.5 rounded-lg border border-border/20 text-xs italic text-slate-300 line-clamp-2 leading-relaxed">
                      "{conv.last_message}"
                    </div>
                  )}

                  {/* Footer metadata */}
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground/60 border-b border-border/10 pb-2.5">
                    <span>
                      Status: <strong className="capitalize">{conv.status || "Lead"}</strong>
                    </span>
                    {conv.last_message_at && (
                      <span>
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    )}
                  </div>

                  {/* Quick Action Touch Buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenWaDirect(conv.phone)}
                      className="text-[10px] h-9 gap-1 font-semibold border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:bg-emerald-500/10 active:bg-emerald-500/20"
                    >
                      <ExternalLink className="h-3 w-3" /> Chat Direct
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleCloserMode(conv)}
                      className={cn(
                        "text-[10px] h-9 gap-1 font-semibold",
                        conv.buy_intent_detected
                          ? "border-orange-500 bg-orange-500/20 text-orange-300"
                          : "border-orange-500/30 hover:border-orange-500 text-orange-400 hover:bg-orange-500/10"
                      )}
                    >
                      <UserCheck className="h-3.5 w-3.5" /> Closer Mode
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleAiPause(conv)}
                      className={cn(
                        "text-[10px] h-9 gap-1 font-semibold",
                        isPaused
                          ? "border-blue-500 bg-blue-500/20 text-blue-300"
                          : "border-blue-500/30 hover:border-blue-500 text-blue-400 hover:bg-blue-500/10"
                      )}
                    >
                      {isPaused ? <Play className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                      {isPaused ? "Retomar IA" : "Pausar IA"}
                    </Button>
                  </div>
                  {isPaused && (
                    <p className="text-[9px] text-blue-400 text-center font-semibold animate-pulse">
                      Chatbot pausado por mais {remainingMinutes} minutos.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
