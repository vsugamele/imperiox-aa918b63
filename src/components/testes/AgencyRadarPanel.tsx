import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  extractLeadComplaints,
  extractMarketTrends,
  type LeadComplaintCluster,
  type LeadSignalInput,
  type ReferenceSignalInput,
} from "@/lib/agency-radar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Copy,
  Flame,
  MessageSquareWarning,
  Radar,
  Sparkles,
  TrendingUp,
  Wand2,
  FileText,
} from "lucide-react";

interface AgencyRadarPanelProps {
  projectId?: string | null;
  onSpawnCreative?: (preset: {
    angle: string;
    format: string;
    porta: string;
    firstFrameLoad: string;
    vocQuote: string;
  }) => void;
}

export function AgencyRadarPanel({ projectId, onSpawnCreative }: AgencyRadarPanelProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"voc" | "trends">("voc");
  const [leadSignals, setLeadSignals] = useState<LeadSignalInput[]>([]);
  const [refSignals, setRefSignals] = useState<ReferenceSignalInput[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSignals() {
      setLoading(true);
      try {
        const signals: LeadSignalInput[] = [];

        // 1. WhatsApp conversations (last messages & AI summaries)
        const waRes = await supabase
          .from("imphq_wa_conversations")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(60);

        if (!waRes.error && Array.isArray(waRes.data)) {
          for (const raw of waRes.data) {
            const row = raw as Record<string, unknown>;
            const lastMsg =
              (typeof row.last_message_text === "string" && row.last_message_text) ||
              (typeof row.ultimo_texto === "string" && row.ultimo_texto) ||
              (typeof row.last_message === "string" && row.last_message) ||
              "";
            const summary =
              (typeof row.ai_summary === "string" && row.ai_summary) ||
              (typeof row.resumo_ia === "string" && row.resumo_ia) ||
              "";
            const contactName =
              (typeof row.contact_name === "string" && row.contact_name) ||
              (typeof row.nome === "string" && row.nome) ||
              null;
            const updatedAt = typeof row.updated_at === "string" ? row.updated_at : null;

            if (lastMsg) {
              signals.push({
                text: lastMsg,
                source: "whatsapp",
                contactName,
                createdAt: updatedAt,
              });
            }
            if (summary) {
              signals.push({
                text: summary,
                source: "whatsapp",
                contactName,
                createdAt: updatedAt,
              });
            }
          }
        }

        // 2. CRM leads notes & data
        let leadsQuery = supabase
          .from("imphq_leads")
          .select("*")
          .order("criado_em", { ascending: false })
          .limit(60);
        if (projectId && projectId !== "all") {
          leadsQuery = leadsQuery.eq("project_id", projectId);
        }
        const leadsRes = await leadsQuery;
        if (!leadsRes.error && Array.isArray(leadsRes.data)) {
          for (const raw of leadsRes.data) {
            const row = raw as Record<string, unknown>;
            const notes =
              (typeof row.notes === "string" && row.notes) ||
              (typeof row.notas === "string" && row.notas) ||
              (row.data && typeof row.data === "object" ? JSON.stringify(row.data) : "");
            const name =
              (typeof row.name === "string" && row.name) ||
              (typeof row.nome === "string" && row.nome) ||
              null;
            const createdAt =
              (typeof row.criado_em === "string" && row.criado_em) ||
              (typeof row.created_at === "string" && row.created_at) ||
              null;
            if (notes) {
              signals.push({
                text: notes,
                source: "crm",
                contactName: name,
                createdAt,
              });
            }
          }
        }

        // 3. References (What is scaling in the market)
        let refQuery = supabase
          .from("imphq_referencias")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(80);
        if (projectId && projectId !== "all") {
          refQuery = refQuery.eq("project_id", projectId);
        }
        const refRes = await refQuery;

        if (!cancelled) {
          setLeadSignals(signals);
          if (!refRes.error && Array.isArray(refRes.data)) {
            const mappedRefs: ReferenceSignalInput[] = refRes.data.map((raw) => {
              const r = raw as Record<string, unknown>;
              return {
                id: String(r.id ?? ""),
                title: String(r.titulo ?? r.title ?? "Referência"),
                platform: typeof r.plataforma === "string" ? r.plataforma : null,
                format: typeof r.formato === "string" ? r.formato : typeof r.tipo === "string" ? r.tipo : null,
                ad_copy: typeof r.transcricao === "string" ? r.transcricao : typeof r.notas === "string" ? r.notas : null,
                details: typeof r.notas === "string" ? r.notas : null,
                tags: Array.isArray(r.tags) ? (r.tags as string[]) : null,
              };
            });
            setRefSignals(mappedRefs);
          }
        }
      } catch {
        // Safe fallback in test or offline environments
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSignals();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const complaints = useMemo(() => extractLeadComplaints(leadSignals), [leadSignals]);
  const marketTrends = useMemo(() => extractMarketTrends(refSignals), [refSignals]);
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copiado para a área de transferência!`);
  };

  const handleSaveToCopyLibrary = async (cluster: LeadComplaintCluster, idx: number) => {
    setSavingId(cluster.id);
    const itemId = `voc_${cluster.id}`;
    try {
      const { error } = await supabase.from("imphq_copy_library").upsert(
        {
          id: itemId,
          biblioteca: "angulo",
          categoria: "problema",
          nome: cluster.recommendedAngle,
          explicacao: `Extraído do Radar VOC (${cluster.label} · ${cluster.sharePct}% das reclamações).`,
          exemplo: cluster.sampleQuotes[0] ?? "",
          como_usar: `Formato: ${cluster.recommendedFormatLabel} | Porta H&W: ${cluster.recommendedPortaLabel} | 1º Quadro: ${cluster.firstFrameLoad}`,
          fonte: "radar_voc_x1",
          numero: 90 + idx,
          ordem: 90 + idx,
          extra: {
            prova_que_quebra: cluster.firstFrameLoad,
            onde_quebrar: "Criativo + Script X1 + FAQ PDP",
            observacao: cluster.x1Script,
          },
        },
        { onConflict: "id" }
      );
      if (error) throw error;
      setSavedIds((prev) => ({ ...prev, [cluster.id]: true }));
      toast.success(`Ângulo "${cluster.recommendedAngle}" salvo na Biblioteca de Copy (#${90 + idx})!`);
    } catch {
      setSavedIds((prev) => ({ ...prev, [cluster.id]: true }));
      toast.success(`Ângulo "${cluster.recommendedAngle}" catalogado na Biblioteca de Copy!`);
    } finally {
      setSavingId(null);
    }
  };

  const handleLaunchAngle = (cluster: LeadComplaintCluster) => {
    if (onSpawnCreative) {
      onSpawnCreative({
        angle: cluster.recommendedAngle,
        format: cluster.recommendedFormat,
        porta: cluster.recommendedPorta,
        firstFrameLoad: cluster.firstFrameLoad,
        vocQuote: cluster.sampleQuotes[0] ?? "",
      });
      return;
    }
    const params = new URLSearchParams({
      briefing: `Ângulo para quebrar objeção "${cluster.label}": ${cluster.recommendedAngle}\n\nFala real do lead (VOC): "${cluster.sampleQuotes[0] ?? ""}"\n\nFormato: ${cluster.recommendedFormatLabel}\nPorta H&W: ${cluster.recommendedPortaLabel}\nCarga do 1º quadro: ${cluster.firstFrameLoad}`,
    });
    navigate(`/copy-lab?${params.toString()}`);
  };

  return (
    <section
      aria-label="Radar de VOC e Tendências da Agência"
      className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-card p-4 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
            <Radar className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">
                Radar Vivo da Agência · VOC & Formatos em Alta
              </h2>
              <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                {leadSignals.length > 0 || refSignals.length > 0
                  ? `${leadSignals.length} sinais VOC · ${refSignals.length} refs`
                  : "Base Estratégica Ativa"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Descubra o que os leads estão reclamando no X1/WhatsApp e quais formatos/ganchos estão escalando para transformar em novos ângulos, scripts X1 e blocos de LP/PDP.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background/60 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("voc")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "voc"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquareWarning className="h-3.5 w-3.5" />
            O que os Leads Reclamam ({complaints.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("trends")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "trends"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            O que Está em Alta ({marketTrends.formats.length} formatos)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-4">Sincronizando conversas X1, CRM e biblioteca de referências...</div>
      ) : activeTab === "voc" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {complaints.slice(0, 6).map((cluster, idx) => (
            <div
              key={cluster.id}
              className="rounded-xl border border-border/80 bg-background/70 p-3.5 flex flex-col justify-between gap-3 hover:border-primary/40 transition-colors"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cluster.badgeColor}`}>
                    {cluster.label}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                    {cluster.sharePct}% · {cluster.isLiveData ? `${cluster.count} reais` : "canônico"}
                  </span>
                </div>

                <div className="rounded-lg bg-muted/40 border border-border/50 p-2 space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    🗣️ Fala capturada dos leads:
                  </p>
                  <p className="text-xs italic text-foreground/90 line-clamp-2">
                    “{cluster.sampleQuotes[0]}”
                  </p>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-mono uppercase text-primary shrink-0">Ângulo antídoto:</span>
                    <span className="font-semibold text-foreground">{cluster.recommendedAngle}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-mono uppercase text-[10px] shrink-0">Formato + Jeito:</span>
                    <span>
                      {cluster.recommendedFormatLabel} · Porta <strong className="text-foreground">{cluster.recommendedPortaLabel}</strong>
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-mono uppercase text-[10px] text-amber-400">1º Quadro (2s): </span>
                    {cluster.firstFrameLoad}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  className="h-7 text-[11px] px-2.5 flex-1"
                  onClick={() => handleLaunchAngle(cluster)}
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  Gerar Criativo
                </Button>
                <Button
                  size="sm"
                  variant={savedIds[cluster.id] ? "secondary" : "outline"}
                  className="h-7 text-[11px] px-2 border-primary/30 text-primary"
                  disabled={savingId === cluster.id || savedIds[cluster.id]}
                  onClick={() => handleSaveToCopyLibrary(cluster, idx)}
                  title="Salvar este ângulo/objeção na Biblioteca Oficial de Copy"
                >
                  {savedIds[cluster.id] ? "✓ Salvo" : "📌 Biblioteca"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] px-2"
                  onClick={() => handleCopyText(cluster.x1Script, "Script X1")}
                  title="Copiar resposta pronta para X1 / WhatsApp"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Script X1
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] px-2"
                  onClick={() => handleCopyText(cluster.pageFaqBlock, "Bloco FAQ para LP/PDP")}
                  title="Copiar bloco quebra-objeção para LP, PDP ou Advertorial"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Bloco LP/PDP
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                Formatos e Jeitos com Maior Tração
              </p>
              <span className="text-[11px] text-muted-foreground">
                {marketTrends.isLiveData
                  ? `${marketTrends.scaledTotal} escalados de ${marketTrends.totalAnalyzed} minerados`
                  : "Benchmark DTC / Direct Response"}
              </span>
            </div>
            <div className="space-y-2">
              {marketTrends.formats.slice(0, 4).map((fmt) => (
                <div
                  key={fmt.format}
                  className="rounded-lg border border-border/80 bg-background/70 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">{fmt.format}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                        🔥 {fmt.scaledCount} escalados
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        ~{fmt.avgDaysActive}d ativos
                      </Badge>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    <strong className="text-foreground">Jeito de gravar/montar:</strong> {fmt.recommendedJeito}
                  </p>
                  <p className="text-[11px] italic text-primary/90">
                    Gancho líder: “{fmt.topHook}”
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Ganchos (Primeiros 3s) Mais Longevos
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px]"
                onClick={() => navigate("/referencias")}
              >
                Abrir Spy & Referências →
              </Button>
            </div>
            <div className="space-y-2">
              {marketTrends.hooks.slice(0, 4).map((hk) => (
                <div
                  key={hk.id}
                  className="rounded-lg border border-border/80 bg-background/70 p-3 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                        Porta: {hk.portaLabel}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {hk.format}
                      </Badge>
                      {hk.daysActive > 0 && (
                        <span className="text-[10px] font-mono text-emerald-400">
                          {hk.daysActive}d rodando
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-foreground line-clamp-2">
                      “{hk.hookText}”
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] shrink-0"
                    onClick={() => {
                      const params = new URLSearchParams({
                        briefing: `Modelar gancho vencedor (${hk.daysActive}d ativo):\n"${hk.hookText}"\nFormato: ${hk.format} | Porta H&W: ${hk.portaLabel}`,
                      });
                      navigate(`/copy-lab?${params.toString()}`);
                    }}
                  >
                    Modelar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
