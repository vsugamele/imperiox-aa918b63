/**
 * Motor e formatador de Esteiras de Anúncios no Padrão MemoFlow
 * Integrado ao Acervo RAG e às metodologias de Briefing de Tráfego e Copywriting Direto.
 */

export interface MemoFlowParsedBatch {
  rawOutput: string;
  campanha: {
    tipo: string;
    destino: string;
    regraCpa: string;
    instrucoes: string;
  };
  angulo: {
    nome: string;
    avatar: string;
    vilao: string;
    mecanismo: string;
    analogia: string;
  };
  copyMestre: string;
  ganchos: Array<{
    id: string; // "G1", "G2", "G3"
    tipo: string;
    texto: string;
  }>;
  headlines: Array<{
    id: string; // "H1", "H2", "H3"
    tipo: string;
    texto: string;
  }>;
}

export interface ProjectAnglePreset {
  id: string;
  title: string;
  avatar: string;
  vilao: string;
  mecanismo: string;
  promptHint: string;
}

export const PROJECT_ANGLE_PRESETS: Record<string, ProjectAnglePreset[]> = {
  linfaflow: [
    {
      id: "lf_externo_vs_interno",
      title: "Soluções Externas Falham vs. Drenagem Interna (Cleavers Herói)",
      avatar: "Mulher 45-65+ cansada de inchaço vespertino, sapatos apertados e pernas pesadas",
      vilao: "Canais linfáticos lentos e fluido espesso estagnado (não é gordura nem retenção comum)",
      mecanismo: "Cleavers Aerial Parts ('A Vassoura Linfática') liderando o fluxo sublingual em 30s",
      promptHint: "Foque em como massagens, meias e drenagem apertam por fora mas o fluido volta, enquanto as gotas agem de dentro.",
    },
    {
      id: "lf_exames_normais",
      title: "O Paradoxo dos Exames Normais (A Mulher Invisível)",
      avatar: "Mulher que ouviu do médico que 'está tudo normal', mas o espelho e as roupas dizem o oposto",
      vilao: "Subdiagnóstico crônico — nenhum exame padrão mede a velocidade do sistema linfático",
      mecanismo: "Suporte botânico quádruplo que reativa o sistema de filtragem natural sem efeito diurético",
      promptHint: "Toque na dor emocional de ser descartada e na dignidade de saber que o sintoma é real.",
    },
    {
      id: "lf_toxinas_retidas",
      title: "Lodo Linfático Retido & Inflamação Silenciosa",
      avatar: "Adulto com sensação de cansaço constante, inchaço no rosto ao acordar e nas pernas à tarde",
      vilao: "Sobrecarga de toxinas que os vasos linfáticos não conseguem mais bombear",
      mecanismo: "Stillingia e Prickly Ash desbloqueando as vias profundas após a varredura da Cleavers",
      promptHint: "Explique a analogia do encanamento entupido: tentar beber mais água sem desentupir só acumula mais líquido.",
    },
  ],
  slimsoda: [
    {
      id: "ss_glp1_shot",
      title: "The Real Baking Soda Shot (GLP-1 Natural sem Agulhas)",
      avatar: "Mulher 40+ que tentou dietas restritivas e tem medo de injeções caras com efeito rebote",
      vilao: "Desativação precoce do hormônio GLP-1 natural pelas enzimas intestinais (DPP4)",
      mecanismo: "Shot alcalino matinal com bio-berberina que estimula as células L do intestino a liberar GLP-1",
      promptHint: "Mostre o contraste: R$ 1.500/mês de agulha com enjoo vs. ritual caseiro de 15 segundos.",
    },
    {
      id: "ss_sarah_jenkins",
      title: "Sarah Jenkins & O Metabolismo Acidificado pós-40",
      avatar: "Mulher na pré ou pós-menopausa que sente que o metabolismo 'desligou do nada'",
      vilao: "Acidez metabólica e inflamação celular que bloqueiam a queima de gordura",
      mecanismo: "Reversão da acidez no trato digestivo para religar os receptores de queima",
      promptHint: "Use a história de identificação da mulher invisível que recupera o corpo e a energia.",
    },
  ],
  cardioflush: [
    {
      id: "cf_arterias_limpas",
      title: "Rigidez Arterial & A Falha dos Métodos Tradicionais",
      avatar: "Homem ou mulher 50+ preocupado com pressão, cansaço ao subir escadas e histórico familiar",
      vilao: "Calcificação oculta e perda de elasticidade do endotélio que nenhum remédio comum restaura",
      mecanismo: "Ativação de óxido nítrico e descalcificação vascular suave de dentro para fora",
      promptHint: "Use a analogia da mangueira de jardim ressecada vs mangueira flexível de alta pressão.",
    },
  ],
  memoflow: [
    {
      id: "mf_nevoa_mental",
      title: "Névoa Mental & O Switch Sináptico de 20 Minutos",
      avatar: "Profissional ou criador com estafa mental, esquecimentos rápidos e procrastinação forçada",
      vilao: "Exaustão de neurotransmissores e inflamação sináptica por excesso de estímulos digitais",
      mecanismo: "Combinação nootrópica que restaura a velocidade de transmissão entre neurônios",
      promptHint: "Mostre a frustração de sentar para trabalhar e a mente parecer travada em areia movediça.",
    },
  ],
  jp_freitas: [
    {
      id: "jp_barbearia_elite",
      title: "Do Corte de R$ 25 à Barbearia de R$ 15k/Mês",
      avatar: "Barbeiro talentoso que trabalha 12h por dia mas não vê a cor do dinheiro no fim do mês",
      vilao: "Vender corte em vez de experiência e autoridade (guerra de preços do bairro)",
      mecanismo: "Método de Precificação & Retenção de Clientes Fiéis sem depender de dancinhas",
      promptHint: "Contraste o barbeiro cansado que vira refém da cadeira vs o barbeiro empresário.",
    },
  ],
  global: [
    {
      id: "global_causa_raiz",
      title: "Causa Raiz Oculta vs. Sintomas Tratados de Forma Errada",
      avatar: "Cliente cético que já gastou dinheiro nas soluções líderes do mercado e se frustrou",
      vilao: "A 'solução comum' que combate apenas o sintoma visível e alimenta o problema real",
      mecanismo: "Nova categoria que desmonta o ciclo vicioso atacando a verdadeira origem",
      promptHint: "Use a lógica de Eugene Schwartz: gradualização do que ele já aceita até a revelação inevitável.",
    },
  ],
};

/**
 * Faz o parsing inteligente do markdown gerado pelo LLM no padrão MemoFlow
 */
export function parseMemoFlowAdBatch(content: string): MemoFlowParsedBatch {
  const result: MemoFlowParsedBatch = {
    rawOutput: content,
    campanha: {
      tipo: "C1 (Principal / Escala)",
      destino: "Advertorial de Pré-venda ou VSL",
      regraCpa: "Janela de 3-4 dias · Cortar se gasto > 1.5x CPA-alvo sem conversão",
      instrucoes: "Manter Copy Mestre no Texto Principal e substituir a 1ª linha pelo Gancho de cada criativo.",
    },
    angulo: {
      nome: "Ângulo Persuasivo Principal",
      avatar: "Público-alvo qualificado",
      vilao: "Causa oculta não revelada",
      mecanismo: "Mecanismo único da solução",
      analogia: "Metáfora comparativa",
    },
    copyMestre: "",
    ganchos: [],
    headlines: [],
  };

  if (!content || typeof content !== "string") {
    return result;
  }

  // 1. Extrair Seção de Instruções Operacionais
  const operMatch = content.match(/##\s*1\.[^\n]*\n([\s\S]*?)(?=##\s*2\.)/i);
  if (operMatch) {
    const operText = operMatch[1];
    const tipoMatch = operText.match(/Campanha Sugerida[^*:]*[:*]+\s*(C1[^\n]*|C2[^\n]*)/i);
    if (tipoMatch) result.campanha.tipo = tipoMatch[1].replace(/[*_]/g, "").trim();

    const destMatch = operText.match(/Destino Recomendado[^*:]*[:*]+\s*([^\n]+)/i);
    if (destMatch) result.campanha.destino = destMatch[1].replace(/[*_\[\]]/g, "").trim();

    const cpaMatch = operText.match(/Regra de Julgamento[^*:]*[:*]+\s*([^\n]+)/i);
    if (cpaMatch) result.campanha.regraCpa = cpaMatch[1].replace(/[*_]/g, "").trim();
  }

  // 2. Extrair Seção de Ângulo & Mecanismo
  const anguloMatch = content.match(/##\s*2\.[^\n]*\n([\s\S]*?)(?=##\s*3\.)/i);
  if (anguloMatch) {
    const angText = anguloMatch[1];
    const nomeM = angText.match(/Nome do Ângulo[^*:]*[:*]+\s*([^\n]+)/i);
    if (nomeM) result.angulo.nome = nomeM[1].replace(/[*_]/g, "").trim();

    const avM = angText.match(/Avatar Alvo[^*:]*[:*]+\s*([^\n]+)/i);
    if (avM) result.angulo.avatar = avM[1].replace(/[*_]/g, "").trim();

    const vilM = angText.match(/Vilão Batizado[^*:]*[:*]+\s*([^\n]+)/i);
    if (vilM) result.angulo.vilao = vilM[1].replace(/[*_]/g, "").trim();

    const mecM = angText.match(/Mecanismo da Solução[^*:]*[:*]+\s*([^\n]+)/i);
    if (mecM) result.angulo.mecanismo = mecM[1].replace(/[*_]/g, "").trim();

    const anaM = angText.match(/Analogia-Mestre[^*:]*[:*]+\s*([^\n]+)/i);
    if (anaM) result.angulo.analogia = anaM[1].replace(/[*_]/g, "").trim();
  }

  // 3. Extrair Copy Mestre
  const copyMatch = content.match(/##\s*3\.[^\n]*\n([\s\S]*?)(?=##\s*4\.)/i);
  if (copyMatch) {
    let copyText = copyMatch[1]
      .replace(/\*\(Colar este texto[^\n]*\)\*/gi, "")
      .replace(/---\s*$/g, "")
      .trim();
    result.copyMestre = copyText;
  } else {
    // Fallback: tentar encontrar bloco de texto principal
    const fallbackCopy = content.match(/(?:Texto Principal|Primary Text)[\s\S]*?(?=##\s*4|VARIAÇÕES DE GANCHO|$)/i);
    if (fallbackCopy) {
      result.copyMestre = fallbackCopy[0].replace(/^(?:Texto Principal|Primary Text)[^\n]*\n/i, "").trim();
    }
  }

  // 4. Extrair Ganchos (G1, G2, G3)
  const ganchosMatch = content.match(/##\s*4\.[^\n]*\n([\s\S]*?)(?=##\s*5\.|$)/i);
  if (ganchosMatch) {
    const gText = ganchosMatch[1];
    const hookLines = gText.split("\n");
    let currentHook: { id: string; tipo: string; texto: string } | null = null;

    for (const line of hookLines) {
      const gHeader = line.match(/[-*]\s*\*\*(Gancho\s*\d+|G\d+)[^*]*\(([^)]+)\)[^*:]*[:*]+\s*["“]?([^"”\n]+)["”]?/i) ||
                      line.match(/[-*]\s*\*\*(Gancho\s*\d+|G\d+)[^*:]*[:*]+\s*["“]?([^"”\n]+)["”]?/i);
      if (gHeader) {
        if (currentHook) result.ganchos.push(currentHook);
        const id = gHeader[1].toUpperCase().includes("1") ? "G1" : gHeader[1].toUpperCase().includes("2") ? "G2" : "G3";
        const tipo = gHeader[2] && gHeader[3] ? gHeader[2].trim() : "Scroll-Stopper";
        const texto = (gHeader[3] || gHeader[2] || "").replace(/^["“”']|["“”']$/g, "").trim();
        currentHook = { id, tipo, texto };
      } else if (currentHook && line.trim().startsWith('"') && !currentHook.texto) {
        currentHook.texto = line.replace(/^["“”']|["“”']$/g, "").trim();
      }
    }
    if (currentHook) result.ganchos.push(currentHook);
  }

  // Se não extraiu ganchos de forma rígida, preencher ganchos padrão
  if (result.ganchos.length === 0) {
    result.ganchos = [
      { id: "G1", tipo: "Causa Raiz / Fato", texto: "Seus exames voltaram 'normais', mas seu espelho e suas roupas discordam." },
      { id: "G2", tipo: "Contradição / Curiosidade", texto: "Beber mais água e cortar sal não vão resolver o inchaço que aparece às 16h." },
      { id: "G3", tipo: "Identitário / Específico", texto: "Você não precisa de outra sessão de R$ 150. Precisa de suporte de dentro." },
    ];
  }

  // 5. Extrair Headlines (H1, H2, H3)
  const headMatch = content.match(/##\s*5\.[^\n]*\n([\s\S]*)$/i);
  if (headMatch) {
    const hText = headMatch[1];
    const headLines = hText.split("\n");
    let currentHead: { id: string; tipo: string; texto: string } | null = null;

    for (const line of headLines) {
      const hHeader = line.match(/[-*]\s*\*\*(Headline\s*\d+|H\d+)[^*]*\(([^)]+)\)[^*:]*[:*]+\s*["“]?([^"”\n]+)["”]?/i) ||
                      line.match(/[-*]\s*\*\*(Headline\s*\d+|H\d+)[^*:]*[:*]+\s*["“]?([^"”\n]+)["”]?/i);
      if (hHeader) {
        if (currentHead) result.headlines.push(currentHead);
        const id = hHeader[1].toUpperCase().includes("1") ? "H1" : hHeader[1].toUpperCase().includes("2") ? "H2" : "H3";
        const tipo = hHeader[2] && hHeader[3] ? hHeader[2].trim() : "Editorial";
        const texto = (hHeader[3] || hHeader[2] || "").replace(/^["“”']|["“”']$/g, "").trim();
        currentHead = { id, tipo, texto };
      }
    }
    if (currentHead) result.headlines.push(currentHead);
  }

  if (result.headlines.length === 0) {
    result.headlines = [
      { id: "H1", tipo: "Editorial", texto: "A Falha do Sistema que Nenhum Exame Padrão Consegue Medir" },
      { id: "H2", tipo: "Causa Raiz", texto: "Por Que Suas Pernas Pesam no Fim do Dia (Não É Retenção Comum)" },
      { id: "H3", tipo: "Revelação", texto: "O Ritual Botânico de 30 Segundos que Limpa os Vasos Ocultos" },
    ];
  }

  return result;
}

/**
 * Gera uma variação do anúncio combinando a Copy Mestre com o Gancho Verbal selecionado.
 */
export function generateAdWithHook(copyMestre: string, hookTexto: string): string {
  if (!copyMestre || !hookTexto) return copyMestre || hookTexto;

  const paragraphs = copyMestre.trim().split(/\n\s*\n/);
  if (paragraphs.length <= 1) {
    return `${hookTexto.trim()}\n\n${copyMestre.trim()}`;
  }

  // Substitui o 1º parágrafo da Copy Mestre pelo novo gancho
  return [hookTexto.trim(), ...paragraphs.slice(1)].join("\n\n");
}

/**
 * Formata o briefing executivo completo pronto para colar no WhatsApp ou Slack para o Gestor de Tráfego.
 */
export function formatBatchForMediaBuyer(batch: MemoFlowParsedBatch): string {
  const ganchosText = batch.ganchos
    .map(g => `*${g.id} (${g.tipo}):*\n"${g.texto}"`)
    .join("\n\n");

  const headlinesText = batch.headlines
    .map(h => `*${h.id} (${h.tipo}):*\n${h.texto}`)
    .join("\n\n");

  return `*🚀 BRIEFING EXECUTIVO DE TRÁFEGO — PADRÃO MEMOFLOW*

*1. INSTRUÇÕES OPERACIONAIS*
• *Campanha:* ${batch.campanha.tipo}
• *Destino:* ${batch.campanha.destino}
• *Otimização:* ${batch.campanha.regraCpa}
• *Regra de Montagem:* Manter a Copy Mestre no Texto Principal e alternar a 1ª linha com cada Gancho (G1, G2, G3) conforme a imagem/vídeo.

*2. ÂNGULO PERSUASIVO & MECANISMO*
• *Ângulo:* ${batch.angulo.nome}
• *Avatar:* ${batch.angulo.avatar}
• *Vilão Oculto:* ${batch.angulo.vilao}
• *Mecanismo:* ${batch.angulo.mecanismo}
• *Analogia:* ${batch.angulo.analogia}

*3. 📝 COPY MESTRE (TEXTO PRINCIPAL)*
${batch.copyMestre}

*4. 🪝 3 VARIAÇÕES DE GANCHO (1ª LINHA - SCROLL STOPPERS)*
${ganchosText}

*5. 📌 3 HEADLINES DE ALTA CONVERSÃO (TÍTULOS DO ANÚNCIO)*
${headlinesText}

_Briefing estruturado e pronto para subir no Gerenciador de Anúncios._`;
}
