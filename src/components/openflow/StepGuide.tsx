import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Mail, MessageCircle, Mic, Sparkles, Tag, 
  Split, GitBranch, Clock, Timer, Globe, Repeat, Octagon, Brain, Bell
} from "lucide-react";

const steps = [
  {
    icon: Zap,
    title: "Gatilho (Trigger)",
    description: "O ponto de partida da automação. Define qual evento do lead (ex: Carrinho Abandonado, Novo Lead, Compra Aprovada) dispara o fluxo.",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    description: "Envia uma mensagem direta de texto. Suporta variáveis dinâmicas como {{nome}} e {{produto}}.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    icon: Mail,
    title: "Email",
    description: "Dispara um email transacional via Resend. Ideal para enviar links de acesso ou conteúdos longos.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: Sparkles,
    title: "IA Conversacional",
    description: "A 'Mente' da automação. A IA assume a conversa, entende o lead e tenta cumprir um objetivo específico (ex: quebrar objeções de preço).",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    icon: Mic,
    title: "Áudio IA",
    description: "Envia um áudio no WhatsApp simulando uma gravação humana. Aumenta drasticamente a taxa de conversão e confiança.",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
  {
    icon: Clock,
    title: "Aguardar (Delay)",
    description: "Pausa o fluxo por um tempo determinado (minutos, horas ou dias) antes de seguir para a próxima etapa.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: GitBranch,
    title: "Condição (Se...)",
    description: "Ramifica o fluxo com base em uma condição (ex: se o lead abriu o email, vai para o caminho A, se não, caminho B).",
    color: "text-violet-400",
    bg: "bg-violet-400/10",
  },
  {
    icon: Split,
    title: "Teste A/B",
    description: "Divide os leads entre dois caminhos diferentes para testar qual estratégia ou copy converte mais.",
    color: "text-fuchsia-400",
    bg: "bg-fuchsia-400/10",
  },
  {
    icon: Globe,
    title: "Webhook / API",
    description: "Integra com ferramentas externas enviando ou recebendo dados em tempo real.",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
  {
    icon: Repeat,
    title: "Loop",
    description: "Repete uma sequência de etapas por um número definido de vezes ou até que uma condição seja atendida.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    icon: Octagon,
    title: "Parar Fluxo",
    description: "Encerra a automação imediatamente se um evento específico ocorrer (ex: o lead comprou no meio da régua).",
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    icon: Bell,
    title: "Notificar Atendente",
    description: "Envia um alerta para sua equipe quando um lead atinge um estágio crítico ou demonstra alta intenção.",
    color: "text-rose-400",
    bg: "bg-rose-400/10",
  }
];

export function StepGuide() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {steps.map((step, idx) => (
          <Card key={idx} className="bg-slate-900/40 border-white/5 hover:border-primary/20 transition-all group">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className={`p-2 rounded-lg ${step.bg}`}>
                <step.icon className={`h-5 w-5 ${step.color}`} />
              </div>
              <CardTitle className="text-base">{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card className="bg-purple-900/10 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-purple-400">
            <Brain className="h-5 w-5" /> Dica de Especialista: O Fluxo Ideal
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-300 space-y-2">
          <p>
            Para uma recuperação eficiente, comece sempre com um <strong>Gatilho</strong> de alta intenção e um <strong>Aguardar</strong> curto (10-30min).
          </p>
          <p>
            Use a <strong>IA Conversacional</strong> para tratar leads que respondem mas não compram imediatamente. Ela é capaz de identificar o motivo da desistência e aplicar o prompt de persuasão correto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
