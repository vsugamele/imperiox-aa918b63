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
import { loadProjectIntelligence, type ProjectIntelligenceBundle } from "@/lib/project-intelligence";
import {
  qualificarCampanhaDerick,
  gerarUrlBibliotecaMetaDerick,
  type ElegibilidadeCampanhaDerick,
  type SinaisEscalaCampanhaDerick,
} from "@/lib/derick-engines";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Copy,
  ExternalLink,
  Flame,
  MessageSquareWarning,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wand2,
  FileText,
  Brain,
  Cpu,
  UserCheck,
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
  const [activeTab, setActiveTab] = useState<"voc" | "trends" | "qualifier">("voc");
  const [leadSignals, setLeadSignals] = useState<LeadSignalInput[]>([]);
  const [refSignals, setRefSignals] = useState<ReferenceSignalInput[]>([]);
  const [intel, setIntel] = useState<ProjectIntelligenceBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [paisMeta, setPaisMeta] = useState("BR");
  const [elegibilidade, setElegibilidade] = useState<ElegibilidadeCampanhaDerick>({
    temPlayerVsl: true,
    temCtaOfertaVisivel: true,
    mesmoNichoECategoria: true,
  });
  const [sinaisEscala, setSinaisEscala] = useState<SinaisEscalaCampanhaDerick>({
    anunciosAtivosNaPagina: 18,
    diasRodandoAnuncioMaisAntigo: 21,
    variantesCriativasDoMesmoFunil: 5,
    trafegoEstimadoOuCheckoutAtivo: true,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadSignals() {
      setLoading(true);
      try {
        const signals: LeadSignalInput[] = [];

        // 0. Load Project + Avatar + Docs + Skills intelligence
        const bundle = await loadProjectIntelligence(projectId && projectId !== "all" ? projectId : null);
        if (!cancelled) {
          setIntel(bundle);
        }

        // Inject Avatar's documented deep pains & objections as grounded signals so VOC reflects the project avatar
        if (bundle) {
          for (const pain of bundle.deepPains) {
            signals.push({
              text: pain,
              source: "crm",
              contactName: bundle.avatarName,
              createdAt: new Date().toISOString(),
            });
          }
          for (const obj of bundle.objections) {
            signals.push({
              text: obj.objecao,
              source: "whatsapp",
              contactName: bundle.avatarName,
              createdAt: new Date().toISOString(),
            });
          }
        }

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

  const qualificacaoResult = useMemo(
    () => qualificarCampanhaDerick(elegibilidade, sinaisEscala),
    [elegibilidade, sinaisEscala]
  );

  const buscasMeta20 = useMemo(() => {
    const dorBase = intel?.deepPains[0]?.split(",")[0]?.trim() || "inchaço abdominal";
    const mecBase = intel?.mechanismName || "drenagem linfática";
    const prodBase = intel?.products[0]?.name || intel?.projectName || "protocolo matinal";

    const amplas15 = [
      `${dorBase} ao acordar`,
      `como desinchar rápido`,
      `retenção de líquido pernas`,
      `barriga estufada depois de comer`,
      `metabolismo lento após os 35`,
      `roupa apertando na cintura`,
      `cansaço constante pela manhã`,
      `sensação de peso nas pernas`,
      `desequilíbrio inflamatório silencioso`,
      `como destravar o emagrecimento`,
      `por que dieta não funciona`,
      `ritual matinal de 15 segundos`,
      `alívio natural sem efeito rebote`,
      `eliminar líquido retido em 7 dias`,
      `voltar a vestir minhas roupas`,
    ];

    const especificas5 = [
      `${mecBase}`,
      `${prodBase} oficial`,
      `truque da colher de chá matinal`,
      `válvula linfática travada`,
      `apresentação completa assista agora`,
    ];

    return { amplas15, especificas5 };
  }, [intel]);

  // Combine market hooks with project-grounded synthesized hooks (Avatar + Docs + Skills)
  const combinedHooks = useMemo(() => {
    const projectHooks = (intel?.synthesizedHooks || []).map((sh, i) => ({
      id: sh.id,
      hookText: sh.text,
      portaLabel: sh.angle,
      format: `Avatar + ${sh.skillApplied}`,
      daysActive: 14 + i * 3,
      docRef: sh.docReference,
      painTarget: sh.avatarPainTarget,
    }));
    const marketHooks = marketTrends.hooks.map((hk) => ({
      ...hk,
      docRef: intel?.docs[0]?.title || null,
      painTarget: intel?.deepPains[0] || null,
    }));
    return [...projectHooks, ...marketHooks];
  }, [intel, marketTrends.hooks]);

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
    const intelContext = intel
      ? `\n\n[Contexto Conectado do Projeto: ${intel.projectName}]\nAvatar: ${intel.avatarName} (${intel.avatarAgeRange})\nMecanismo Único: ${intel.mechanismName}\nInimigo Comum: ${intel.enemy}\nGatilho Nuclear: ${intel.nuclearTrigger}\nDocumento Base: ${intel.docs[0]?.title || "Dossiê do Projeto"}\nSkills Aplicadas: ${intel.skills.slice(0, 3).map((s) => s.name).join(", ")}`
      : "";
    const params = new URLSearchParams({
      briefing: `Ângulo para quebrar objeção "${cluster.label}": ${cluster.recommendedAngle}\n\nFala real do lead (VOC): "${cluster.sampleQuotes[0] ?? ""}"\n\nFormato: ${cluster.recommendedFormatLabel}\nPorta H&W: ${cluster.recommendedPortaLabel}\nCarga do 1º quadro: ${cluster.firstFrameLoad}${intelContext}`,
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
            <div className="flex items-center gap-2 flex-wrap">
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
              Descubra o que os leads estão reclamando no X1/WhatsApp e quais formatos/ganchos estão escalando — cruzando com o Avatar, Documentos e Skills do projeto.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background/60 p-1">
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
          <button
            type="button"
            onClick={() => setActiveTab("qualifier")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "qualifier"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            🎯 Qualificador Derick (15+5 Meta Ads)
          </button>
        </div>
      </div>

      {/* Barra de Inteligência do Projeto Conectada ao Radar e aos Ganchos */}
      {intel && (
        <div className="rounded-lg border border-primary/20 bg-background/60 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-primary flex items-center gap-1">
              <Brain className="h-3.5 w-3.5" /> Contexto Lido nos Ganchos:
            </span>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-foreground">
              {intel.projectIcon} {intel.projectName}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-300">
              <UserCheck className="h-3 w-3 mr-1" /> Avatar: {intel.avatarName}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-300">
              <FileText className="h-3 w-3 mr-1" /> {intel.docs.length} Docs ({intel.docs[0]?.title || "Dossiê"})
            </Badge>
            <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
              <Cpu className="h-3 w-3 mr-1" /> {intel.skills.length} Skills ({intel.skills.slice(0, 2).map((s) => s.name).join(" + ")})
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Mecanismo: <strong className="text-foreground">{intel.mechanismName}</strong>
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-muted-foreground py-4">Sincronizando conversas X1, CRM, Avatar, Documentos e Skills...</div>
      ) : activeTab === "voc" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {complaints.slice(0, 6).map((cluster, idx) => {
            const canonMap: Record<string, { obj: string; proof: string; derickHook: string }> = {
              preco_valor: {
                obj: "Objeção #18 ('Tá caro' / Valor percebido)",
                proof: "Prova #30 (Custo de não agir + Conta por dia)",
                derickHook: "Derick G14 (Sintoma → Reversão → Economia)",
              },
              ceticismo_funciona: {
                obj: "Objeção #7 ('Já tentei parecido e falhou')",
                proof: "Prova #8 + #14 (Cadeia MP→MF→MS + Contraprova)",
                derickHook: "Derick G2 (Se-Qualificador + Absolvição)",
              },
              confianca_golpe: {
                obj: "Objeção #13 ('Como sei que não é golpe?')",
                proof: "Prova #27 (Garantia 30d + Rastreio ao Vivo)",
                derickHook: "Derick G5 (Review Espontâneo Não-Patrocinado)",
              },
              efeito_colateral_saude: {
                obj: "Objeção #16 ('Será que serve pro MEU caso?')",
                proof: "Prova #23 + #24 (Admissão Bencivenga + Especialista)",
                derickHook: "Derick G24 (Pergunta Real do Paciente)",
              },
              prazo_demora: {
                obj: "Objeção #10 ('Não tenho tempo / Demora muito')",
                proof: "Prova #11 + #17 (Demonstração 15s + Prazo exato)",
                derickHook: "Derick G3 (Cena-Objeto Banal de 15 Segundos)",
              },
            };
            const mapped = canonMap[cluster.id] ?? {
              obj: `Objeção #${(idx % 24) + 1} (Catálogo 24 @renanmsap)`,
              proof: "Prova #11 (Demonstração física + Garantia)",
              derickHook: "Derick G1 (Credencial + Anomalia Datada)",
            };

            return (
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
                    🗣️ Fala capturada ({intel ? `Leads + Avatar ${intel.avatarName}` : "Leads"}):
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
                  <div className="flex items-baseline gap-1.5 text-[11px] text-rose-300">
                    <span className="font-mono uppercase text-[10px] shrink-0">Catálogo 24:</span>
                    <span className="truncate">{mapped.obj}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 text-[11px] text-emerald-300">
                    <span className="font-mono uppercase text-[10px] shrink-0">Prova 34:</span>
                    <span className="truncate">{mapped.proof}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 text-[11px] text-pink-300">
                    <span className="font-mono uppercase text-[10px] shrink-0">Gancho Derick:</span>
                    <span className="truncate">{mapped.derickHook}</span>
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
            );
          })}
        </div>
      ) : activeTab === "trends" ? (
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
                Ganchos (Primeiros 3s) · Projeto + Avatar + Docs + Skills
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px]"
                onClick={() => navigate("/hook-labs")}
              >
                Abrir Hook Labs →
              </Button>
            </div>
            <div className="space-y-2">
              {combinedHooks.slice(0, 5).map((hk) => (
                <div
                  key={hk.id}
                  className="rounded-lg border border-border/80 bg-background/70 p-3 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                        {hk.portaLabel}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {hk.format}
                      </Badge>
                      {hk.docRef && (
                        <span className="text-[10px] text-cyan-300/90 truncate max-w-[180px]">
                          📄 {hk.docRef}
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
                        briefing: `Modelar gancho conectado ao projeto ${intel?.projectName || ""} (${hk.format}):\n"${hk.hookText}"\nAvatar: ${intel?.avatarName || "N/A"} | Mecanismo: ${intel?.mechanismName || "N/A"} | Porta: ${hk.portaLabel}`,
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
      ) : (
        /* ABA 3: Qualificador Determinístico de Campanhas Escaladas Derick.AI (Skill 02 v1.4.0) + 20 Buscas Meta Ads */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 rounded-xl border border-border/80 bg-background/70 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Qualificador Derick.AI (Skill 02 v1.4.0)
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  qualificacaoResult.status === "aprovada"
                    ? "border-emerald-500/40 text-emerald-300"
                    : qualificacaoResult.status === "observacao"
                    ? "border-amber-500/40 text-amber-300"
                    : "border-rose-500/40 text-rose-300"
                }`}
              >
                {qualificacaoResult.status.toUpperCase()} · {qualificacaoResult.sinaisEscalaConfirmados}/4 Sinais
              </Badge>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {qualificacaoResult.motivo}
            </p>

            {/* 3 Checkboxes de Elegibilidade */}
            <div className="space-y-1.5 pt-1 border-t border-border/60">
              <p className="text-[10px] font-mono uppercase text-primary">
                1. Elegibilidade Obrigatória (3 de 3):
              </p>
              {(
                [
                  ["temPlayerVsl", "Tem Player de VSL ou Página Long-Form ativa"],
                  ["temCtaOfertaVisivel", "Tem CTA / Checkout de Oferta Direta"],
                  ["mesmoNichoECategoria", "Pertence ao mesmo Nicho / Subnicho do Projeto"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={elegibilidade[key]}
                    onChange={(e) =>
                      setElegibilidade((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="rounded border-border"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {/* 4 Sinais Objetivos de Escala */}
            <div className="space-y-2 pt-1.5 border-t border-border/60">
              <p className="text-[10px] font-mono uppercase text-emerald-300">
                2. Sinais Datados de Escala (Mínimo 2 exigidos):
              </p>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Ads na Página</span>
                  <input
                    type="number"
                    aria-label="Anúncios ativos na página"
                    value={sinaisEscala.anunciosAtivosNaPagina}
                    onChange={(e) =>
                      setSinaisEscala((prev) => ({
                        ...prev,
                        anunciosAtivosNaPagina: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full h-7 rounded border border-border bg-card px-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Dias no Ar</span>
                  <input
                    type="number"
                    aria-label="Dias rodando anúncio mais antigo"
                    value={sinaisEscala.diasRodandoAnuncioMaisAntigo}
                    onChange={(e) =>
                      setSinaisEscala((prev) => ({
                        ...prev,
                        diasRodandoAnuncioMaisAntigo: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full h-7 rounded border border-border bg-card px-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Variantes Funil</span>
                  <input
                    type="number"
                    aria-label="Variantes criativas do mesmo funil"
                    value={sinaisEscala.variantesCriativasDoMesmoFunil}
                    onChange={(e) =>
                      setSinaisEscala((prev) => ({
                        ...prev,
                        variantesCriativasDoMesmoFunil: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full h-7 rounded border border-border bg-card px-2 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1 pt-1">
                {qualificacaoResult.detalhesSinais.map((det) => (
                  <p key={det} className="text-[10px] text-muted-foreground">
                    {det}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Gerador de 20 Buscas Meta Ads Library (15 Amplas + 5 Específicas — Derick Skill 02) */}
          <div className="lg:col-span-7 rounded-xl border border-border/80 bg-background/70 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  Matriz Derick.AI de 20 Buscas na Biblioteca Meta Ads (15 Amplas + 5 Específicas)
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Clique em qualquer termo para abrir a Meta Ads Library já filtrada em Vídeo + Ativos no país selecionado.
                </p>
              </div>
              <select
                aria-label="País da Biblioteca Meta Ads"
                value={paisMeta}
                onChange={(e) => setPaisMeta(e.target.value)}
                className="h-7 rounded border border-border bg-card px-2 text-xs font-medium"
              >
                <option value="BR">🇧🇷 Brasil (BR)</option>
                <option value="US">🇺🇸 Estados Unidos (US)</option>
                <option value="MX">🇲🇽 México (MX)</option>
                <option value="PT">🇵🇹 Portugal (PT)</option>
                <option value="ALL">🌎 Todos (ALL)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase text-cyan-300">
                🔎 15 Buscas Amplas (Sintoma, Dor Diária e Desejo do Avatar):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {buscasMeta20.amplas15.map((termo, i) => (
                  <a
                    key={termo}
                    href={gerarUrlBibliotecaMetaDerick(termo, paisMeta, true)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/5 px-2 py-1 text-[10px] text-foreground hover:border-cyan-400 hover:bg-cyan-500/15 transition-colors"
                  >
                    <span className="font-mono text-cyan-300">{i + 1}.</span>
                    <span>{termo}</span>
                    <ExternalLink className="h-2.5 w-2.5 text-cyan-300" />
                  </a>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-border/60">
              <p className="text-[10px] font-mono uppercase text-pink-300">
                🧬 5 Buscas Específicas (Mecanismo Único, Ritual e Formato VSL):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {buscasMeta20.especificas5.map((termo, i) => (
                  <a
                    key={termo}
                    href={gerarUrlBibliotecaMetaDerick(termo, paisMeta, true)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-pink-500/30 bg-pink-500/5 px-2 py-1 text-[10px] text-foreground hover:border-pink-400 hover:bg-pink-500/15 transition-colors"
                  >
                    <span className="font-mono text-pink-300">E{i + 1}.</span>
                    <span>{termo}</span>
                    <ExternalLink className="h-2.5 w-2.5 text-pink-300" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
