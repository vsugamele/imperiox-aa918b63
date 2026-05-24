// Cada option: label PT-BR, value frase cinematográfica em inglês (pronta pro prompt)
export type Opt = { label: string; value: string };

export const MOVIMENTO_PRINCIPAL: Opt[] = [
  { label: "Embaralha lentamente e pousa o deck", value: "shuffles slowly and lays the deck on the table" },
  { label: "Vira uma carta com cuidado ritualístico", value: "turns a single card with ritualistic care" },
  { label: "Estende a mão em direção à câmera", value: "extends a hand slowly toward the camera" },
  { label: "Segura um pingente próximo ao rosto", value: "lifts a pendant close to her face" },
  { label: "Caminha lentamente em direção à câmera", value: "walks slowly toward the camera" },
  { label: "Apaga uma vela com um sopro suave", value: "blows out a candle with a soft breath" },
  { label: "Sussurra olhando direto para a lente", value: "leans in and whispers directly at the lens" },
];

export const MOVIMENTO_CORPO: Opt[] = [
  { label: "Inclina-se sobre a mesa", value: "leans forward over the table" },
  { label: "Recosta lentamente para trás", value: "leans back slowly into the chair" },
  { label: "Cruza os braços e endireita o tronco", value: "crosses arms and straightens the torso" },
  { label: "Gira o ombro em direção à câmera", value: "turns the shoulder toward the camera" },
  { label: "Permanece imóvel, respiração contida", value: "remains perfectly still, breath held" },
];

export const EXPRESSAO_FACIAL: Opt[] = [
  { label: "Sorriso sábio se forma lentamente", value: "a wise smile forms slowly" },
  { label: "Olhar sério se suaviza pouco a pouco", value: "serious gaze softens little by little" },
  { label: "Sobrancelha levanta em revelação", value: "an eyebrow lifts in a moment of revelation" },
  { label: "Expressão neutra, intensidade fria", value: "neutral face holding a cold intensity" },
  { label: "Risada silenciosa, quase imperceptível", value: "an almost imperceptible silent laugh" },
];

export const OLHAR_DIRECAO: Opt[] = [
  { label: "Olha para as cartas, depois sobe à câmera", value: "looks down at the cards, then rises to meet the camera" },
  { label: "Encara diretamente a lente", value: "stares directly into the lens" },
  { label: "Desvia o olhar lentamente para o lado", value: "averts the gaze slowly to the side" },
  { label: "Olhos fechados, abrem subitamente", value: "eyes closed, snap open suddenly" },
  { label: "Olhar perdido no horizonte", value: "gaze lost in the distance" },
];

export const MOVIMENTO_CAMERA: Opt[] = [
  { label: "Estática — câmera fixa", value: "stays static" },
  { label: "Dolly in lento", value: "performs a slow dolly in" },
  { label: "Dolly out lento", value: "performs a slow dolly out" },
  { label: "Pan lateral suave", value: "pans laterally" },
  { label: "Orbita ao redor do personagem", value: "orbits around the character" },
  { label: "Crane descendo do alto", value: "cranes down from above" },
  { label: "Handheld discreto", value: "moves with subtle handheld sway" },
];

export const VELOCIDADE_CAMERA: Opt[] = [
  { label: "Lentíssimo, quase imperceptível", value: "at an almost imperceptible pace" },
  { label: "Lento e contemplativo", value: "slowly and contemplatively" },
  { label: "Médio, ritmo natural", value: "at a natural pace" },
  { label: "Rápido, com urgência", value: "quickly, with urgency" },
];

export const LENTE: Opt[] = [
  { label: "—", value: "" },
  { label: "35mm anamórfica", value: "an anamorphic 35mm lens" },
  { label: "50mm cinema prime", value: "a 50mm cinema prime" },
  { label: "85mm retrato", value: "an 85mm portrait lens" },
  { label: "Wide 24mm", value: "a 24mm wide lens" },
];

export const SOM_AMBIENTE: Opt[] = [
  { label: "Estalo de velas e rumor de tecido", value: "crackle of candles and rustle of fabric" },
  { label: "Chuva suave ao fundo", value: "soft rain in the background" },
  { label: "Silêncio absoluto", value: "absolute silence" },
  { label: "Murmúrio urbano distante", value: "distant urban murmur" },
  { label: "Vento atravessando madeira velha", value: "wind passing through old wood" },
];

export const MUSICA_FUNDO: Opt[] = [
  { label: "Sem música", value: "none" },
  { label: "Drone grave e contínuo", value: "a low continuous drone" },
  { label: "Piano minimalista", value: "minimal piano notes" },
  { label: "Cordas tensas em crescendo", value: "tense strings in crescendo" },
  { label: "Batida eletrônica sutil", value: "subtle electronic pulse" },
];

export const ATMOSFERA_MOOD: Opt[] = [
  { label: "Antecipação tensa subindo", value: "tense anticipation rising" },
  { label: "Mistério calmo e denso", value: "calm dense mystery" },
  { label: "Revelação iminente", value: "imminent revelation" },
  { label: "Melancolia luminosa", value: "luminous melancholy" },
  { label: "Poder contido", value: "contained power" },
];

export const TOM_VOZ: Opt[] = [
  { label: "Grave, calma e misteriosa", value: "low, calm and mysterious" },
  { label: "Sussurrada, íntima", value: "whispered and intimate" },
  { label: "Firme e autoritária", value: "firm and authoritative" },
  { label: "Suave e acolhedora", value: "soft and welcoming" },
];

export const IDIOMA: Opt[] = [
  { label: "Português (BR)", value: "Portuguese (BR)" },
  { label: "Inglês", value: "English" },
  { label: "Espanhol", value: "Spanish" },
];

export const ESTILO_VISUAL: Opt[] = [
  { label: "Cinematográfico fotorrealista", value: "photorealistic cinematic" },
  { label: "Filme analógico anos 70", value: "70s analog film look" },
  { label: "Editorial moody high-fashion", value: "moody high-fashion editorial" },
  { label: "Noir contrastado", value: "high-contrast film noir" },
  { label: "Documentário cinematográfico", value: "cinematic documentary" },
];

export const CONTINUIDADE: Opt[] = [
  { label: "Plano único, sem cortes", value: "single shot, no cuts" },
  { label: "Corte único no meio", value: "one cut mid-clip" },
  { label: "Múltiplos cortes ritmados", value: "rhythmic multi-cut sequence" },
];

export const ASPECT_RATIO: Opt[] = [
  { label: "9:16 (vertical)", value: "9:16" },
  { label: "16:9 (horizontal)", value: "16:9" },
  { label: "1:1 (quadrado)", value: "1:1" },
  { label: "2.35:1 (cinemascope)", value: "2.35:1" },
];

export const PLATAFORMA: { label: string; value: "veo3" | "sora" | "runway" | "heygen"; desc: string }[] = [
  { label: "Veo 3 (Google)", value: "veo3", desc: "Parágrafo cinematográfico, áudio nativo" },
  { label: "Sora (OpenAI)", value: "sora", desc: "Narrativa concisa, frases curtas" },
  { label: "Runway Gen-3", value: "runway", desc: "Tags separadas por vírgula" },
  { label: "HeyGen", value: "heygen", desc: "Avatar prescritivo + script" },
];
