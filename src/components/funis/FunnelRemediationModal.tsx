import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Copy,
  ExternalLink,
  Loader2,
  Check,
  KanbanSquare,
  FlaskConical,
  Sparkles,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { jsonFields } from "@/lib/json-fields";
import { errorMessage } from "@/lib/error-message";
import { normalizeVariants, slugify } from "@shared/page-split";
import type { Json } from "@/integrations/supabase/types";
import type { FunnelDiagnosticItem } from "@shared/funnel-diagnostics";
import {
  buildKanbanCardFromDiagnostic,
  generateAntiFatigueHooks,
  type AntiFatigueHookInput,
} from "@shared/funnel-sentinel";
import { SPLIT_BASE_URL } from "@/hooks/usePageSplits";

interface FunnelRemediationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagnostic: FunnelDiagnosticItem | null;
  projectName?: string;
  projectId?: string | null;
  controlUrl?: string | null;
  onLaunchAbTest?: (preset: { nome: string; controlUrl: string; challengerUrl: string }) => void;
}

export function FunnelRemediationModal({
  open,
  onOpenChange,
  diagnostic,
  projectName,
  projectId,
  controlUrl,
  onLaunchAbTest,
}: FunnelRemediationModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"playbook" | "hooks" | "abtest">("playbook");
  const [dispatchingKanban, setDispatchingKanban] = useState(false);
  const [kanbanDispatched, setKanbanDispatched] = useState(false);

  // Contexto real do projeto (avatar + mecanismo) para o Gerador Anti-Fadiga P1-P5
  const [hookContext, setHookContext] = useState<AntiFatigueHookInput>({
    projectName: projectName || "Produto",
  });

  // Estado do Lançador de Teste A/B 50/50
  const [splitNome, setSplitNome] = useState("");
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");
  const [creatingSplit, setCreatingSplit] = useState(false);
  const [createdSplitLink, setCreatedSplitLink] = useState<string | null>(null);

  useEffect(() => {
    if (!diagnostic) return;
    setKanbanDispatched(false);
    setCreatedSplitLink(null);
    setActiveView(diagnostic.action.type === "creatives" ? "hooks" : "playbook");

    const baseControl = controlUrl || "https://seudominio.com/pv";
    setSplitNome(`Desafio A/B · ${diagnostic.badge}`);
    setUrlA(baseControl);
    setUrlB(baseControl.includes("?") ? `${baseControl}&v=b` : `${baseControl}?v=b-desafiante`);
  }, [diagnostic, controlUrl]);

  useEffect(() => {
    if (!open || !projectId) {
      setHookContext({ projectName: projectName || "Protocolo" });
      return;
    }
    let cancelled = false;
    supabase
      .from("imphq_projects")
      .select("name, avatar, data")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const av = jsonFields(data.avatar);
        const pData = jsonFields(data.data);
        setHookContext({
          projectName: data.name || projectName || "Protocolo",
          avatarNome: typeof av.nome === "string" ? av.nome : undefined,
          dorPrincipal:
            typeof av.dor_principal === "string"
              ? av.dor_principal
              : typeof av.dores === "string"
              ? av.dores
              : undefined,
          desejoPrincipal:
            typeof av.desejo_principal === "string"
              ? av.desejo_principal
              : typeof av.desejos === "string"
              ? av.desejos
              : undefined,
          mecanismoNome:
            typeof pData.mecanismo_unico === "string"
              ? pData.mecanismo_unico
              : typeof pData.mecanismo === "string"
              ? pData.mecanismo
              : undefined,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, projectName]);

  const hooksList = useMemo(() => {
    return generateAntiFatigueHooks(hookContext);
  }, [hookContext]);

  if (!diagnostic) return null;

  const copyToClipboard = (text: string, key: string, label = "Conteúdo copiado!") => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(label);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // ITEM 2: Despacho em 1 Clique para o Kanban da Equipe
  const handleDispatchToKanban = async () => {
    setDispatchingKanban(true);
    try {
      const cardPayload = buildKanbanCardFromDiagnostic(
        diagnostic,
        projectId,
        hookContext.projectName || projectName
      );

      // Tenta localizar a primeira coluna do quadro operacional
      let firstColId: string | null = null;
      const { data: cols } = await supabase
        .from("imphq_kanban_columns")
        .select("id")
        .in("board", ["operacional", "geral"])
        .order("position", { ascending: true })
        .limit(1);
      if (cols && cols.length > 0) {
        firstColId = cols[0].id;
      }

      const { error } = await supabase.from("imphq_kanban_cards").insert({
        ...cardPayload,
        column_id: firstColId,
      });

      if (error) throw error;
      setKanbanDispatched(true);
      toast.success("Card urgente despachado para o Kanban da equipe!");
    } catch (err) {
      toast.error("Não foi possível despachar para o Kanban: " + errorMessage(err));
    } finally {
      setDispatchingKanban(false);
    }
  };

  // ITEM 3: Lançador de Teste A/B 50/50 direto do Gargalo
  const handleCreateAbSplit = async () => {
    if (!projectId) {
      if (onLaunchAbTest) {
        onLaunchAbTest({ nome: splitNome, controlUrl: urlA, challengerUrl: urlB });
        onOpenChange(false);
      }
      return;
    }

    setCreatingSplit(true);
    try {
      const list = normalizeVariants([
        { key: "A", url: urlA.trim(), peso: 1 },
        { key: "B", url: urlB.trim(), peso: 1 },
      ]);
      if (list.length < 2) {
        throw new Error("Informe URLs completas (https://...) para a Página A (Controle) e Página B (Desafiante).");
      }
      const slug = `${slugify(splitNome)}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await supabase.from("imphq_page_splits").insert({
        project_id: projectId,
        slug,
        nome: splitNome.trim() || "Teste A/B de Gargalo",
        variantes: list as unknown as Json,
      });
      if (error) throw error;

      const finalLink = SPLIT_BASE_URL + slug;
      setCreatedSplitLink(finalLink);
      navigator.clipboard.writeText(finalLink);
      toast.success("Teste A/B (50/50) criado! Link único copiado para a área de transferência.");
      if (onLaunchAbTest) {
        onLaunchAbTest({ nome: splitNome, controlUrl: urlA, challengerUrl: urlB });
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCreatingSplit(false);
    }
  };

  // Conteúdo gerado conforme o tipo de gargalo
  const renderRemediationContent = () => {
    switch (diagnostic.action.type) {
      case "pagespeed":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              ⚡ <strong>Meta de Otimização:</strong> Reduzir o tempo de carregamento da página de vendas para menos de 2.2 segundos no mobile e elevar a Taxa de Chegada para 75%+.
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Checklist Técnico de Execução Imediata:
              </h5>
              <div className="space-y-2 text-xs">
                {[
                  {
                    title: "1. Conversão em Massa para WebP",
                    desc: "Substituir todas as imagens PNG/JPG da landing page e thumbnail da VSL por formato WebP com qualidade 80% (tamanho máximo de 120KB por asset).",
                    code: "cwebp -q 80 imagem.png -o imagem.webp",
                  },
                  {
                    title: "2. Adiar Scripts de Terceiros e Pixels Secundários",
                    desc: "Configurar o GTM ou tags de TikTok/Google/Clarity com carregamento assíncrono atrasado (delay de 2000ms após o evento DOMContentLoaded), garantindo que a página abra instantaneamente.",
                    code: '<script defer src="https://..."></script>',
                  },
                  {
                    title: "3. Cache de Borda na CDN (Cloudflare / Vercel)",
                    desc: "Ativar 'Early Hints', compressão Brotli e regra de Edge Cache com TTL de 4 horas para arquivos estáticos (CSS, JS e imagens).",
                    code: "Cache-Control: public, max-age=14400, stale-while-revalidate=86400",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{item.title}</span>
                      <button
                        onClick={() => copyToClipboard(item.code, `ps-${idx}`, "Snippet copiado!")}
                        className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        {copiedKey === `ps-${idx}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        Snippet
                      </button>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
              <a
                href="https://pagespeed.web.dev/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Abrir Google PageSpeed Insights
              </a>
              <Button
                size="sm"
                onClick={() =>
                  copyToClipboard(
                    `[AUDITORIA VELOCIDADE LP - ${projectName || "Geral"}]:\nMeta: Subir taxa de chegada para 75%+\n1. Compactar todas as imagens para WebP (<120KB).\n2. Adiar scripts de tracking em 2s.\n3. Habilitar Brotli e cache CDN.`,
                    "ps-all",
                    "Plano técnico completo copiado!"
                  )
                }
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar Plano Técnico
              </Button>
            </div>
          </div>
        );

      case "copy_vsl":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-primary">
              🎬 <strong>Meta de Otimização:</strong> Reter os visitantes nos primeiros 5 minutos e elevar a taxa de Início de Checkout para 8%–12%.
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                3 Intervenções Cirúrgicas na VSL & Página:
              </h5>
              <div className="space-y-2.5 text-xs">
                {[
                  {
                    title: "1. Antecipação do Pitch & Delay do Botão",
                    desc: "Reduzir o tempo de aparição do botão de compra em 45 a 60 segundos. O botão deve aparecer exatamente na primeira menção à solução e ao nome da oferta.",
                    actionText: "Ajustar delay no player (VTurb / Panda Video)",
                  },
                  {
                    title: "2. Gancho de Curiosidade dos 0 aos 90 segundos",
                    desc: "Instalar um loop aberto imediato: 'Nos próximos 4 minutos eu vou te mostrar por que o método convencional falha, e qual é o único mecanismo natural capaz de resolver a causa raiz.'",
                    actionText: "Adicionar frase de retenção nos primeiros 30s",
                  },
                  {
                    title: "3. Headline Alinhada com a Promessa do Anúncio",
                    desc: "Se o anúncio vencedor fala de 'Ingrediente matinal', a headline da página precisa validar essa mesma terminologia na primeira linha visual da tela.",
                    actionText: "Espelhar headline com criativo vencedor",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-card p-3 space-y-1">
                    <span className="font-semibold text-foreground">{item.title}</span>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">{item.desc}</p>
                    <span className="inline-block rounded bg-secondary/80 px-2 py-0.5 text-[10px] font-mono text-primary mt-1">
                      💡 {item.actionText}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <Button
                size="sm"
                onClick={() =>
                  copyToClipboard(
                    `[DIRETRIZ DE REVISÃO DE VSL - ${projectName || "Geral"}]:\n1. Antecipar delay do botão em 45 segundos.\n2. Injetar loop de curiosidade nos 0-90s com promessa clara do Mecanismo Único.\n3. Alinhar headline da primeira dobra com o anúncio de maior CTR.`,
                    "vsl-all",
                    "Roteiro de intervenção da VSL copiado!"
                  )
                }
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar Roteiro de Intervenção
              </Button>
            </div>
          </div>
        );

      case "checkout_friction":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
              💳 <strong>Meta de Otimização:</strong> Destravar a conversão de pagamento para 50%+ aprovados, eliminando abandono por formulário longo e recusas de cartão.
            </div>

            <div className="space-y-2 text-xs">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Configuração Canônica de Checkout de Alta Conversão:
              </h5>
              <div className="space-y-2">
                {[
                  {
                    title: "1. Formulário em 1 Passo (4 Campos Apenas)",
                    desc: "Remover endereço, complemento e CEP para infoprodutos. Solicitar estritamente: Nome Completo, E-mail, Celular (com DDD) e CPF.",
                  },
                  {
                    title: "2. PIX Instantâneo Pré-Selecionado",
                    desc: "Colocar a aba PIX como método padrão ao abrir o checkout, com exibição de desconto visual (ex.: 'Economize R$ 10 no PIX'). No Brasil, 65%+ das compras de baixo ticket fecham no PIX.",
                  },
                  {
                    title: "3. Contingência de Gateway Automática",
                    desc: "Se o gateway primário recusar cartão por suspeita de antifraude, encaminhar automaticamente a transação para o gateway reserva (fallback sem fricção pro comprador).",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-card p-3 space-y-1">
                    <span className="font-semibold text-foreground">{item.title}</span>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <Button
                size="sm"
                onClick={() =>
                  copyToClipboard(
                    `[CHECKOUT CRO - ${projectName || "Geral"}]:\n1. Ativar 4 campos mínimos: Nome, Email, Celular, CPF.\n2. Definir PIX como aba padrão ativa com QR Code imediato.\n3. Ativar fallback de gateway para cartões recusados.`,
                    "chk-all",
                    "Checklist de checkout copiado!"
                  )
                }
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar Checklist de Checkout
              </Button>
            </div>
          </div>
        );

      case "bumps":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              📦 <strong>Meta de Otimização:</strong> Subir o take-rate de Order Bump de 10% para 20%+ e elevar o Ticket Médio imediato.
            </div>

            <div className="space-y-2 text-xs">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                3 Conceitos de Bump de Alta Conversão:
              </h5>
              <div className="space-y-2">
                {[
                  {
                    type: "Acelerador",
                    title: "Protocolo de Aceleração 7 Dias (R$ 19,90)",
                    pitch: "'Sim! Quero acelerar meus resultados na metade do tempo com o checklist passo a passo de ação rápida para a primeira semana.'",
                  },
                  {
                    type: "Proteção / Blindagem",
                    title: "Garantia Estendida Blindada de 1 Ano (R$ 14,90)",
                    pitch: "'Adicione cobertura total e suporte prioritário VIP por 12 meses direto pelo WhatsApp com nossa equipe.'",
                  },
                  {
                    type: "Áudio / Hábito",
                    title: "Áudios de Reprogramação Subconsciente (R$ 24,90)",
                    pitch: "'Sessões em áudio binaural de 10 minutos para reprogramar sua disciplina mental todas as noites antes de dormir.'",
                  },
                ].map((bump, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        [{bump.type}] {bump.title}
                      </span>
                      <button
                        onClick={() => copyToClipboard(bump.pitch, `bump-${idx}`, "Texto do bump copiado!")}
                        className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" /> Copiar Copy
                      </button>
                    </div>
                    <p className="text-muted-foreground text-[11px] italic bg-background/50 p-2 rounded border border-border/60">
                      {bump.pitch}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <Button
                size="sm"
                onClick={() =>
                  copyToClipboard(
                    `[PROPOSTAS DE ORDER BUMP - ${projectName || "Geral"}]:\n1. Acelerador 7 Dias (R$ 19,90)\n2. Garantia VIP 1 Ano (R$ 14,90)\n3. Áudios Binaurais (R$ 24,90)`,
                    "bump-all",
                    "Pacote de Order Bumps copiado!"
                  )
                }
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar Pacote de Bumps
              </Button>
            </div>
          </div>
        );

      case "recovery_wa":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
              💬 <strong>Meta de Otimização:</strong> Recuperar 20%+ dos abandonos de PIX e cartão com régua humanizada de suporte em vez de mensagens frias automáticas.
            </div>

            <div className="space-y-2 text-xs">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Régua de 3 Toques Humanizados:
              </h5>
              <div className="space-y-2.5">
                {[
                  {
                    timing: "Disparo 1: 5 a 10 minutos após o abandono (Janela de Impulso)",
                    copy: "Oi [Nome], tudo bem? Vi aqui no sistema que você tentou gerar o acesso ao [Produto], mas deu uma oscilação na confirmação do PIX. Teve alguma dificuldade ou quer que eu te envie a chave direta por aqui?",
                  },
                  {
                    timing: "Disparo 2: 45 minutos após (Áudio Humanizado)",
                    copy: "[ÁUDIO DE 25s]: 'Oi [Nome], passei só pra te avisar que eu separei o seu bônus de boas-vindas manualmente aqui comigo. Como as vagas dessa turma fecham hoje, se você ainda quiser garantir, me dá um toque aqui que eu libero seu link agora!'",
                  },
                  {
                    timing: "Disparo 3: 24 horas após (Último Aviso com Condição Especial)",
                    copy: "Oi [Nome], vou precisar liberar sua vaga para o próximo da lista de espera hoje às 18h. Se você ainda tem interesse em começar o protocolo, me avisa agora que consigo manter sua condição promocional.",
                  },
                ].map((touch, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-[11px]">{touch.timing}</span>
                      <button
                        onClick={() => copyToClipboard(touch.copy, `wa-${idx}`, "Mensagem copiada!")}
                        className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" /> Copiar
                      </button>
                    </div>
                    <p className="text-muted-foreground text-[11px] bg-background/50 p-2 rounded border border-border/60">
                      {touch.copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <Button
                size="sm"
                onClick={() =>
                  copyToClipboard(
                    `[RÉGUA WHATSAPP HUMANIZADA - ${projectName || "Geral"}]:\nToque 1 (5-10m):\nOi [Nome], vi que deu uma oscilação no seu PIX. Quer ajuda direta?\n\nToque 2 (45m):\nÁudio: Segurei seu bônus manualmente aqui.\n\nToque 3 (24h):\nÚltimo aviso de liberação de vaga.`,
                    "wa-all",
                    "Régua completa copiada!"
                  )
                }
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar Régua Completa
              </Button>
            </div>
          </div>
        );

      case "creatives":
      default:
        return renderHooksGenerator();
    }
  };

  // ITEM 4: Gerador Anti-Fadiga de Ganchos (P1–P5) conectado ao Avatar e Mecanismo
  const renderHooksGenerator = () => {
    const fullHooksText = hooksList
      .map(
        (h) =>
          `[${h.code} · ${h.angle}]\n• Gancho (0-3s): ${h.hook0to3s}\n• 1ª Linha (Primary Text): ${h.primaryTextFirstLine}\n• Direção Visual: ${h.visualDirection}`
      )
      .join("\n\n");

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-primary flex items-center justify-between gap-2 flex-wrap">
          <div>
            🎯 <strong>Fábrica Anti-Fadiga de Ganchos (P1–P5):</strong> 5 variações de abertura ancoradas no mecanismo e avatar de{" "}
            <strong>{hookContext.projectName}</strong> para recuperar CTR acima de 1,5% e derrubar o CPA.
          </div>
          {hookContext.mecanismoNome && (
            <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary">
              Mecanismo: {hookContext.mecanismoNome}
            </Badge>
          )}
        </div>

        <div className="space-y-2.5 text-xs">
          {hooksList.map((h) => (
            <div key={h.code} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/20 text-primary border-primary/30 font-mono text-[10px]">
                    {h.code}
                  </Badge>
                  <span className="font-semibold text-foreground">{h.angle}</span>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `[${h.code} - ${h.angle}]\nGancho 0-3s: ${h.hook0to3s}\n1ª Linha: ${h.primaryTextFirstLine}\nVisual: ${h.visualDirection}`,
                      `hook-${h.code}`,
                      `Gancho ${h.code} copiado!`
                    )
                  }
                  className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  {copiedKey === `hook-${h.code}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  Copiar {h.code}
                </button>
              </div>

              <div className="rounded bg-background/60 border border-border/60 p-2 space-y-1">
                <p className="text-foreground font-medium text-[11px]">
                  🎙️ <span className="text-primary font-mono text-[10px]">GANCHO 0-3s:</span> {h.hook0to3s}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  📝 <span className="font-mono text-[10px] text-foreground/80">1ª LINHA DO ANÚNCIO:</span> {h.primaryTextFirstLine}
                </p>
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5 flex-wrap gap-1">
                <span>🎬 {h.visualDirection}</span>
                <span className="text-emerald-400/90">💡 {h.whyItWorks}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-border flex justify-end">
          <Button
            size="sm"
            onClick={() => copyToClipboard(fullHooksText, "hooks-all", "Lote P1–P5 copiado com sucesso!")}
            className="gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar Lote P1–P5 Completo
          </Button>
        </div>
      </div>
    );
  };

  // ITEM 3: Lançador de Teste A/B 50/50 direto do Gargalo
  const renderAbTestLauncher = () => {
    return (
      <div className="space-y-4 text-xs">
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sky-300">
          🧪 <strong>Lançador de Teste A/B Desafiante (50/50):</strong> Divida o tráfego ao meio entre a sua página atual (Controle A) e uma página otimizada (Desafiante B) para validar a melhora de conversão com rigor estatístico.
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-3.5">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Nome do Experimento A/B</label>
            <Input
              value={splitNome}
              onChange={(e) => setSplitNome(e.target.value)}
              placeholder="Ex.: Desafio VSL Curta vs Controle"
              className="h-8 text-xs"
            />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-primary font-semibold">
                Variante A · Página Controle (50%)
              </label>
              <Input
                value={urlA}
                onChange={(e) => setUrlA(e.target.value)}
                placeholder="https://seudominio.com/pv-atual"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-emerald-400 font-semibold">
                Variante B · Página Desafiante (50%)
              </label>
              <Input
                value={urlB}
                onChange={(e) => setUrlB(e.target.value)}
                placeholder="https://seudominio.com/pv-otimizada"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {createdSplitLink && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2.5 flex items-center justify-between gap-2">
              <div className="truncate font-mono text-[11px] text-emerald-300">
                ✓ Link Divisor Ativo: <strong>{createdSplitLink}</strong>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => copyToClipboard(createdSplitLink, "split-link", "Link do Teste A/B copiado!")}
              >
                <Copy className="h-3 w-3 mr-1" /> Copiar Link
              </Button>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              onClick={handleCreateAbSplit}
              disabled={creatingSplit}
              className="gap-1.5"
            >
              {creatingSplit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
              Criar Teste A/B (50/50) e Copiar Link
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Zap className="h-4 w-4" />
              </span>
              <DialogTitle className="text-base font-semibold">
                Remediação Autônoma: {diagnostic.badge}
              </DialogTitle>
            </div>

            {/* Seletor Rápido entre Playbook, Ganchos P1-P5 e Teste A/B */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/40 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveView("playbook")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeView === "playbook" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ⚡ Playbook
              </button>
              <button
                type="button"
                onClick={() => setActiveView("hooks")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                  activeView === "hooks" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Megaphone className="h-3 w-3" /> Ganchos P1–P5
              </button>
              <button
                type="button"
                onClick={() => setActiveView("abtest")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                  activeView === "abtest" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FlaskConical className="h-3 w-3" /> Teste A/B
              </button>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {diagnostic.title} · Transição: {diagnostic.stagePair.join(" ➔ ")}
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          {activeView === "playbook" && renderRemediationContent()}
          {activeView === "hooks" && renderHooksGenerator()}
          {activeView === "abtest" && renderAbTestLauncher()}
        </div>

        {/* Barra Executiva de Despacho (Gargalo ➔ Kanban & A/B) */}
        <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Transforme este diagnóstico em tarefa rastreável para a equipe:</span>
          </div>

          <div className="flex items-center gap-2">
            {activeView !== "abtest" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveView("abtest")}
                className="h-8 text-xs gap-1.5"
              >
                <FlaskConical className="h-3.5 w-3.5 text-sky-400" />
                Desafiar em Teste A/B
              </Button>
            )}

            <Button
              size="sm"
              variant={kanbanDispatched ? "outline" : "default"}
              disabled={dispatchingKanban || kanbanDispatched}
              onClick={handleDispatchToKanban}
              className="h-8 text-xs gap-1.5 font-semibold"
            >
              {dispatchingKanban ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : kanbanDispatched ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <KanbanSquare className="h-3.5 w-3.5" />
              )}
              {kanbanDispatched ? "Despachado ao Kanban ✓" : "Despachar para o Kanban"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
