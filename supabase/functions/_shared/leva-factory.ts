// Fábrica da leva (OPS1.4): transforma cada item de uma leva aprovada do Estrategista em copy + instrução de imagem.
// A copy segue o Método H&W (porta, ponto da rota, hook com as 4 funções, aterrissagem para ela, Regra do Um,
// compliance); a imagem segue o formato e a carga do primeiro quadro. TS puro: a creative-factory chama o modelo.
import { CARGAS, PONTOS_ROTA, PORTAS, type Carga, type Porta } from "./hw-taxonomy.ts";
import { hardFindings } from "./hw-review.ts";
import type { LevaItem } from "./batch-strategist.ts";

export const PORTA_INSTRUCAO: Record<Porta, string> = {
  direta: "Hook DIRETO: a dor dela na primeira frase, chamando quem tem esse problema (\"Se você ... , olha isso\").",
  voz_dela: "Hook VOZ DELA: abre com uma frase entre aspas que a própria pessoa já disse em voz alta, depois \"se você já disse isso...\".",
  quebra_crenca: "Hook QUEBRA DE CRENÇA: contesta algo que ela acredita que é certo e é justamente o que atrapalha.",
  narrativa: "Hook NARRATIVA: uma cena curta com alguém próximo (cliente, filha, colega) ou com quem narra; a história puxa o resto.",
  descoberta: "Hook DESCOBERTA: um hábito, detalhe ou mecanismo novo e específico que ela nunca ouviu.",
};

export const FORMATO_INSTRUCAO: Record<string, string> = {
  estatico: "Anúncio estático: uma foto realista ocupando a peça, com a headline grande sobreposta em área limpa e um botão discreto.",
  carrossel: "Primeira lâmina de um carrossel: título grande que puxa para a próxima lâmina, indicador sutil de \"arraste\", visual limpo.",
  print_conversa: "Print realista de conversa de WhatsApp no celular (balões verdes e brancos, horário, sem nome real de pessoa), a mensagem principal é a headline; nada de logo de app.",
  antes_depois: "Comparação lado a lado ANTES / DEPOIS do resultado do trabalho (não do corpo da pessoa), mesma luz e enquadramento, rótulos pequenos; sem exagero irreal.",
  infografico: "Infográfico simples: título grande e 3 a 4 itens numerados curtos, ícones simples, fundo limpo, leitura em 3 segundos.",
  meme: "Formato de meme: imagem com expressão/situação reconhecível e texto curto em cima e embaixo, tom bem-humorado, sem personagens com direitos autorais.",
  depoimento: "Depoimento: rosto de uma pessoa comum olhando para a câmera, com a frase dela entre aspas em destaque e o nome curto embaixo.",
};

export const CARGA_INSTRUCAO: Record<Carga, string> = {
  objeto_estranho: "O primeiro olhar cai num objeto ou ação inesperada que a pessoa não sabe explicar de cara.",
  rosto_emocao: "Um rosto humano com emoção clara, olhando para a câmera.",
  cena_vida: "Uma cena reconhecível da rotina de quem é o público (o momento do problema).",
  contradicao: "Algo que não bate à primeira vista e faz o cérebro parar para resolver.",
  bloco: "Produto em destaque (evitar no tráfego frio).",
};

export interface AnguloRef { nome: string; explicacao?: string | null; exemplo?: string | null; como_usar?: string | null }

export interface LevaContext {
  oferta: string;
  publico?: string | null;
  marca_topo?: string | null;
  angulo?: AnguloRef | null;
  referencias?: string[];
}

export interface LevaCopy {
  headline_arte: string;
  subtitulo_arte: string;
  cta_arte: string;
  texto_anuncio: string;
  headline_anuncio: string;
  cena_primeiro_quadro: string;
}

const clip = (s: string | null | undefined, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export function levaCopyPrompt(item: LevaItem, ctx: LevaContext, jaUsadas: string[] = []): { system: string; user: string } {
  return {
    system: [
      "Você é copywriter de resposta direta no Brasil escrevendo criativos de Meta Ads para tráfego frio.",
      "Responda SÓ JSON: {\"headline_arte\":string,\"subtitulo_arte\":string,\"cta_arte\":string,\"texto_anuncio\":string,\"headline_anuncio\":string,\"cena_primeiro_quadro\":string}.",
      "headline_arte: até 7 palavras, sem ponto final. subtitulo_arte: até 22 palavras. cta_arte: até 4 palavras.",
      "texto_anuncio (primary text): 3 a 6 frases curtas. A 1ª frase é o HOOK e cumpre 4 funções: para o dedo, faz a pessoa pensar \"isso é comigo\", abre UMA pergunta específica que a página responde, e chega rápido ao assunto da oferta.",
      "A 2ª frase é a ATERRISSAGEM: promete algo para quem lê (\"você\"), com um número exato quando couber (73 segundos, 11 dias) ou ligada ao que aparece na imagem; não vende ainda e não fala de outra pessoa.",
      "Uma ideia, uma emoção, uma promessa, uma ação. O vilão nunca é a pessoa que lê. Feche com um motivo para clicar, sem pedir para \"assistir o vídeo\".",
      "PROIBIDO: afirmar condição pessoal de saúde de quem lê, prometer cura, resultado garantido ou resultado com prazo fixo, marca de terceiros, número inventado como estatística.",
      "cena_primeiro_quadro: 1 frase descrevendo o que aparece no primeiro olhar da imagem (sem texto), coerente com o hook.",
    ].join(" "),
    user: [
      `Oferta: ${ctx.oferta}`,
      ctx.publico ? `Público: ${ctx.publico}` : null,
      `Ângulo: ${item.angulo}${ctx.angulo?.explicacao ? ` — ${clip(ctx.angulo.explicacao, 300)}` : ""}`,
      ctx.angulo?.como_usar ? `Como usar este ângulo: ${clip(ctx.angulo.como_usar, 300)}` : null,
      ctx.angulo?.exemplo ? `Exemplo do ângulo (não copie, só o raciocínio): ${clip(ctx.angulo.exemplo, 300)}` : null,
      `Ponto da rota: ${item.ponto_rota} (${PONTOS_ROTA[item.ponto_rota]}): fale da vida dela, não do produto.`,
      PORTA_INSTRUCAO[item.porta],
      `Formato da peça: ${item.formato_label}. Carga do primeiro quadro: ${CARGAS[item.carga]}.`,
      `Hipótese do teste: ${item.hipotese}`,
      ctx.referencias?.length ? `Anúncios do mercado nesse ângulo/formato (referência de estrutura, não copie): ${ctx.referencias.map((r) => clip(r, 160)).join(" | ")}` : null,
      jaUsadas.length ? `Não repita estas headlines: ${jaUsadas.join(" | ")}` : null,
    ].filter(Boolean).join("\n"),
  };
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function parseLevaCopy(raw: unknown): LevaCopy | null {
  let o: Record<string, unknown>;
  try {
    o = typeof raw === "string" ? JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim()) : (raw as Record<string, unknown>);
  } catch { return null; }
  if (!o || typeof o !== "object") return null;
  const c: LevaCopy = {
    headline_arte: str(o.headline_arte).replace(/[.]+$/, ""), subtitulo_arte: str(o.subtitulo_arte), cta_arte: str(o.cta_arte),
    texto_anuncio: str(o.texto_anuncio), headline_anuncio: str(o.headline_anuncio), cena_primeiro_quadro: str(o.cena_primeiro_quadro),
  };
  if (Object.values(c).some((v) => !v)) return null;
  if (words(c.headline_arte) > 7 || words(c.subtitulo_arte) > 22 || words(c.cta_arte) > 4) return null;
  return c;
}

/** Instrução de imagem: formato + carga + cena + textos exatos; referências do mercado só como inspiração de layout. */
export function levaImagePrompt(item: LevaItem, copy: LevaCopy, ctx: Pick<LevaContext, "marca_topo" | "publico">, aspecto = "4:5", temReferencia = false): string {
  return [
    `Crie um criativo de anúncio no formato ${aspecto}. ${FORMATO_INSTRUCAO[item.formato] ?? FORMATO_INSTRUCAO.estatico}`,
    `Primeiro olhar: ${CARGA_INSTRUCAO[item.carga]} Cena: ${copy.cena_primeiro_quadro}`,
    ctx.publico ? `As pessoas na imagem devem parecer com o público: ${ctx.publico}.` : null,
    "Fotografia realista, pessoas brasileiras comuns, mãos e rostos naturais, sem deformação.",
    temReferencia ? "As imagens anexas são anúncios do mercado: use só como inspiração de composição e ritmo visual. Não copie pessoas, marcas, logos nem textos delas." : null,
    ctx.marca_topo ? `Pequeno, no topo: "${ctx.marca_topo}".` : null,
    `Headline grande: "${copy.headline_arte.toUpperCase()}".`,
    `Texto de apoio menor: "${copy.subtitulo_arte}".`,
    item.formato === "print_conversa" ? null : `Botão: "${copy.cta_arte}".`,
    "Todo texto em português do Brasil, exatamente como escrito, sem letras trocadas e sem texto extra. Nenhum logo de terceiros.",
  ].filter(Boolean).join("\n");
}

/** Quais itens gerar nesta rodada: só imagem, até o limite, na ordem da leva. */
export function levaToGenerate(itens: ReadonlyArray<LevaItem>, limite = 20): Array<{ idx: number; item: LevaItem }> {
  return itens.map((item, idx) => ({ idx, item })).filter((x) => !x.item.precisa_video).slice(0, Math.max(1, Math.min(40, limite)));
}

/** Checagem gratuita (regex do Revisor) da copy gerada: o que reprovaria antes de subir. */
export function quickReview(copy: LevaCopy) {
  const f = hardFindings({ texto: copy.texto_anuncio, headline: `${copy.headline_arte}. ${copy.headline_anuncio}` });
  return { reprova: f.some((x) => x.obrigatoria), achados: f.map((x) => `${x.achado} ("${x.trecho}")`) };
}
