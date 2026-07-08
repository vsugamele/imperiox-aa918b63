export interface CanvasBlockType {
  id: string;
  label: string;
  icon: string;
  desc: string;
  kind: "image" | "video" | "audio" | "prompt" | "avatar" | "publish";
  color: string;
  defaultConfig?: Record<string, any>;
}

export const CANVAS_BLOCKS: CanvasBlockType[] = [
  {
    id: "image",
    label: "Imagem",
    icon: "🖼️",
    desc: "Gera imagem (Nano Banana, Seedream, Flux…)",
    kind: "image",
    color: "border-amber-500/40 bg-amber-500/5",
    defaultConfig: { provider: "kie", model: "nano-banana-2", prompt: "", params: { aspect_ratio: "9:16", size: "864x1536", quality: "high" } },
  },
  {
    id: "video",
    label: "Vídeo",
    icon: "🎬",
    desc: "Anima imagem em vídeo (Veo, Kling, Seedance)",
    kind: "video",
    color: "border-rose-500/40 bg-rose-500/5",
    defaultConfig: { provider: "kie", model: "veo3.1", prompt: "", params: { aspect_ratio: "9:16", duration: 5, resolution: "720p" } },
  },
  {
    id: "audio",
    label: "Áudio / Narração",
    icon: "🎙️",
    desc: "TTS com ElevenLabs",
    kind: "audio",
    color: "border-sky-500/40 bg-sky-500/5",
    defaultConfig: { provider: "elevenlabs", model: "eleven_multilingual_v2", prompt: "", voice_id: "JBFqnCBsd6RMkjVDRZzb" },
  },
  {
    id: "avatar",
    label: "Avatar Falante",
    icon: "🗣️",
    desc: "Lipsync (Seedance 2)",
    kind: "avatar",
    color: "border-violet-500/40 bg-violet-500/5",
    defaultConfig: { provider: "kie", model: "seedance-2", prompt: "", params: { aspect_ratio: "9:16", duration: 10, resolution: "1080p", generate_audio: false } },
  },
  {
    id: "prompt",
    label: "Prompt (Hyper)",
    icon: "⚡",
    desc: "Bloco de prompt/roteiro",
    kind: "prompt",
    color: "border-primary/40 bg-primary/5",
    defaultConfig: { texto: "" },
  },
  {
    id: "publish",
    label: "Publicar / Salvar",
    icon: "📤",
    desc: "Marca saída final do fluxo",
    kind: "publish",
    color: "border-emerald-500/40 bg-emerald-500/5",
    defaultConfig: {},
  },
];

export const TEMPLATES: {
  key: string;
  name: string;
  description: string;
  nodes: { tipo: string; position: { x: number; y: number }; config?: any; titulo?: string }[];
  edges: { from: number; to: number }[];
}[] = [
  {
    key: "reels_narracao",
    name: "Reels com narração",
    description: "Imagem → vídeo Veo → narração",
    nodes: [
      { tipo: "image", position: { x: 100, y: 200 }, titulo: "Imagem cinematográfica" },
      { tipo: "video", position: { x: 420, y: 200 }, titulo: "Anima com Veo 3.1" },
      { tipo: "audio", position: { x: 740, y: 200 }, titulo: "Narração" },
      { tipo: "publish", position: { x: 1060, y: 200 } },
    ],
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }],
  },
  {
    key: "story_animado",
    name: "Story animado",
    description: "Imagem 9:16 → vídeo curto",
    nodes: [
      { tipo: "image", position: { x: 100, y: 200 } },
      { tipo: "video", position: { x: 420, y: 200 } },
      { tipo: "publish", position: { x: 740, y: 200 } },
    ],
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }],
  },
  {
    key: "avatar_falante",
    name: "Avatar Falante (Lipsync)",
    description: "Avatar → voz → lipsync",
    nodes: [
      { tipo: "image", position: { x: 100, y: 120 }, titulo: "Avatar (retrato)" },
      { tipo: "audio", position: { x: 100, y: 320 }, titulo: "Roteiro falado" },
      { tipo: "avatar", position: { x: 460, y: 220 }, titulo: "Seedance 2 lipsync" },
      { tipo: "publish", position: { x: 800, y: 220 } },
    ],
    edges: [{ from: 0, to: 2 }, { from: 1, to: 2 }, { from: 2, to: 3 }],
  },
];
