import { useState, useMemo, useEffect } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Globe,
  CreditCard,
  MessageCircle,
  Flame,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Bot,
  Zap,
  TrendingUp,
  AlertTriangle,
  Layers,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { jsonFields } from "@/lib/json-fields";

interface Props {
  project: Tables<"imphq_projects">;
  onNavigateTab?: (tab: string) => void;
  onRefresh?: () => void;
}

export function ProjetoAtivosMestresCard({ project, onNavigateTab, onRefresh }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [creativeModalOpen, setCreativeModalOpen] = useState(false);
  const [variationsModalOpen, setVariationsModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedVariations, setGeneratedVariations] = useState<string[]>([]);

  const [waProvider, setWaProvider] = useState<{
    instance_name: string;
    status: string;
    is_active: boolean;
  } | null>(null);

  const [aiConfig, setAiConfig] = useState<{
    enabled: boolean;
    full_autonomy: boolean;
  } | null>(null);
  const [pendingConvsCount, setPendingConvsCount] = useState<number>(0);

  const projectData = useMemo(() => {
    return jsonFields(project.data);
  }, [project.data]);

  // Carregar status do WhatsApp e IA do projeto
  useEffect(() => {
    async function fetchOpsStatus() {
      // 1. WhatsApp Provider
      const { data: prov } = await supabase
        .from("imphq_wa_providers")
        .select("instance_name, status, is_active")
        .eq("project_id", project.id)
        .order("is_active", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prov) {
        setWaProvider(prov);
      } else {
        // Fallback para provider global
        const { data: globalProv } = await supabase
          .from("imphq_wa_providers")
          .select("instance_name, status, is_active")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (globalProv) setWaProvider(globalProv);
      }

      // 2. IA Config
      const { data: ai } = await supabase
        .from("imphq_wa_ai_config")
        .select("enabled, full_autonomy")
        .eq("project_id", project.id)
        .maybeSingle();

      if (ai) setAiConfig(ai);

      // 3. Conversas paradas no WhatsApp
      const { count } = await supabase
        .from("imphq_wa_conversations")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id)
        .gt("unread_count", 0);

      setPendingConvsCount(count || 0);
    }

    fetchOpsStatus();
  }, [project.id]);

  // 1. Link da VSL / Página Principal
  const vslInfo = useMemo(() => {
    let url = "";
    let label = "Página de Vendas / VSL";

    if (projectData.vsl_url && typeof projectData.vsl_url === "string") {
      url = projectData.vsl_url;
    } else if (Array.isArray(projectData.produtos) && projectData.produtos.length > 0) {
      const p = projectData.produtos.find((prod: any) => prod?.status === "ativo") || projectData.produtos[0];
      if (Array.isArray(p?.links) && p.links.length > 0) {
        url = p.links[0];
        label = p.nome || label;
      }
    }

    if (!url && projectData.links && typeof projectData.links === "object") {
      url = (projectData.links as any).site || "";
    }

    // Fallbacks canônicos conhecidos
    if (!url) {
      if (project.id === "jp_freitas") url = "https://codigodoscortesperfeitos.vercel.app";
      else if (project.id === "linfaflow") url = "https://linfaflow.com/";
      else if (project.id === "slimsoda") url = "https://slimsoda.com/";
    }

    return { url, label };
  }, [projectData, project.id]);

  // 2. Link do Checkout Oficial
  const checkoutInfo = useMemo(() => {
    let url = "";
    let preco = "R$ 47,00";
    let bump = "+ R$ 27,00";

    if (projectData.checkout_url && typeof projectData.checkout_url === "string") {
      url = projectData.checkout_url;
    } else if (project.id === "jp_freitas") {
      url = "https://codigodoscortesperfeitos.vercel.app/inscricao";
      preco = "R$ 47,00 (Curso)";
      bump = "+ R$ 27,00 (Finalização Express)";
    } else if (project.id === "linfaflow") {
      url = "https://linfaflow.com/checkout";
      preco = "R$ 197,00 (Pote 1)";
      bump = "+ R$ 97,00 (Ebook Detox)";
    } else if (project.id === "slimsoda") {
      url = "https://slimsoda.com/checkout";
      preco = "$ 69,00";
      bump = "+ $ 29,00";
    }

    return { url, preco, bump };
  }, [projectData, project.id]);

  // 3. Criativo Winner (Controle)
  const winnerCreative = useMemo(() => {
    const list = Array.isArray(projectData.facebook_creatives) ? projectData.facebook_creatives : [];
    
    // Procura criativo com nome "insegura" ou "cachos" ou o primeiro com copy
    const found = list.find((c: any) =>
      c?.name?.toLowerCase()?.includes("insegura") ||
      c?.body?.toLowerCase()?.includes("insegura")
    ) || list.find((c: any) => c?.body && c.body.length > 50) || null;

    if (found) {
      return {
        title: found.title || found.name || "De insegura a referência em cachos",
        body: found.body || "",
        imageUrl: found.image_url || found.thumbnail_url || null,
        status: found.status || "CAMPAIGN_PAUSED",
      };
    }

    if (project.id === "jp_freitas") {
      return {
        title: "De insegura a referência em cachos",
        body: `De insegura a referência em cachos.\n\nIsso não acontece por sorte.\n\nAcontece quando você aprende o que ninguém ensina:\n\n✔️ Como estruturar um corte que valoriza qualquer tipo de cabelo\n✔️ Como fazer a cliente se apaixonar pelo resultado\n✔️ Como cobrar mais sem medo\n\nHoje, milhares de profissionais estão:\n\n✨ Lotando agenda\n✨ Aumentando preço\n✨ Sendo reconhecidas na cidade\n\nE você pode ser a próxima.\n\nClique em “Saiba Mais” e veja como começar.`,
        imageUrl: null,
        status: "CAMPAIGN_PAUSED",
      };
    }

    return null;
  }, [projectData, project.id]);

  // 4. Status do Tráfego Pago
  const trafficStatus = useMemo(() => {
    const list = Array.isArray(projectData.facebook_creatives) ? projectData.facebook_creatives : [];
    const hasActive = list.some((c: any) => c?.status === "ACTIVE" || c?.status === "ACTIVE_CAMPAIGN");
    return {
      isActive: hasActive,
      label: hasActive ? "Meta Ads Rodando" : "Tráfego Pausado no Meta",
      color: hasActive ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10",
    };
  }, [projectData]);

  const copyToClipboard = (text: string, key: string, label: string) => {
    if (!text) {
      toast.error(`Nenhum link configurado para ${label}`);
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copiado para a área de transferência!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateVariations = async () => {
    if (!winnerCreative?.body) return;
    setGenerating(true);
    setGeneratedVariations([]);
    setVariationsModalOpen(true);

    try {
      const res = await supabase.functions.invoke("chat-with-ai", {
        body: {
          messages: [
            {
              role: "system",
              content:
                "Você é o estrategista chefe de tráfego direto da ImpérioX. Especialista no método John Carlton e Eugene Schwartz. Gere variações de criativos de alta escala para bater controle.",
            },
            {
              role: "user",
              content: `Abaixo está o nosso Criativo Winner (Controle) atual para o produto "${project.name}":\n\n"""\n${winnerCreative.body}\n"""\n\nCom base nas técnicas de quebra de padrão e ganchos (0-3s) de alta conversão, crie 3 VARIAÇÕES DE GANCHO E ABERTURA (Hook 1, Hook 2, Hook 3) mantendo o corpo persuasivo do anúncio.\nEntregue cada variação numerada com: Gancho (1ª linha de impacto) + Texto Principal curto + CTA.\nEm português brasileiro, sem clichês de IA.`,
            },
          ],
          model: "google/gemini-2.5-flash",
        },
      });

      const reply = res.data?.choices?.[0]?.message?.content || res.data?.reply || "";
      if (reply) {
        const parts = reply.split(/(?=Variação \d|Hook \d|Opção \d)/gi).filter(Boolean);
        setGeneratedVariations(parts.length > 1 ? parts : [reply]);
        toast.success("3 Variações geradas com sucesso!");
      } else {
        throw new Error("Sem resposta da IA");
      }
    } catch (err: any) {
      console.error("Erro ao gerar variações:", err);
      toast.error(`Falha ao gerar variações: ${err.message || "Tente novamente"}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Card className="bg-[#0E1013] border-[#1B1E23] rounded-xl overflow-hidden mb-6 shadow-xl relative">
        <div className="absolute top-0 right-0 w-80 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <CardContent className="p-4 sm:p-5">
          {/* Header Superior */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1B1E23]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-primary">
                FICHA RAIO-X · ATIVOS MESTRES & OPERAÇÃO
              </span>
              <Badge variant="outline" className="text-[10px] font-mono border-white/10 text-muted-foreground">
                {project.category || "Infoproduto"}
              </Badge>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-[11px] font-mono font-medium ${trafficStatus.color}`}>
                <TrendingUp className="h-3 w-3 mr-1 inline" />
                {trafficStatus.label}
              </Badge>

              {waProvider && (
                <Badge variant="outline" className="text-[11px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                  <Bot className="h-3 w-3 mr-1 inline" />
                  WA: {waProvider.instance_name} ({aiConfig?.full_autonomy ? "100% IA" : "Ativo"})
                </Badge>
              )}
            </div>
          </div>

          {/* Grid dos 4 Ativos Fundamentais */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-3">
            {/* 1. PÁGINA / VSL ATIVA */}
            <div className="bg-[#121418] border border-[#1E2228] hover:border-primary/40 transition-colors rounded-lg p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Globe className="h-3.5 w-3.5 text-primary" /> VSL & Página Ativa
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono border-primary/20 text-primary">
                    OFICIAL
                  </Badge>
                </div>
                <p className="text-xs font-mono text-zinc-300 truncate select-all py-1 bg-black/40 px-2 rounded border border-white/5" title={vslInfo.url}>
                  {vslInfo.url || "URL não cadastrada"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                  {vslInfo.label}
                </p>
              </div>

              <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/5">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-[11px] gap-1 border-white/10 hover:border-primary/50"
                  onClick={() => copyToClipboard(vslInfo.url, "vsl", "Link da VSL")}
                >
                  {copiedKey === "vsl" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedKey === "vsl" ? "Copiado!" : "Copiar Link"}
                </Button>
                {vslInfo.url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] text-zinc-400 hover:text-white"
                    onClick={() => window.open(vslInfo.url, "_blank")}
                    title="Abrir página em nova aba"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* 2. CHECKOUT OFICIAL */}
            <div className="bg-[#121418] border border-[#1E2228] hover:border-primary/40 transition-colors rounded-lg p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <CreditCard className="h-3.5 w-3.5 text-emerald-400" /> Checkout Oficial
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/20 text-emerald-400">
                    CONVERTENDO
                  </Badge>
                </div>
                <p className="text-xs font-semibold text-zinc-200 truncate py-1">
                  {checkoutInfo.preco}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Order Bump: <span className="text-emerald-400 font-mono">{checkoutInfo.bump}</span>
                </p>
              </div>

              <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/5">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-[11px] gap-1 border-white/10 hover:border-emerald-500/50"
                  onClick={() => copyToClipboard(checkoutInfo.url, "checkout", "Checkout")}
                >
                  {copiedKey === "checkout" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedKey === "checkout" ? "Copiado!" : "Copiar Checkout"}
                </Button>
                {checkoutInfo.url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] text-zinc-400 hover:text-white"
                    onClick={() => window.open(checkoutInfo.url, "_blank")}
                    title="Abrir checkout direto"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* 3. WHATSAPP & IA AUTÔNOMA */}
            <div className="bg-[#121418] border border-[#1E2228] hover:border-primary/40 transition-colors rounded-lg p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <MessageCircle className="h-3.5 w-3.5 text-green-400" /> WhatsApp & IA
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                    <Zap className="h-2.5 w-2.5 inline" /> {aiConfig?.full_autonomy ? "100% IA" : "Co-piloto"}
                  </span>
                </div>
                <p className="text-xs font-mono font-medium text-zinc-200 truncate py-0.5">
                  Instância: <span className="text-primary">{waProvider?.instance_name || "Nenhuma"}</span>
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Fila: {pendingConvsCount > 0 ? (
                    <span className="text-amber-400 font-mono font-semibold">⚠️ {pendingConvsCount} conversas paradas</span>
                  ) : (
                    <span className="text-emerald-400 font-mono">🟢 Fila zerada</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/5">
                <Button
                  size="sm"
                  variant="outline"
                  className={`flex-1 h-7 text-[11px] gap-1 border-white/10 ${pendingConvsCount > 0 ? "border-amber-500/30 text-amber-300 hover:border-amber-500/60 hover:bg-amber-500/10" : "hover:border-green-500/50"}`}
                  onClick={() => onNavigateTab ? onNavigateTab("openflow") : window.location.assign("/inbox?tab=whatsapp")}
                >
                  <Bot className="h-3 w-3 text-green-400" />
                  {pendingConvsCount > 0 ? `Atender Fila (${pendingConvsCount})` : "Ver Atendimentos"}
                </Button>
              </div>
            </div>

            {/* 4. CRIATIVO CONTROLE (WINNER) */}
            <div className="bg-[#121418] border border-[#1E2228] hover:border-amber-500/40 transition-colors rounded-lg p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Flame className="h-3.5 w-3.5 text-amber-400" /> Criativo Controle
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono border-amber-500/30 text-amber-400">
                    WINNER
                  </Badge>
                </div>
                <p className="text-xs font-semibold text-zinc-200 truncate py-1" title={winnerCreative?.title}>
                  "{winnerCreative?.title || "Sem criativo fixado"}"
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Referência para novos testes C1/C2
                </p>
              </div>

              <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/5">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-[11px] gap-1 border-white/10 hover:border-amber-500/50"
                  onClick={() => setCreativeModalOpen(true)}
                  disabled={!winnerCreative?.body}
                >
                  <Copy className="h-3 w-3" />
                  Ver Copy Mestre
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] text-amber-400 hover:bg-amber-500/10"
                  onClick={handleGenerateVariations}
                  title="Gerar 3 Variações de Gancho com IA"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MODAL 1: VISUALIZAÇÃO DO CRIATIVO CONTROLE (WINNER) */}
      <Dialog open={creativeModalOpen} onOpenChange={setCreativeModalOpen}>
        <DialogContent className="bg-[#0E1013] border-[#1B1E23] text-white max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-400" />
              <DialogTitle className="text-lg font-bold">Criativo Controle (Winner)</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Este é o anúncio de maior conversão do projeto. Use como base para gerar novos ângulos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2">
            <div>
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Título / Ângulo:</span>
              <p className="text-sm font-semibold text-primary">{winnerCreative?.title}</p>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Texto Completo da Copy:</span>
              <div className="bg-black/60 border border-white/10 rounded-lg p-3 text-xs font-sans text-zinc-300 whitespace-pre-wrap max-h-60 overflow-y-auto mt-1 leading-relaxed">
                {winnerCreative?.body}
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5"
              onClick={handleGenerateVariations}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Gerar 3 Variações do Winner
            </Button>
            <Button
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => copyToClipboard(winnerCreative?.body || "", "creative_body", "Copy do Anúncio")}
            >
              {copiedKey === "creative_body" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedKey === "creative_body" ? "Copiado!" : "Copiar Texto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: 3 VARIAÇÕES DE GANCHO GERADAS PELA IA (SPIN DO CONTROLE) */}
      <Dialog open={variationsModalOpen} onOpenChange={setVariationsModalOpen}>
        <DialogContent className="bg-[#0E1013] border-[#1B1E23] text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-bold">Spin do Controle — 3 Novos Ganchos (Khayat DTC)</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Variações de abertura (0 a 3s) geradas pela IA aplicando Eugene Schwartz para testar contra o Winner.
            </DialogDescription>
          </DialogHeader>

          {generating ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-xs font-mono text-muted-foreground">
                Analisando psicologia de retenção e gerando novos ganchos...
              </p>
            </div>
          ) : (
            <div className="space-y-4 my-2">
              {generatedVariations.map((v, i) => (
                <div key={i} className="bg-black/50 border border-white/10 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                      VARIAÇÃO #{i + 1}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-white"
                      onClick={() => copyToClipboard(v, `var_${i}`, `Variação ${i + 1}`)}
                    >
                      {copiedKey === `var_${i}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      Copiar
                    </Button>
                  </div>
                  <div className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans">
                    {v}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVariationsModalOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
