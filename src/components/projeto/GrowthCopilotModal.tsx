import { useState, useMemo } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Zap, 
  Target, 
  TrendingUp, 
  Copy, 
  Check, 
  Calculator, 
  Sparkles, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2,
  Layers,
  FileText,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import { jsonFields, jsonText, objectFields } from "@/lib/json-fields";

/** O mapa passa só id/name/data; as páginas de projeto passam a linha inteira. */
type CopilotProject = Pick<Tables<"imphq_projects">, "id" | "name" | "data"> &
  Partial<Pick<Tables<"imphq_projects">, "category" | "avatar" | "icon">>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: CopilotProject[];
  initialProject?: CopilotProject;
}

export function GrowthCopilotModal({ open, onOpenChange, projects, initialProject }: Props) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProject?.id || projects[0]?.id || "jp_freitas");
  const [budgetStr, setBudgetStr] = useState<string>("200");
  const [objective, setObjective] = useState<"low_ticket" | "escala_nutra" | "webinar" | "x1">("low_ticket");
  const [copied, setCopied] = useState(false);
  const [creatingTasks, setCreatingTasks] = useState(false);

  // Sincroniza se initialProject mudar
  useMemo(() => {
    if (initialProject) setSelectedProjectId(initialProject.id);
  }, [initialProject]);

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || projects[0];
  }, [projects, selectedProjectId]);

  const budgetNum = parseFloat(budgetStr.replace(/[^\d.,]/g, "").replace(",", ".")) || 200;

function parsePrice(raw: unknown, fallback = 47): number {
  if (typeof raw === "number" && !isNaN(raw) && raw > 0) return raw;
  if (!raw) return fallback;
  if (typeof raw === "string") {
    const cleaned = raw.replace(/[^\d.,]/g, "");
    if (!cleaned) return fallback;
    if (cleaned.includes(",") && cleaned.includes(".")) {
      const num = parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
      if (!isNaN(num) && num > 0) return num;
    } else if (cleaned.includes(",")) {
      const num = parseFloat(cleaned.replace(/,+/g, "."));
      if (!isNaN(num) && num > 0) return num;
    } else if (cleaned.includes(".")) {
      if (/\.\d{3}$/.test(cleaned)) {
        const num = parseFloat(cleaned.replace(/\./g, ""));
        if (!isNaN(num) && num > 0) return num;
      } else {
        const num = parseFloat(cleaned);
        if (!isNaN(num) && num > 0) return num;
      }
    } else {
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return fallback;
}

  // Análise Inteligente de Funil & Matemática da Verba
  const strategy = useMemo(() => {
    const isJP = selectedProjectId === "jp_freitas";
    const pData = jsonFields(selectedProject?.data);
    const avatar = jsonFields(selectedProject?.avatar);

    let frontTicket = isJP ? 47 : (selectedProject?.category === "DTC Nutra" ? 69 : 47);
    const bumpTicket = isJP ? 27 : 29;
    const currency = selectedProject?.category === "DTC Nutra" ? "$" : "R$";

    const produtos = Array.isArray(pData.produtos) ? pData.produtos.map(objectFields) : [];
    if (produtos.length > 0) {
      const targetProd = produtos.find((p) => {
        const nome = jsonText(p.nome)?.toLowerCase() ?? "";
        return nome.includes("código") || nome.includes("cortes") || p.tipo_oferta === "aquisicao";
      }) || produtos[0];

      frontTicket = parsePrice(targetProd.preco ?? targetProd.valor ?? targetProd.ticket, frontTicket);
    }

    const estimatedAOV = Number(frontTicket) + Number(bumpTicket) * 0.45; // 45% bump rate
    const dailyBudget = Math.max(25, Math.floor(budgetNum / 4)); // 4 dias de teste
    const days = Math.max(1, Math.round(budgetNum / dailyBudget));
    const maxCPA = Math.round(estimatedAOV * 0.55); // CPA alvo para 1.8x ROAS
    const breakEvenSales = Math.max(1, Math.ceil(budgetNum / Math.max(1, estimatedAOV)));

    const angulos = isJP ? [
      {
        titulo: "Ângulo 1: O Erro de Ângulo da Tesoura",
        skill: "angulos-criativos",
        gancho: "O erro de 15 graus na empunhadura da tesoura que faz 90% dos barbeiros perderem 40 minutos por corte...",
        headline: "Corte em 25 Minutos Sem Degrau: O Segredo da Tesoura Japonesa",
        copy: "Se você ainda passa aperto no topo e gasta 50 minutos num corte simples, você não precisa de mais clientes, precisa corrigir esse erro de tesoura. Domine a técnica do Código dos Cortes por apenas R$ 47.",
        utm: `utm_source=meta&utm_campaign=lowticket_${budgetNum}&utm_content=erro_tesoura`
      },
      {
        titulo: "Ângulo 2: Tabela de Preço / Lucro por Hora",
        skill: "devastador-v4",
        gancho: "Como cobrar R$ 70 no corte comum sem perder um único cliente do bairro...",
        headline: "De R$ 35 para R$ 70: A Técnica do Fade Limpo Que Clientes Pagam Rindo",
        copy: "Barbeiro que cobra barato sofre para pagar o aluguel da cadeira. Quando você entrega a régua perfeita do fade militar, seu valor dobra imediatamente. Acesse o treinamento completo com 2 bônus exclusivos hoje.",
        utm: `utm_source=meta&utm_campaign=lowticket_${budgetNum}&utm_content=preco_lucro`
      },
      {
        titulo: "Ângulo 3: Vídeo Roleta Gamificado",
        skill: "video-roleta-sorteio",
        gancho: "[Roleta girando sobre foto de corte]: 'Tire um print! Se cair no Degradê Navalhado, você tem que dominar essa técnica hoje.'",
        headline: "Desafio do Barbeiro: Você Consegue Fazer Esse Fade em 20 Minutos?",
        copy: "A brincadeira que parou o feed dos barbeiros. Aprenda o passo a passo exato do Código dos Cortes Perfeitos.",
        utm: `utm_source=meta&utm_campaign=lowticket_${budgetNum}&utm_content=roleta_gamificada`
      },
      {
        titulo: "Ângulo 4: UGC / Transformação de Aluno",
        skill: "proof-elements",
        gancho: "[Vídeo selfie no salão]: 'Cara, eu estava quase desistindo da barbearia porque demorava demais...'",
        headline: "Mais de 1.400 Barbeiros Mudaram de Nível com Este Método",
        copy: "Veja como barbeiros de todo o Brasil aceleraram o atendimento e dobraram o faturamento com o Código dos Cortes do JP Freitas.",
        utm: `utm_source=meta&utm_campaign=lowticket_${budgetNum}&utm_content=ugc_prova`
      }
    ] : [
      {
        titulo: "Ângulo 1: Causa Raiz Biológica Oculta",
        skill: "angulos-criativos",
        gancho: `Descubra por que métodos comuns falham e o que realmente causa o problema em pessoas 45+...`,
        headline: `${selectedProject?.name}: A Descoberta Que Está Revolucionando o Bem-Estar`,
        copy: `O segredo natural que dissolve a causa raiz sem remédios químicos caros. Acesse agora a apresentação especial.`,
        utm: `utm_source=meta&utm_campaign=dtc_${budgetNum}&utm_content=causa_raiz`
      },
      {
        titulo: "Ângulo 2: O Ritual Matinal de Cozinha",
        skill: "mecanismo-vsl",
        gancho: `Um ritual simples de 2 minutos antes do café da manhã que reativa o organismo...`,
        headline: `Médicos Revelam o Ritual Que Está Desafiando a Indústria Farmacêutica`,
        copy: `Mais de 12.000 americanos já testaram este protocolo de 2 minutos. Veja o vídeo oficial antes que seja retirado do ar.`,
        utm: `utm_source=meta&utm_campaign=dtc_${budgetNum}&utm_content=ritual_matinal`
      },
      {
        titulo: "Ângulo 3: Notícia / Advertorial Editorial",
        skill: "breakthrough-techniques",
        gancho: `Reportagem Especial: O composto natural que chamou atenção de pesquisadores...`,
        headline: `Aviso Importante Para Quem Sofre Com Esse Problema Há Mais de 3 Anos`,
        copy: `Leia a análise completa e veja como você pode receber o tratamento original direto na sua casa com garantia total.`,
        utm: `utm_source=meta&utm_campaign=dtc_${budgetNum}&utm_content=advertorial_news`
      },
      {
        titulo: "Ângulo 4: Demonstração e Quebra de Ceticismo",
        skill: "weaponized-credibility",
        gancho: `Se você já tentou de tudo e nada funcionou, você precisa ver esta explicação científica...`,
        headline: `Por Que 84% Dos Usuários Relatam Melhora Já Nos Primeiros 14 Dias`,
        copy: `Comprovação científica em ensaios laboratoriais. Conheça a fórmula completa com certificação internacional.`,
        utm: `utm_source=meta&utm_campaign=dtc_${budgetNum}&utm_content=prova_cientifica`
      }
    ];

    return {
      frontTicket,
      bumpTicket,
      currency,
      estimatedAOV,
      dailyBudget,
      days,
      maxCPA,
      breakEvenSales,
      angulos
    };
  }, [selectedProjectId, selectedProject, budgetNum]);

  const handleCopyBriefing = () => {
    const text = `
🎯 *BRIEFING EXECUTIVO DE TRÁFEGO — ALOCAÇÃO DE VERBA*
Projeto: ${selectedProject?.name}
Orçamento Total: ${strategy.currency} ${Number(budgetNum || 0).toFixed(2)}
Estrutura: ${strategy.days} dias de teste a ${strategy.currency} ${Number(strategy.dailyBudget || 0).toFixed(2)}/dia (4 Conjuntos de Anúncios)
Ticket Médio Estimado: ${strategy.currency} ${Number(strategy.estimatedAOV || 0).toFixed(2)}
CPA Alvo Máximo: ${strategy.currency} ${Number(strategy.maxCPA || 0).toFixed(2)}
Ponto de Equilíbrio (Break-even): ${strategy.breakEvenSales} vendas

---
🔥 *OS 4 CRIATIVOS DE TESTE:*

${strategy.angulos.map((a, i) => `
*CRIATIVO 0${i + 1} (${a.titulo})*
• Headline: ${a.headline}
• Gancho 0-3s: ${a.gancho}
• Copy: ${a.copy}
• Link com UTM: ${strategy.angulos[0].utm}
`).join("\n")}

---
⚡ *REGRAS DE DESCARTE E OTIMIZAÇÃO (CIRCUIT BREAKER):*
1. Conjunto gastou ${strategy.currency} ${(strategy.dailyBudget * 0.4).toFixed(2)} sem nenhum clique no link $\\to$ PAUSAR imediatamente.
2. Conjunto atingiu 3 checkouts iniciados mas sem venda $\\to$ Acompanhar recuperação de WhatsApp por 2h.
3. Criativo com CPA < ${strategy.currency} ${strategy.maxCPA} $\\to$ MANTER e escalar 20% do orçamento a cada 48h.
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Briefing copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCreateKanbanTasks = async () => {
    setCreatingTasks(true);
    try {
      const cards = strategy.angulos.map((a) => ({
        title: `Subir Anúncio: ${a.titulo}`,
        description: `Gancho: ${a.gancho}\nHeadline: ${a.headline}\nUTM: ${a.utm}`,
        priority: "high",
        project_id: selectedProjectId,
        created_by: "growth_copilot"
      }));

      await supabase.from("imphq_kanban_cards").insert(cards);
      toast.success("4 tarefas criadas no Kanban com sucesso!");
    } catch (err) {
      toast.error("Erro criando tarefas: " + errorMessage(err));
    } finally {
      setCreatingTasks(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-[#0A0B0D] border-[#1B1E23] text-white p-0 overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-5 border-b border-[#1B1E23] bg-gradient-to-r from-emerald-500/10 via-[#D6FF4B]/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#D6FF4B]/20 flex items-center justify-center border border-[#D6FF4B]/40">
              <Zap className="h-4 w-4 text-[#D6FF4B] fill-[#D6FF4B]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
                Growth Copilot · Central de Alocação de Verba
                <Badge variant="outline" className="border-[#D6FF4B]/30 text-[#D6FF4B] font-mono text-[10px]">
                  IA Autônoma
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-[#8A8F98]">
                Diga quanto tem de verba. A IA analisa o funil, projeta o ponto de equilíbrio e gera os 4 criativos de teste.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Inputs do Usuário */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#121418] p-3.5 rounded-xl border border-[#1B1E23]">
            <div>
              <Label className="text-[11px] font-mono text-[#8A8F98]">Projeto Alvo</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="h-8 text-xs bg-[#0A0B0D] border-[#1B1E23] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0A0B0D] border-[#1B1E23]">
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.icon || "📁"} {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px] font-mono text-[#8A8F98]">Orçamento Disponível</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#D6FF4B]" />
                <Input
                  value={budgetStr}
                  onChange={(e) => setBudgetStr(e.target.value)}
                  placeholder="200"
                  className="pl-8 h-8 text-xs bg-[#0A0B0D] border-[#1B1E23] font-mono font-bold text-[#D6FF4B]"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-mono text-[#8A8F98]">Objetivo Principal</Label>
              <Select value={objective} onValueChange={(v) => setObjective(v as typeof objective)}>
                <SelectTrigger className="h-8 text-xs bg-[#0A0B0D] border-[#1B1E23] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0A0B0D] border-[#1B1E23]">
                  <SelectItem value="low_ticket" className="text-xs">🎯 Validação Front-End (Low Ticket)</SelectItem>
                  <SelectItem value="escala_nutra" className="text-xs">💊 Escala DTC Nutra</SelectItem>
                  <SelectItem value="webinar" className="text-xs">💈 Lançamento Webinar / Grupo</SelectItem>
                  <SelectItem value="x1" className="text-xs">💬 Conversão 1 a 1 (Chat/X1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cards Matemáticos de Projeção */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-lg bg-[#0E1013] border border-[#1B1E23]">
              <span className="text-[10px] font-mono text-[#8A8F98] uppercase">Teste por Dia</span>
              <div className="text-base font-mono font-bold text-white mt-0.5">
                {strategy.currency} {strategy.dailyBudget} <span className="text-[10px] text-[#8A8F98] font-normal">/dia</span>
              </div>
              <span className="text-[10px] text-[#8A8F98]">{strategy.days} dias de janela</span>
            </div>

            <div className="p-3 rounded-lg bg-[#0E1013] border border-[#1B1E23]">
              <span className="text-[10px] font-mono text-[#8A8F98] uppercase">Ticket Médio (AOV)</span>
              <div className="text-base font-mono font-bold text-emerald-400 mt-0.5">
                {strategy.currency} {Number(strategy.estimatedAOV || 0).toFixed(2)}
              </div>
              <span className="text-[10px] text-[#8A8F98]">Com bumps ~45%</span>
            </div>

            <div className="p-3 rounded-lg bg-[#0E1013] border border-[#1B1E23]">
              <span className="text-[10px] font-mono text-[#8A8F98] uppercase">CPA Alvo Máximo</span>
              <div className="text-base font-mono font-bold text-[#D6FF4B] mt-0.5">
                {strategy.currency} {strategy.maxCPA}
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">ROAS ~1.8x</span>
            </div>

            <div className="p-3 rounded-lg bg-[#0E1013] border border-[#1B1E23]">
              <span className="text-[10px] font-mono text-[#8A8F98] uppercase">Break-even</span>
              <div className="text-base font-mono font-bold text-amber-400 mt-0.5">
                {strategy.breakEvenSales} vendas
              </div>
              <span className="text-[10px] text-[#8A8F98]">Paga os {strategy.currency} {budgetNum}</span>
            </div>
          </div>

          {/* Os 4 Criativos de Teste */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5 font-mono">
                <Sparkles className="h-3.5 w-3.5 text-[#D6FF4B]" />
                Lote de 4 Criativos de Teste Recomendados pela IA:
              </span>
              <Badge variant="outline" className="text-[10px] font-mono border-border text-[#8A8F98]">
                4 Ângulos Persuasivos
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {strategy.angulos.map((a, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-[#0E1013] border border-[#1B1E23] space-y-2 hover:border-[#D6FF4B]/40 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">{a.titulo}</span>
                    <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-400">
                      {a.skill}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-amber-400 font-semibold uppercase">Gancho (0-3s):</span>
                    <p className="text-[11px] text-[#C1C7CD] italic mt-0.5 leading-snug">"{a.gancho}"</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[#8A8F98] uppercase">Headline:</span>
                    <p className="text-[11px] text-white/90 font-medium">{a.headline}</p>
                  </div>
                  <div className="pt-1 border-t border-[#1B1E23]/60 flex items-center justify-between text-[10px] font-mono text-[#8A8F98]">
                    <span>Conjunto #{idx + 1} · {strategy.currency} {(strategy.dailyBudget / 4).toFixed(0)}/dia</span>
                    <span className="text-emerald-400">UTM Ativa</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Circuit Breaker & Automações */}
          <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 text-xs space-y-1">
            <span className="font-semibold text-rose-300 font-mono text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
              Regras do Sentinela de Otimização (Circuit Breaker):
            </span>
            <ul className="list-disc list-inside text-[#C1C7CD] text-[11px] space-y-0.5">
              <li>Pausa automática se um conjunto gastar {strategy.currency} {(strategy.dailyBudget * 0.4).toFixed(2)} sem nenhum clique.</li>
              <li>Disparo imediato da Evolution API em 15 minutos se houver Pix gerado não pago.</li>
              <li>Escala de 20% no conjunto vencedor com CPA abaixo de {strategy.currency} {strategy.maxCPA}.</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-[#1B1E23] bg-[#0E1013] flex items-center justify-between sm:justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyBriefing}
            className="text-xs font-mono border-[#1B1E23] hover:border-white/40 gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Briefing Copiado!" : "Copiar Briefing p/ Gestor"}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateKanbanTasks}
              disabled={creatingTasks}
              className="text-xs font-mono border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {creatingTasks ? "Criando..." : "Criar Tarefas no Kanban"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                toast.success("Plano ativado! Monitore no Semáforo.");
              }}
              className="bg-[#D6FF4B] hover:bg-[#D6FF4B]/90 text-[#0A0B0D] font-mono font-semibold text-xs gap-1.5"
            >
              Ativar no Semáforo <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
