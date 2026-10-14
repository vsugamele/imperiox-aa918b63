import { parseRefDetails } from "@shared/ad-mining";
import { PORTAS, CARGAS, type Porta, type Carga } from "@shared/hw-taxonomy";

export interface LeadSignalInput {
  text: string;
  source?: "whatsapp" | "crm" | "x1";
  contactName?: string | null;
  createdAt?: string | null;
}

export interface LeadComplaintCluster {
  id: string;
  label: string;
  badgeColor: string;
  count: number;
  sharePct: number;
  isLiveData: boolean;
  sampleQuotes: string[];
  recommendedAngle: string;
  recommendedFormat: string;
  recommendedFormatLabel: string;
  recommendedPorta: Porta;
  recommendedPortaLabel: string;
  recommendedCarga: Carga;
  firstFrameLoad: string;
  x1Script: string;
  pageFaqBlock: string;
}

export interface MarketFormatTrend {
  format: string;
  count: number;
  scaledCount: number;
  avgDaysActive: number;
  topHook: string;
  recommendedJeito: string;
}

export interface MarketHookTrend {
  id: string;
  title: string;
  hookText: string;
  porta: Porta;
  portaLabel: string;
  format: string;
  daysActive: number;
  isScaled: boolean;
}

export interface MarketTrendReport {
  totalAnalyzed: number;
  scaledTotal: number;
  isLiveData: boolean;
  formats: MarketFormatTrend[];
  hooks: MarketHookTrend[];
}

export interface ReferenceSignalInput {
  id: string;
  title: string;
  platform?: string | null;
  format?: string | null;
  ad_copy?: string | null;
  details?: string | null;
  tags?: string[] | null;
  niche?: string | null;
}

interface ComplaintRule {
  id: string;
  label: string;
  badgeColor: string;
  keywords: RegExp;
  fallbackQuotes: string[];
  recommendedAngle: string;
  recommendedFormat: string;
  recommendedFormatLabel: string;
  recommendedPorta: Porta;
  recommendedCarga: Carga;
  firstFrameLoad: string;
  x1Script: string;
  pageFaqBlock: string;
}

const COMPLAINT_RULES: ComplaintRule[] = [
  {
    id: "ceticismo_golpe",
    label: "🛡️ Ceticismo / 'Será que funciona mesmo?'",
    badgeColor: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    keywords: /funciona mesmo|golpe|confi[aá]vel|verdade|mentira|engana|reclame aqui|garantia|medo de comprar|ser[aá] que resolve|duvido|propaganda/i,
    fallbackQuotes: [
      "Vi o vídeo mas tenho receio de comprar na internet e não funcionar pra mim.",
      "Tem garantia mesmo ou é só conversa de anúncio?",
    ],
    recommendedAngle: "Prova Visual nos Primeiros 3s + Risco Zero Condicional",
    recommendedFormat: "demonstracao",
    recommendedFormatLabel: "Demonstração física / tela",
    recommendedPorta: "descoberta",
    recommendedCarga: "objeto_estranho",
    firstFrameLoad: "Close na textura/mecanismo real em ação + selo de lote rastreável no frame 1",
    x1Script:
      "Entendo 100% sua cautela, [Nome]! Inclusive a gente recomenda que você NÃO acredite apenas na nossa palavra — por isso você tem garantia blindada de 30 dias direto no seu CPF. Se em 15 dias você não sentir a diferença que mostramos, devolvemos 100% no mesmo Pix sem burocracia. Quer que eu te mande fotos reais de quem começou há 2 semanas?",
    pageFaqBlock:
      "❓ E se não funcionar para o meu caso?\nVocê não precisa decidir hoje se vai ficar com o produto para sempre — apenas se vale testar por 30 dias com risco zero. Se você não notar redução visível já nas primeiras semanas, basta 1 mensagem no nosso WhatsApp para estorno integral.",
  },
  {
    id: "preco_parcelamento",
    label: "💰 Preço / Achou caro / Parcelamento",
    badgeColor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    keywords: /caro|pre[cç]o|valor|desconto|parcela|dinheiro|apertad|condi[cç][aã]o|mais barato|promo[cç][aã]o|custa quanto|salgado/i,
    fallbackQuotes: [
      "Gostei muito, mas achei o valor do kit completo meio puxado pra mim agora.",
      "Tem como fazer um desconto no Pix ou parcelar sem juros?",
    ],
    recommendedAngle: "Ancoragem de Custo Diário (Menos que um café por dia)",
    recommendedFormat: "ugc_fala",
    recommendedFormatLabel: "UGC · Pessoa falando pra câmera",
    recommendedPorta: "quebra_crenca",
    recommendedCarga: "contradicao",
    firstFrameLoad: "Nota fiscal / cálculo na tela mostrando R$ 3,20/dia vs. R$ 450 gastos em paliativos",
    x1Script:
      "[Nome], se a gente olhar o valor cheio parece investimento mesmo, mas dividindo no protocolo de 90 dias sai menos de R$ 3,30 por dia — menos que uma água com gás ou um analgésico que só mascara o sintoma. Além disso, consigo liberar pra você hoje o link com desconto extra no Pix ou em até 12x. Prefere garantir o de 3 ou o de 5 potes com frete grátis?",
    pageFaqBlock:
      "❓ Por que investir neste protocolo em vez de soluções baratas de farmácia?\nSoluções genéricas tratam apenas o sintoma superficial e obrigam você a recomprar todos os meses. Nosso protocolo atua na causa-raiz por menos de R$ 3,30 ao dia no kit recomendado, com frete gratuito.",
  },
  {
    id: "ja_tentei_tudo",
    label: "😔 Frustração prévia ('Já tentei de tudo e nada resolveu')",
    badgeColor: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    keywords: /j[aá] tentei|nada funciona|tomei de tudo|fiz dieta|j[aá] usei|outro produto|n[aã]o tive resultado|desisti|cansad[oa] de tentar/i,
    fallbackQuotes: [
      "Já tomei 3 suplementos diferentes esse ano e nenhum desinchou de verdade.",
      "Já tentei de tudo, por que esse seria diferente dos outros?",
    ],
    recommendedAngle: "Invalidação do Método Antigo (Por que tudo que você tentou falhou)",
    recommendedFormat: "entrevista_podcast",
    recommendedFormatLabel: "Entrevista / corte de podcast",
    recommendedPorta: "voz_dela",
    recommendedCarga: "rosto_emocao",
    firstFrameLoad: "Especialista descartando o método comum nos primeiros 2s: 'Não é culpa da sua genética'",
    x1Script:
      "A culpa NÃO foi sua, [Nome]. 92% das clientes que chegam aqui também já tinham tentado chás, cápsulas comuns ou dietas restritivas. O problema é que esses métodos não destravam a drenagem celular antes de agir. É exatamente por isso que nosso formato tem absorção sublingual/direta. Vamos fazer o teste de 14 dias?",
    pageFaqBlock:
      "❓ Eu já tentei outros produtos antes e não tive resultado. Por que agora seria diferente?\nPorque a maioria dos produtos convencionais usa cápsulas prensadas que perdem até 78% dos ativos no ácido estomacal. Nossa tecnologia atua diretamente no mecanismo travado.",
  },
  {
    id: "como_funciona_uso",
    label: "🧪 Dúvida do Mecanismo / Como usar na rotina",
    badgeColor: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    keywords: /como toma|como usa|quantas gotas|quantas c[aá]psulas|hor[aá]rio|jejum|rotina|demora quanto|quanto tempo pra fazer efeito|como funciona/i,
    fallbackQuotes: [
      "Como que usa no dia a dia? Precisa mudar a alimentação inteira?",
      "Em quantos dias começo a perceber diferença real?",
    ],
    recommendedAngle: "Ritual de 15 Segundos pela Manhã (Zero Fricção)",
    recommendedFormat: "narrativa_broll",
    recommendedFormatLabel: "Narrativa com B-roll + voz em off",
    recommendedPorta: "narrativa",
    recommendedCarga: "cena_vida",
    firstFrameLoad: "Conta-gotas / dose matinal ao lado da xícara de café com cronômetro de 15 segundos",
    x1Script:
      "É a parte mais simples da sua manhã, [Nome]: leva literalmente 15 segundos antes do café, sem gosto residual e sem precisar virar sua rotina de cabeça pra baixo. A maioria relata sensação de leveza já entre o 4º e o 7º dia!",
    pageFaqBlock:
      "❓ Como devo usar no dia a dia e em quanto tempo noto diferença?\nBasta 1 dose diária pela manhã (leva menos de 15 segundos). Os primeiros sinais de alívio e desinchaço costumam aparecer já na primeira semana de uso contínuo.",
  },
  {
    id: "efeito_colateral_seguranca",
    label: "⚠️ Segurança / Contraindicação / Saúde",
    badgeColor: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    keywords: /efeito colateral|contraindica|press[aã]o alta|diabet|anvisa|natural|faz mal|m[eé]dico|alergia|gr[aá]vida|lactante|rem[eé]dio/i,
    fallbackQuotes: [
      "Tenho pressão alta e tomo remédio controlado, posso usar sem risco?",
      "Tem efeito colateral ou acelera o coração?",
    ],
    recommendedAngle: "Pureza Clínica 100% Natural Sem Estimulantes",
    recommendedFormat: "estatico",
    recommendedFormatLabel: "Imagem estática (tabela nutricional + selos)",
    recommendedPorta: "direta",
    recommendedCarga: "bloco",
    firstFrameLoad: "Rótulo limpo com lupa destacando '0% Cafeína / 0% Estimulantes / Aprovado'",
    x1Script:
      "Pode ficar super tranquila, [Nome]! A fórmula é 100% natural, livre de estimulantes, não acelera os batimentos e não interfere na pressão arterial. Foi desenvolvida justamente para quem busca resultado seguro sem agredir o organismo.",
    pageFaqBlock:
      "❓ Possui efeitos colaterais ou contraindicações?\nNão. A composição é 100% natural, livre de glúten, açúcar e estimulantes sintéticos, podendo ser utilizada com segurança na rotina diária.",
  },
  {
    id: "prazo_entrega",
    label: "📦 Frete / Prazo de Entrega / Rastreio",
    badgeColor: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
    keywords: /frete|entrega|correios|transportadora|chega em quantos dias|demora pra chegar|rastreio|cep|envio/i,
    fallbackQuotes: [
      "Quanto tempo demora pra chegar no meu CEP?",
      "Vocês enviam código de rastreio no WhatsApp?",
    ],
    recommendedAngle: "Envio Expresso 24h direto do Centro de Distribuição",
    recommendedFormat: "print_conversa",
    recommendedFormatLabel: "Print de conversa / depoimento",
    recommendedPorta: "direta",
    recommendedCarga: "cena_vida",
    firstFrameLoad: "Print real de cliente dizendo 'Chegou em 3 dias aqui em casa, super bem embalado!'",
    x1Script:
      "Nosso envio sai em até 24h úteis com transportadora expressa e você recebe o código de rastreio automático aqui mesmo no seu WhatsApp assim que a etiqueta é emitida! Me passa seu CEP que já te confirmo o prazo exato e o frete grátis no kit.",
    pageFaqBlock:
      "❓ Qual o prazo de entrega e como acompanho meu pedido?\nDespachamos em até 24h úteis com código de rastreio enviado direto no seu WhatsApp e e-mail.",
  },
];

function inferPortaFromCopy(text: string): Porta {
  const lower = text.toLowerCase();
  if (/erro|pare de|nunca faça|mentira|errado|mito|corta/.test(lower)) return "quebra_crenca";
  if (/eu achava|eu sempre|se voc[eê] j[aá] disse|cansada de/.test(lower)) return "voz_dela";
  if (/hist[oó]ria|minha m[aã]e|meu marido|vizinha|quando eu/.test(lower)) return "narrativa";
  if (/descoberta|ritual|ingrediente|segredo|teste de|olhe isso/.test(lower)) return "descoberta";
  return "direta";
}

export function extractLeadComplaints(signals: LeadSignalInput[]): LeadComplaintCluster[] {
  const validSignals = signals.filter((s) => s.text && s.text.trim().length >= 4);

  const rawCounts = COMPLAINT_RULES.map((rule) => {
    const matches = validSignals.filter((s) => rule.keywords.test(s.text));
    const quotes = matches
      .map((m) => m.text.trim().slice(0, 140))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 3);
    return {
      rule,
      count: matches.length,
      quotes,
    };
  });

  const totalMatched = rawCounts.reduce((acc, item) => acc + item.count, 0);
  const isLiveData = totalMatched > 0;

  return rawCounts
    .map(({ rule, count, quotes }, idx) => {
      const effectiveCount = isLiveData ? count : Math.max(2, 14 - idx * 2);
      const effectiveTotal = isLiveData ? Math.max(1, totalMatched) : 48;
      const sharePct = Math.round((effectiveCount / effectiveTotal) * 100);

      return {
        id: rule.id,
        label: rule.label,
        badgeColor: rule.badgeColor,
        count: effectiveCount,
        sharePct,
        isLiveData: isLiveData && count > 0,
        sampleQuotes: quotes.length > 0 ? quotes : rule.fallbackQuotes,
        recommendedAngle: rule.recommendedAngle,
        recommendedFormat: rule.recommendedFormat,
        recommendedFormatLabel: rule.recommendedFormatLabel,
        recommendedPorta: rule.recommendedPorta,
        recommendedPortaLabel: PORTAS[rule.recommendedPorta],
        recommendedCarga: rule.recommendedCarga,
        firstFrameLoad: `${CARGAS[rule.recommendedCarga]} · ${rule.firstFrameLoad}`,
        x1Script: rule.x1Script,
        pageFaqBlock: rule.pageFaqBlock,
      };
    })
    .sort((a, b) => b.count - a.count);
}

const FORMAT_JEITO_MAP: Record<string, string> = {
  "Vídeo": "UGC frontal 9:16 com corte seco a cada 2.5s + legenda dinâmica",
  "UGC": "Selfie nativa no carro/banheiro com gancho de confissão nos 3s iniciais",
  "Reels": "Gancho visual de choque + narração acelerada 1.15x + CTA Comment-to-DM",
  "VSL": "Micro-lead de 45s direto no mecanismo sem apresentação pessoal longa",
  "Imagem": "Comparativo lado a lado (Antes/Depois do mecanismo ou Tabela Nós vs. Eles)",
  "Carrossel": "Slide 1 com manchete investigativa + Slide 3 revelando o vilão oculto",
};

export function extractMarketTrends(refs: ReferenceSignalInput[]): MarketTrendReport {
  const validRefs = refs ?? [];
  const isLiveData = validRefs.length > 0;

  if (!isLiveData) {
    return {
      totalAnalyzed: 0,
      scaledTotal: 0,
      isLiveData: false,
      formats: [
        {
          format: "UGC · Fala Direta + B-Roll de Mecanismo",
          count: 12,
          scaledCount: 8,
          avgDaysActive: 34,
          topHook: "Eu achei que era gordura localizada, até fazer esse teste de 5 segundos na frente do espelho...",
          recommendedJeito: FORMAT_JEITO_MAP["UGC"],
        },
        {
          format: "Corte de Podcast / Falsa Entrevista",
          count: 8,
          scaledCount: 5,
          avgDaysActive: 29,
          topHook: "O erro nº 1 de quem tenta desinchar depois dos 35 anos é atacar a água e esquecer a linfa...",
          recommendedJeito: "2 ângulos de câmera alternando + microfone de lapela visível + legenda amarela",
        },
        {
          format: "Advertorial Nativo + Demonstração Física",
          count: 6,
          scaledCount: 4,
          avgDaysActive: 41,
          topHook: "Por que 4 em cada 5 mulheres estão trocando cápsulas tradicionais por este protocolo matinal?",
          recommendedJeito: "Primeiro frame com copo/textura real + headline estilo matéria jornalística",
        },
      ],
      hooks: [
        {
          id: "canon-1",
          title: "Teste do Espelho / Retenção Oculta",
          hookText: "Se a marca do elástico da meia continua na sua perna à noite, o problema não é caloria.",
          porta: "descoberta",
          portaLabel: PORTAS.descoberta,
          format: "UGC",
          daysActive: 38,
          isScaled: true,
        },
        {
          id: "canon-2",
          title: "Quebra de Crença sobre Drenagem",
          hookText: "Cortar calorias pode ser exatamente o motivo pelo qual seu corpo trava líquido.",
          porta: "quebra_crenca",
          portaLabel: PORTAS.quebra_crenca,
          format: "Vídeo",
          daysActive: 27,
          isScaled: true,
        },
        {
          id: "canon-3",
          title: "Voz Dela / Frustração com Cápsulas",
          hookText: "Eu já tinha tomado 4 potes diferentes e continuava acordando com o rosto inchado...",
          porta: "voz_dela",
          portaLabel: PORTAS.voz_dela,
          format: "Reels",
          daysActive: 31,
          isScaled: true,
        },
      ],
    };
  }

  const byFormat = new Map<
    string,
    { count: number; scaledCount: number; daysSum: number; topHook: string; bestDays: number }
  >();

  const extractedHooks: MarketHookTrend[] = [];
  let scaledTotal = 0;

  for (const ref of validRefs) {
    let parsedJson: Record<string, unknown> = {};
    if (ref.details && ref.details.trim().startsWith("{")) {
      try {
        parsedJson = JSON.parse(ref.details);
      } catch {
        parsedJson = {};
      }
    }
    const details = parseRefDetails({
      titulo: ref.title,
      notas: ref.details ?? "",
      transcricao: ref.ad_copy ?? "",
      tags: ref.tags ?? [],
    });
    const days = Number(parsedJson.daysActive ?? parsedJson.dias_no_ar ?? details.diasNoAr ?? 0);
    const isScaled =
      Boolean(parsedJson.isScaled) ||
      days >= 14 ||
      (ref.tags ?? []).includes("escalado");
    if (isScaled) scaledTotal += 1;

    const fmt = (ref.format || "Vídeo").trim();
    const firstSentence =
      (ref.ad_copy || "")
        .split(/(?<=[.!?])\s+|\n+/)[0]
        ?.trim()
        .slice(0, 140) || ref.title;

    const cur = byFormat.get(fmt) ?? {
      count: 0,
      scaledCount: 0,
      daysSum: 0,
      topHook: firstSentence,
      bestDays: -1,
    };
    cur.count += 1;
    if (isScaled) cur.scaledCount += 1;
    cur.daysSum += days;
    if (days > cur.bestDays && firstSentence) {
      cur.bestDays = days;
      cur.topHook = firstSentence;
    }
    byFormat.set(fmt, cur);

    if (firstSentence) {
      const porta = inferPortaFromCopy(`${ref.title} ${ref.ad_copy ?? ""}`);
      extractedHooks.push({
        id: ref.id,
        title: ref.title,
        hookText: firstSentence,
        porta,
        portaLabel: PORTAS[porta],
        format: fmt,
        daysActive: days,
        isScaled,
      });
    }
  }

  const formats: MarketFormatTrend[] = Array.from(byFormat.entries())
    .map(([format, stats]) => ({
      format,
      count: stats.count,
      scaledCount: stats.scaledCount,
      avgDaysActive: stats.count > 0 ? Math.round(stats.daysSum / stats.count) : 0,
      topHook: stats.topHook,
      recommendedJeito:
        FORMAT_JEITO_MAP[format] ?? "Gancho visual nos primeiros 2s + prova específica + CTA claro para a frente ativa",
    }))
    .sort((a, b) => b.scaledCount - a.scaledCount || b.count - a.count);

  const hooks = extractedHooks
    .sort((a, b) => Number(b.isScaled) - Number(a.isScaled) || b.daysActive - a.daysActive)
    .slice(0, 6);

  return {
    totalAnalyzed: validRefs.length,
    scaledTotal,
    isLiveData: true,
    formats,
    hooks,
  };
}
