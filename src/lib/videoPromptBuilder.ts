export type VideoPlatform = "veo3" | "sora" | "runway" | "heygen";

export interface VideoFields {
  // Camada 1 — Ação
  movimentoPrincipal: string;
  // Camada 2 — Personagem
  movimentoCorpo: string;
  expressaoFacial: string;
  olharDirecao: string;
  // Camada 3 — Câmera
  movimentoCamera: string;
  velocidadeCamera: string;
  lente: string;
  // Camada 4 — Áudio
  somAmbiente: string;
  musicaFundo: string;
  atmosferaMood: string;
  // Camada 5 — Voz
  dialogo: string;
  tomVoz: string;
  idioma: string;
  // Camada 6 — Técnico
  duracao: string;
  estiloVisual: string;
  continuidade: string;
  aspectRatio: string;
  plataforma: VideoPlatform;
}

const has = (s: string) => s && s.trim().length > 0;

function buildVeo3(f: VideoFields): string {
  const lines: string[] = [];
  lines.push(`A cinematic video clip. ${f.movimentoPrincipal || "The subject performs the main action"}.`);

  const persona: string[] = [];
  if (has(f.movimentoCorpo)) persona.push(`The character ${f.movimentoCorpo}`);
  if (has(f.expressaoFacial)) persona.push(`with a ${f.expressaoFacial} expression`);
  if (has(f.olharDirecao)) persona.push(f.olharDirecao);
  if (persona.length) lines.push(persona.join(", ") + ".");

  const cam: string[] = [];
  if (has(f.movimentoCamera)) cam.push(`The camera ${f.movimentoCamera}`);
  if (has(f.velocidadeCamera)) cam.push(f.velocidadeCamera);
  if (has(f.lente)) cam.push(`shot on ${f.lente}`);
  if (cam.length) lines.push(cam.join(", ") + ".");

  const audio: string[] = [];
  if (has(f.somAmbiente)) audio.push(`Background ambient sound: ${f.somAmbiente}`);
  if (has(f.musicaFundo)) audio.push(`music: ${f.musicaFundo}`);
  if (has(f.atmosferaMood)) audio.push(`overall mood: ${f.atmosferaMood}`);
  if (audio.length) lines.push(audio.join(". ") + ".");

  if (has(f.dialogo)) {
    const tom = has(f.tomVoz) ? `in a ${f.tomVoz} voice` : "";
    const idm = has(f.idioma) ? ` in ${f.idioma}` : "";
    lines.push(`Character says ${tom}${idm}: "${f.dialogo}".`);
  }

  const tech: string[] = [];
  if (has(f.duracao)) tech.push(`Duration: ${f.duracao}s`);
  if (has(f.estiloVisual)) tech.push(`visual style: ${f.estiloVisual}`);
  if (has(f.continuidade)) tech.push(`editing: ${f.continuidade}`);
  if (has(f.aspectRatio)) tech.push(`aspect ratio: ${f.aspectRatio}`);
  if (tech.length) lines.push(tech.join(", ") + ".");

  return lines.join(" ");
}

function buildSora(f: VideoFields): string {
  const parts: string[] = [];
  if (has(f.movimentoPrincipal)) parts.push(f.movimentoPrincipal);
  if (has(f.movimentoCorpo)) parts.push(`The character ${f.movimentoCorpo}`);
  if (has(f.expressaoFacial)) parts.push(`${f.expressaoFacial} expression`);
  if (has(f.movimentoCamera)) parts.push(`Camera ${f.movimentoCamera} ${f.velocidadeCamera}`.trim());
  if (has(f.atmosferaMood)) parts.push(`Mood: ${f.atmosferaMood}`);
  if (has(f.somAmbiente)) parts.push(`Ambient: ${f.somAmbiente}`);
  if (has(f.estiloVisual)) parts.push(f.estiloVisual);
  if (has(f.duracao)) parts.push(`${f.duracao}s`);
  if (has(f.aspectRatio)) parts.push(f.aspectRatio);
  return parts.filter(Boolean).join(". ") + ".";
}

function buildRunway(f: VideoFields): string {
  const tags = [
    f.movimentoPrincipal,
    f.movimentoCorpo,
    f.expressaoFacial,
    f.olharDirecao,
    f.movimentoCamera,
    f.velocidadeCamera,
    f.lente,
    f.atmosferaMood,
    f.estiloVisual,
    f.continuidade,
    f.aspectRatio,
  ].filter(has);
  return tags.join(", ");
}

function buildHeyGen(f: VideoFields): string {
  const lines: string[] = [];
  lines.push(`Avatar performs: ${f.movimentoPrincipal || "natural presenter gesture"}.`);
  if (has(f.movimentoCorpo)) lines.push(`Body: ${f.movimentoCorpo}.`);
  if (has(f.expressaoFacial)) lines.push(`Facial expression: ${f.expressaoFacial}.`);
  if (has(f.olharDirecao)) lines.push(`Gaze: ${f.olharDirecao}.`);
  if (has(f.dialogo)) {
    const tom = has(f.tomVoz) ? ` (${f.tomVoz})` : "";
    const idm = has(f.idioma) ? ` [${f.idioma}]` : "";
    lines.push(`Script${tom}${idm}: "${f.dialogo}"`);
  }
  if (has(f.atmosferaMood)) lines.push(`Mood: ${f.atmosferaMood}.`);
  if (has(f.duracao)) lines.push(`Duration: ${f.duracao}s.`);
  return lines.join(" ");
}

export function buildVideoPrompt(f: VideoFields): string {
  switch (f.plataforma) {
    case "sora": return buildSora(f);
    case "runway": return buildRunway(f);
    case "heygen": return buildHeyGen(f);
    case "veo3":
    default: return buildVeo3(f);
  }
}

export function buildVideoPromptJson(f: VideoFields): Record<string, any> {
  const clean = (o: Record<string, any>) =>
    Object.fromEntries(Object.entries(o).filter(([_, v]) => v && String(v).trim()));
  return clean({
    action: clean({ main: f.movimentoPrincipal }),
    character: clean({
      body: f.movimentoCorpo,
      expression: f.expressaoFacial,
      gaze: f.olharDirecao,
    }),
    camera: clean({
      movement: f.movimentoCamera,
      speed: f.velocidadeCamera,
      lens: f.lente,
    }),
    audio: clean({
      ambient: f.somAmbiente,
      music: f.musicaFundo,
      mood: f.atmosferaMood,
    }),
    dialogue: clean({
      line: f.dialogo,
      tone: f.tomVoz,
      language: f.idioma,
    }),
    technical: clean({
      duration_seconds: f.duracao,
      visual_style: f.estiloVisual,
      continuity: f.continuidade,
      aspect_ratio: f.aspectRatio,
      platform: f.plataforma,
    }),
  });
}

export const emptyVideoFields: VideoFields = {
  movimentoPrincipal: "shuffles slowly and lays the deck on the table",
  movimentoCorpo: "leans forward over the table",
  expressaoFacial: "a wise smile forms slowly",
  olharDirecao: "looks at the cards, then rises to meet the camera",
  movimentoCamera: "stays static",
  velocidadeCamera: "at an almost imperceptible pace",
  lente: "",
  somAmbiente: "crackle of candles and rustle of fabric",
  musicaFundo: "none",
  atmosferaMood: "tense anticipation rising",
  dialogo: "",
  tomVoz: "low, calm and mysterious",
  idioma: "Portuguese (BR)",
  duracao: "5",
  estiloVisual: "photorealistic cinematic",
  continuidade: "single shot, no cuts",
  aspectRatio: "9:16",
  plataforma: "veo3",
};
