import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Crown,
  Copy as CopyIcon,
  Sparkles,
  MessageSquare,
  Stethoscope,
  Film,
  Zap,
  Shield,
  Megaphone,
  Layers,
  FileText,
  Wand2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { parseMemoFlowAdBatch, formatBatchForMediaBuyer } from "@/lib/memoflow-ads-generator";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { loadProjectIntelligence, type ProjectIntelligenceBundle } from "@/lib/project-intelligence";
import {
  medirEscritaDerick,
  conferirCongruenciaVslDerick,
  vocabularioDoNichoDerick,
  gerarCopyLabIntentDerickFallback,
  autoCorrigirCopyDerickSugamele,
} from "@/lib/derick-engines";

type Project = { id: string; name: string };
type Intent =
  | "lote_anuncios_memoflow"
  | "esteira_anuncios_derick_50_50"
  | "roteiros_comment_to_dm"
  | "nsl_dtc_longform"
  | "vsl_imperador"
  | "criativo_imperador"
  | "conversa_imperador"
  | "diagnostico_imperador"
  | "vsl_filemon_e3"
  | "breakthrough_techniques"
  | "weaponized_credibility";

const TABS: Array<{ id: Intent; label: string; icon: LucideIcon; subtitle: string; badge?: string }> = [
  {
    id: "lote_anuncios_memoflow",
    label: "Lote Tráfego (MemoFlow)",
    icon: Megaphone,
    subtitle: "Esteira executiva: Ângulo + Copy Mestre + 3 Ganchos + Headlines prontas para a Meta",
  },
  {
    id: "esteira_anuncios_derick_50_50",
    label: "Esteira 50/50 (Derick)",
    icon: Layers,
    subtitle: "Skill 06 Canônica: 50% Recombinação do Pago (Fixas 100% + Controle ≥60%) + 50% c/ 1 Variável do Orgânico",
    badge: "DERICK.AI",
  },
  {
    id: "roteiros_comment_to_dm",
    label: "Comment-to-DM (5x)",
    icon: MessageSquare,
    subtitle: "Lote de 5 Reels Virais (P1–P5) c/ Ponto de Tensão + Árvore de 4 Mensagens na DM",
    badge: "VIRAL",
  },
  {
    id: "nsl_dtc_longform",
    label: "NSL Long-Form DTC",
    icon: FileText,
    subtitle: "Skill escrever-nsl: Native Sales Letter DTC slot a slot + Ganchos G1–G25 + Art Direction",
    badge: "DTC",
  },
  { id: "vsl_imperador", label: "VSL Reversa", icon: Film, subtitle: "Engenharia reversa: mecanismo → provas → abertura" },
  { id: "criativo_imperador", label: "Criativo", icon: Sparkles, subtitle: "5 variações com mecanismo nomeado" },
  { id: "conversa_imperador", label: "Conversa WA", icon: MessageSquare, subtitle: "Sequência em cadeia de sins" },
  { id: "diagnostico_imperador", label: "Diagnóstico", icon: Stethoscope, subtitle: "Laudo nas 11 leis" },
  { id: "vsl_filemon_e3", label: "VSL Filemon E3", icon: Film, subtitle: "Pipeline 6 blocos: Raio-X → Mecanismo → Tese → História → Lead → Oferta" },
  { id: "breakthrough_techniques", label: "Breakthrough", icon: Zap, subtitle: "Aplica as 7 manobras de Schwartz sobre copy existente" },
  { id: "weaponized_credibility", label: "Credibilidade", icon: Shield, subtitle: "Blinda copy com prova (Bencivenga) — mata ceticismo sem baixar o claim" },
];

export default function CopyLab() {
  const location = useLocation();
  const { projectId: globalProjectId } = useGlobalProject();
  const searchParams = new URLSearchParams(location.search);
  const routeState = (location.state || {}) as {
    initialIntent?: Intent;
    projectId?: string;
    briefing?: string;
    initialOutput?: string;
  };

  const queryBriefing = searchParams.get("briefing") || "";
  const queryIntent = (searchParams.get("intent") as Intent | null) || undefined;
  const queryProj = searchParams.get("projectId") || undefined;

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>(
    routeState.projectId || queryProj || (globalProjectId && globalProjectId !== "all" ? globalProjectId : "__none__")
  );
  const [activeTab, setActiveTab] = useState<Intent>(
    routeState.initialIntent || queryIntent || "lote_anuncios_memoflow"
  );

  const [briefing, setBriefing] = useState(routeState.briefing || queryBriefing || "");
  const [crenca, setCrenca] = useState("");
  const [referencia, setReferencia] = useState("");
  const [copyParaDiagnostico, setCopyParaDiagnostico] = useState("");

  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string>(routeState.initialOutput || "");
  const [intel, setIntel] = useState<ProjectIntelligenceBundle | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("imphq_projects")
        .select("id, name")
        .order("name");
      const list = (data as Project[]) || [];
      setProjects(list);
      if ((projectId === "__none__" || !projectId) && list.length > 0) {
        setProjectId(list[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!projectId || projectId === "__none__") {
      setIntel(null);
      return;
    }
    loadProjectIntelligence(projectId).then((bundle) => {
      if (!cancelled) setIntel(bundle);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const needsExistingCopy = (id: Intent) =>
    id === "diagnostico_imperador" || id === "breakthrough_techniques" || id === "weaponized_credibility";

  const isDerickNewIntent = (id: Intent) =>
    id === "esteira_anuncios_derick_50_50" || id === "roteiros_comment_to_dm" || id === "nsl_dtc_longform";

  // Auditoria determinística em tempo real sobre o output gerado
  const liveAudit = useMemo(() => {
    if (!output.trim()) return null;
    const medicao = medirEscritaDerick(output, false);
    const congruencia = conferirCongruenciaVslDerick(output, {
      nomeChiclete: intel?.mechanismName,
    });
    const corpus = intel
      ? [...intel.deepPains, intel.externalDesire, intel.internalDesire, intel.enemy, intel.nuclearTrigger]
      : [];
    const voc = vocabularioDoNichoDerick(output, corpus, 10);
    return { medicao, congruencia, voc };
  }, [output, intel]);

  const handleAutoFix = () => {
    if (!output.trim()) return;
    const { textoCorrigido, ajustesAplicados } = autoCorrigirCopyDerickSugamele(output, intel?.mechanismName);
    setOutput(textoCorrigido);
    toast.success(`Copy refinada (${ajustesAplicados.length} ajustes Derick.AI + Sugamele): ${ajustesAplicados[0]}`);
  };

  const runGeneration = async () => {
    if (needsExistingCopy(activeTab) && !copyParaDiagnostico.trim()) {
      toast.error("Cole uma copy/claim para o motor trabalhar.");
      return;
    }
    if (!needsExistingCopy(activeTab) && !briefing.trim() && projectId === "__none__") {
      toast.error("Preencha o briefing ou selecione um projeto.");
      return;
    }

    setLoading(true);
    setOutput("");

    const inputParts: string[] = [];
    if (needsExistingCopy(activeTab)) {
      const label =
        activeTab === "weaponized_credibility"
          ? "COPY/CLAIM A BLINDAR"
          : activeTab === "breakthrough_techniques"
          ? "COPY A POTENCIALIZAR"
          : "COPY A DIAGNOSTICAR";
      inputParts.push(`## ${label}\n` + copyParaDiagnostico);
      if (briefing.trim()) inputParts.push("## CONTEXTO ADICIONAL\n" + briefing);
    } else {
      if (briefing.trim()) inputParts.push("## BRIEFING\n" + briefing);
      if (crenca.trim()) inputParts.push("## CRENÇA-ÂNCORA MANUAL\n" + crenca);
      if (referencia.trim()) inputParts.push("## REFERÊNCIA DE CONCORRENTE\n" + referencia);
    }

    try {
      const { data, error } = await supabase.functions.invoke("copy-engine", {
        body: {
          intent: activeTab,
          input: inputParts.join("\n\n") || "Gere usando o contexto do projeto.",
          context: projectId !== "__none__" ? { project_id: projectId } : undefined,
        },
      });

      if (error || data?.error || !data?.content) {
        if (isDerickNewIntent(activeTab)) {
          const fallback = gerarCopyLabIntentDerickFallback(activeTab, intel, briefing);
          setOutput(fallback);
          toast.success("Peça gerada com o Motor Determinístico Derick.AI + Inteligência do Projeto!");
          setLoading(false);
          return;
        }
        toast.error(error?.message || (typeof data?.error === "string" ? data.error : "Erro ao gerar."));
        setLoading(false);
        return;
      }

      setOutput(data.content);
    } catch {
      if (isDerickNewIntent(activeTab)) {
        const fallback = gerarCopyLabIntentDerickFallback(activeTab, intel, briefing);
        setOutput(fallback);
        toast.success("Peça gerada com o Motor Determinístico Derick.AI + Inteligência do Projeto!");
      } else {
        toast.error("Erro ao invocar copy-engine.");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    toast.success("Copiado.");
  };

  const current = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Crown className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-serif text-3xl md:text-4xl">Copy Lab — Imperador + Derick.AI</h1>
              <p className="text-sm text-muted-foreground">
                Motor unificado: 11 Leis + Método H&W + Derick.AI (Skill 06 50/50 · Comment-to-DM · NSL DTC · Revisor Skill 11).
              </p>
            </div>
          </div>
          {intel && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
                {intel.projectIcon} {intel.projectName} · Avatar: {intel.avatarName}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300">
                Mecanismo: {intel.mechanismName}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {intel.docs.length} Docs · {intel.skills.length} Skills
              </Badge>
            </div>
          )}
        </div>

        <Card className="p-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Projeto (contexto: avatar, branding, produto, docs, swipes e skills)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Sem contexto de projeto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem projeto —</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px]">
                Motor: copy-engine · 28 Skills Ativas (Derick v2.0.0 + H&W + Khayat + Bencivenga + Sugamele)
              </Badge>
            </div>
          </div>
        </Card>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as Intent); setOutput(""); }}>
          <TabsList className="flex flex-wrap h-auto gap-1.5 bg-secondary/40 p-1.5 w-full justify-start">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-1.5 text-xs py-1.5 px-2.5">
                <t.icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
                {t.badge && (
                  <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {t.badge}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((t) => (
            <TabsContent key={t.id} value={t.id} className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground italic">{t.subtitle}</p>

              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-4 space-y-3">
                  {needsExistingCopy(t.id) ? (
                    <>
                      <div>
                        <Label>
                          {t.id === "weaponized_credibility"
                            ? "Copy / claim a blindar"
                            : t.id === "breakthrough_techniques"
                            ? "Copy a potencializar"
                            : "Copy a diagnosticar"}
                        </Label>
                        <Textarea
                          rows={12}
                          placeholder="Cole aqui a copy, claim ou peça que o motor deve trabalhar..."
                          value={copyParaDiagnostico}
                          onChange={(e) => setCopyParaDiagnostico(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Contexto adicional (opcional)</Label>
                        <Textarea
                          rows={3}
                          placeholder={
                            t.id === "weaponized_credibility"
                              ? "Provas brutas, dados, depoimentos, credenciais..."
                              : "Briefing estratégico, diagnóstico, ângulo escolhido..."
                          }
                          value={briefing}
                          onChange={(e) => setBriefing(e.target.value)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label>Briefing livre</Label>
                        <Textarea
                          rows={5}
                          placeholder="Contexto, objetivo, ângulo, oferta (ou deixe em branco para usar o Avatar + Mecanismo do projeto selecionado)..."
                          value={briefing}
                          onChange={(e) => setBriefing(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Crença-âncora (opcional)</Label>
                        <Input
                          placeholder="Ex: 'emagrecer exige sofrimento'"
                          value={crenca}
                          onChange={(e) => setCrenca(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Referência de concorrente (URL ou transcrição)</Label>
                        <Textarea
                          rows={4}
                          placeholder="Cole transcrição de VSL/anúncio para engenharia reversa..."
                          value={referencia}
                          onChange={(e) => setReferencia(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={runGeneration} disabled={loading} className="flex-1">
                      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Crown className="h-4 w-4 mr-2" />}
                      {loading ? "Gerando..." : `Invocar Motor — ${current.label}`}
                    </Button>
                    {isDerickNewIntent(t.id) && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={loading}
                        className="border-amber-500/40 text-amber-300 hover:bg-amber-500/15"
                        onClick={() => {
                          const instant = gerarCopyLabIntentDerickFallback(t.id, intel, briefing);
                          setOutput(instant);
                          toast.success("Gerado instantaneamente via Motor Determinístico Derick.AI!");
                        }}
                      >
                        <Zap className="h-4 w-4 mr-1.5" /> Gerar Instantâneo (Derick)
                      </Button>
                    )}
                  </div>
                </Card>

                <Card className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label className="text-xs">Saída & Auditoria Determinística</Label>
                    {output && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAutoFix}
                          className="h-7 text-[11px] gap-1 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15"
                          title="Aplica regras determinísticas Derick.AI (Leis 48-52 + Skill 11) e Escrita Vinicius Sugamele"
                        >
                          <Wand2 className="h-3 w-3" /> Auto-Corrigir (H&W + Derick + Sugamele)
                        </Button>
                        <Button size="sm" variant="ghost" onClick={copyToClipboard} className="h-7 text-[11px]">
                          <CopyIcon className="h-3 w-3 mr-1" /> Copiar Tudo
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Barra Determinística do Revisor em Tempo Real */}
                  {liveAudit && (
                    <div className="p-2.5 rounded-lg bg-secondary/60 border border-border/80 space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            liveAudit.medicao.aprovado
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          }`}
                        >
                          {liveAudit.medicao.aprovado ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 mr-1" />
                          )}
                          Cadência (Leis 48–52): Mediana {liveAudit.medicao.mediana_palavras}w · Micro{" "}
                          {liveAudit.medicao.pct_micro}% · 28+w: {liveAudit.medicao.longas_28mais.length}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            liveAudit.congruencia.score_congruencia >= 85
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          }`}
                        >
                          Congruência Skill 11: {liveAudit.congruencia.score_congruencia}/100
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-300">
                          VOC Lei 55: {liveAudit.voc.aderencia_pct}% aderência ({liveAudit.voc.termos_usados_na_copy.length} termos)
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Nome Chiclete/1000w: {liveAudit.congruencia.densidade_nome_chiclete_por_1000w}
                        </Badge>
                      </div>
                      {(liveAudit.medicao.motivos.length > 0 || liveAudit.congruencia.alertas.length > 0) && (
                        <div className="text-[11px] text-amber-300/90 flex flex-wrap gap-x-3 gap-y-1">
                          {[...liveAudit.medicao.motivos, ...liveAudit.congruencia.alertas].slice(0, 3).map((al, idx) => (
                            <span key={idx}>• {al}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {output && activeTab === "lote_anuncios_memoflow" && (
                    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-background/80 rounded border border-border/60">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] gap-1 text-primary border-primary/30 font-semibold"
                        onClick={() => {
                          const batch = parseMemoFlowAdBatch(output);
                          navigator.clipboard.writeText(formatBatchForMediaBuyer(batch));
                          toast.success("Briefing executivo copiado para o gestor de tráfego!");
                        }}
                      >
                        <Zap className="h-3 w-3" /> Pacote Gestor (WhatsApp)
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[11px] gap-1 font-medium"
                        onClick={() => {
                          const batch = parseMemoFlowAdBatch(output);
                          navigator.clipboard.writeText(batch.copyMestre);
                          toast.success("Copy Mestre (Texto Principal) copiada!");
                        }}
                      >
                        📝 Copy Mestre
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[11px] gap-1 font-medium"
                        onClick={() => {
                          const batch = parseMemoFlowAdBatch(output);
                          const gText = batch.ganchos.map((g) => `${g.id} (${g.tipo}):\n"${g.texto}"`).join("\n\n");
                          navigator.clipboard.writeText(gText);
                          toast.success("3 Ganchos copiados!");
                        }}
                      >
                        🪝 3 Ganchos
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[11px] gap-1 font-medium"
                        onClick={() => {
                          const batch = parseMemoFlowAdBatch(output);
                          const hText = batch.headlines.map((h) => `${h.id} (${h.tipo}): ${h.texto}`).join("\n");
                          navigator.clipboard.writeText(hText);
                          toast.success("3 Headlines copiadas!");
                        }}
                      >
                        📌 3 Headlines
                      </Button>
                    </div>
                  )}

                  <div className="min-h-[420px] max-h-[70vh] overflow-y-auto prose prose-sm prose-invert max-w-none bg-secondary/40 rounded p-4 leading-7">
                    {output ? (
                      <ReactMarkdown>{output}</ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground text-sm italic">
                        A saída do motor aparece aqui após a invocação (com auditoria determinística Leis 48–55 e Skill 11).
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

