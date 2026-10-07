// Pipeline de referências (REF2.1): cada referência passa por mídia guardada → texto (transcrição do vídeo ou leitura
// da imagem) → formato → projeto → ângulo (Jev, em jev-classify). TS puro: decide o próximo passo, monta os pedidos
// e lê as respostas. As chamadas HTTP ficam na função ref-pipeline.

export type PipelineStep = "guardar_midia" | "transcrever_video" | "ler_imagem" | "projeto";

export interface RefRow {
  id: string;
  tipo: string | null;
  url: string | null;
  image_url: string | null;
  project_id: string | null;
  transcricao: string | null;
  transcribe_status: string | null;
  duracao?: number | null;
  pipeline?: unknown;
}

export const MAX_TENTATIVAS = 3;
export const OWN_STORAGE = "tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/";

export const FORMATOS = {
  estatico: "Static image ad with headline/text over a photo or design",
  carrossel: "One slide of a carousel / multi-image post",
  print_conversa: "Screenshot of a chat, tweet, comment, notification or text post",
  antes_depois: "Before/after comparison",
  depoimento: "Customer testimonial or review (photo or video of a real-looking person talking about results)",
  ugc_fala: "Person talking to camera, selfie/UGC style, not a formal testimonial",
  demonstracao: "Product or technique being shown/applied on screen",
  narrativa_broll: "Voice-over story over b-roll / stock footage / slideshow",
  entrevista_podcast: "Interview, podcast cut, talk show or news clip",
  produto: "Product shot / packshot / offer card",
  infografico: "Infographic, list, chart or educational slide",
  meme: "Meme or humor format",
  outro: "None of the above",
} as const;
export type Formato = keyof typeof FORMATOS;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});

export function attempts(ref: Pick<RefRow, "pipeline">, step: PipelineStep): number {
  return Number(obj(obj(ref.pipeline)[step]).tentativas ?? 0);
}

const isVideo = (r: RefRow) => r.tipo === "video" || (r.duracao ?? 0) > 0;
const hasText = (r: RefRow) => String(r.transcricao ?? "").trim().length > 0;
export const isSignedUrl = (u: string | null) => !!u && /\/storage\/v1\/object\/sign\//.test(u);
export const isOwnStorage = (u: string | null) => !!u && u.includes(OWN_STORAGE);

/** Próximo passo da referência, ou null se está pronta (ou desistiu depois de 3 tentativas no passo). */
export function nextStep(ref: RefRow): PipelineStep | null {
  const ok = (s: PipelineStep) => attempts(ref, s) < MAX_TENTATIVAS;
  if (isSignedUrl(ref.image_url) && ok("guardar_midia")) return "guardar_midia";
  if (!hasText(ref)) {
    if (isVideo(ref) && isOwnStorage(ref.url) && ok("transcrever_video")) return "transcrever_video";
    if (!isVideo(ref) && isOwnStorage(ref.image_url) && ok("ler_imagem")) return "ler_imagem";
    return null;
  }
  if (!ref.project_id && !obj(obj(ref.pipeline).projeto).feito && ok("projeto")) return "projeto";
  return null;
}

const JSON_RULE = "Answer ONLY with a JSON object, no markdown.";

/** Pedido de leitura de imagem (OpenRouter, modelo com visão). */
export function imageReadMessages(imageUrl: string) {
  return [
    { role: "system", content: `You read ad creatives for a direct-response marketing team. ${JSON_RULE}` },
    {
      role: "user",
      content: [
        { type: "text", text: `Read this ad image. Return {"texto_na_imagem": exact text visible (keep original language, line breaks as \\n), "descricao_visual": 1-2 sentences in Portuguese describing the scene, person, product and layout, "formato": one of ${JSON.stringify(Object.keys(FORMATOS))}, "nicho": 2-4 words in Portuguese (e.g. "emagrecimento", "memória", "cabelo cacheado")}. Formats: ${JSON.stringify(FORMATOS)}` },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ];
}

/** Pedido de transcrição de vídeo (OpenRouter, Gemini com entrada de vídeo). */
export function videoReadMessages(dataUrl: string, mode: "video_url" | "image_url" = "video_url") {
  const media = mode === "video_url" ? { type: "video_url", video_url: { url: dataUrl } } : { type: "image_url", image_url: { url: dataUrl } };
  return [
    { role: "system", content: `You transcribe and dissect short video ads for a direct-response marketing team. ${JSON_RULE}` },
    {
      role: "user",
      content: [
        { type: "text", text: `Return {"transcricao": full spoken words verbatim in the original language (empty string if no speech), "texto_na_tela": on-screen text, "descricao_visual": 1-2 sentences in Portuguese about what is shown, "gancho": the first sentence or visual of the first 3 seconds, "formato": one of ${JSON.stringify(Object.keys(FORMATOS))}, "nicho": 2-4 words in Portuguese}. Formats: ${JSON.stringify(FORMATOS)}` },
        media,
      ],
    },
  ];
}

export interface Leitura {
  texto: string;
  formato: Formato;
  nicho: string | null;
  descricao_visual: string | null;
  gancho: string | null;
  texto_na_tela: string | null;
}

/** Lê o JSON do modelo (tolera cerca de ```json e texto antes/depois). Null se não deu para ler. */
export function parseLeitura(raw: string, kind: "imagem" | "video"): Leitura | null {
  const m = String(raw ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j: Record<string, unknown>;
  try { j = JSON.parse(m[0]); } catch { return null; }
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const formato = (str(j.formato) ?? "outro") as Formato;
  const principal = kind === "imagem" ? str(j.texto_na_imagem) : str(j.transcricao);
  const visual = str(j.descricao_visual);
  const tela = str(j.texto_na_tela);
  // O texto que o Jev e o time leem: fala (ou texto da imagem) + texto na tela + a descrição visual.
  const partes = [principal, tela ? `[na tela] ${tela}` : null, visual ? `[visual] ${visual}` : null].filter(Boolean);
  if (!partes.length) return null;
  return {
    texto: partes.join("\n\n"),
    formato: formato in FORMATOS ? formato : "outro",
    nicho: str(j.nicho), descricao_visual: visual, gancho: str(j.gancho), texto_na_tela: tela,
  };
}

export interface ProjectOption { id: string; name: string; nicho: string }

/** Pergunta ao Jev de qual projeto do Império a referência é matéria-prima (pelo nicho), com saída "nenhum". */
export function projectRequest(texto: string, projects: ReadonlyArray<ProjectOption>, model = "jev-latest") {
  const criteria: Record<string, string> = Object.fromEntries(projects.map((p) => [p.id, `${p.name} — ${p.nicho}`]));
  criteria.nenhum = "None of these projects: different niche or unclear.";
  return {
    model,
    state: { referencia: texto.slice(0, 3500) },
    questions: {
      projeto: {
        type: "choice",
        instructions: "This is a competitor/market ad saved as a reference. Which of our projects is it most useful for, judging by the niche, audience and problem it addresses (not by the brand)? Texts may be in Portuguese or English.",
        criteria,
      },
    },
  };
}

export const PROJETO_FIRME = 0.7;

export function parseProject(resp: { answers?: Record<string, { choice?: string; confidence?: number }> }): { project_id: string | null; confianca: number } {
  const a = resp.answers?.projeto ?? {};
  const conf = Math.round(Number(a.confidence ?? 0) * 1000) / 1000;
  const choice = a.choice && a.choice !== "nenhum" ? a.choice : null;
  return { project_id: choice && conf >= PROJETO_FIRME ? choice : null, confianca: conf };
}

/** Nicho do projeto para o Jev, a partir dos dados que já existem (público, mecanismo, descrição). */
export function projectNicho(data: unknown, fallback: string): string {
  const d = obj(data);
  const parts = [d.nicho, d.publico_alvo, d.mecanismo_unico, d.descricao].filter((v) => typeof v === "string" && v.trim()) as string[];
  const text = (parts.join(" · ") || fallback).replace(/\s+/g, " ");
  return text.length > 220 ? `${text.slice(0, 219)}…` : text;
}

/** Contagem de saúde da biblioteca para o painel. */
export function libraryHealth(refs: ReadonlyArray<RefRow & { copy_lib_status?: string | null }>) {
  const videos = refs.filter(isVideo);
  const imagens = refs.filter((r) => !isVideo(r));
  return {
    total: refs.length,
    videos: videos.length,
    videos_com_texto: videos.filter(hasText).length,
    imagens: imagens.length,
    imagens_lidas: imagens.filter(hasText).length,
    com_projeto: refs.filter((r) => r.project_id).length,
    com_angulo: refs.filter((r) => r.copy_lib_status === "firme" || r.copy_lib_status === "revisado").length,
    so_link: refs.filter((r) => !isOwnStorage(r.url) && !isOwnStorage(r.image_url)).length,
    travadas: refs.filter((r) => (["guardar_midia", "transcrever_video", "ler_imagem"] as PipelineStep[]).some((s) => attempts(r, s) >= MAX_TENTATIVAS)).length,
  };
}
