import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  Zap,
  Copy,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Megaphone,
  Globe,
  ShoppingCart,
  TrendingUp,
  FileText,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FunnelDiagnosticItem } from "@shared/funnel-diagnostics";

interface FunnelRemediationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagnostic: FunnelDiagnosticItem | null;
  projectName?: string;
}

export function FunnelRemediationModal({
  open,
  onOpenChange,
  diagnostic,
  projectName,
}: FunnelRemediationModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"solucao" | "ativos" | "diretriz">("solucao");

  if (!diagnostic) return null;

  const copyToClipboard = (text: string, key: string, label = "Conteúdo copiado!") => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(label);
    setTimeout(() => setCopiedKey(null), 2500);
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
                    code: "<script defer src=\"https://...\"></script>",
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

      default:
        return (
          <div className="space-y-3 text-xs text-muted-foreground">
            <p>{diagnostic.recommendation}</p>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Zap className="h-4 w-4" />
            </span>
            <DialogTitle className="text-base font-semibold">
              Remediação Autônoma: {diagnostic.badge}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {diagnostic.title} · Transição: {diagnostic.stagePair.join(" ➔ ")}
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          {renderRemediationContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
