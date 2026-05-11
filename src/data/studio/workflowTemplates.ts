export type WorkflowStep = {
  kind: "image" | "video" | "audio";
  provider: "openrouter" | "kie" | "luma" | "elevenlabs";
  model: string;
  prompt: string;
  params?: Record<string, any>;
  voice_id?: string;
  // Optional: reference an upstream step output as input image. e.g. "{{step1.output}}"
  image_url?: string;
  // Optional: reference audio URL for lipsync (e.g. Seedance 2). Supports {{stepN.output}}.
  audio_url?: string;
};

export type WorkflowTemplate = {
  key: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: "reels_narracao",
    name: "Reels com narração",
    description: "Gera uma imagem cinematográfica → anima com Veo 3.1 (image-to-video) → cria narração TTS.",
    steps: [
      {
        kind: "image",
        provider: "kie",
        model: "nano-banana-2",
        prompt: "Cena cinematográfica vertical, iluminação dramática, profundidade de campo, ultrarrealista. Tema: [DESCREVA AQUI]",
        params: { aspect_ratio: "9:16", size: "864x1536", quality: "high" },
      },
      {
        kind: "video",
        provider: "kie",
        model: "veo3.1",
        prompt: "Câmera aproxima lentamente, movimento suave, atmosfera cinematográfica.",
        image_url: "{{step1.output}}",
        params: { aspect_ratio: "9:16", duration: 5, resolution: "720p" },
      },
      {
        kind: "audio",
        provider: "elevenlabs",
        model: "eleven_multilingual_v2",
        prompt: "Roteiro da narração curta (15-20 segundos) em português.",
        voice_id: "JBFqnCBsd6RMkjVDRZzb",
      },
    ],
  },
  {
    key: "story_animado",
    name: "Story animado",
    description: "Imagem 9:16 → vídeo curto 5s para Story.",
    steps: [
      {
        kind: "image",
        provider: "kie",
        model: "seedream-4",
        prompt: "Imagem fotorealista vertical para story, alta saturação, foco no produto/personagem.",
        params: { aspect_ratio: "9:16", size: "864x1536", quality: "high" },
      },
      {
        kind: "video",
        provider: "kie",
        model: "veo3-fast",
        prompt: "Animação sutil, paralaxe, movimento de câmera lento.",
        image_url: "{{step1.output}}",
        params: { aspect_ratio: "9:16", duration: 5, resolution: "720p" },
      },
    ],
  },
  {
    key: "anuncio_voz",
    name: "Anúncio com voz",
    description: "Imagem persuasiva → vídeo de impacto → narração de venda.",
    steps: [
      {
        kind: "image",
        provider: "kie",
        model: "ideogram-v3",
        prompt: "Anúncio visual com headline curta legível: \"[HEADLINE]\". Cores vibrantes, alto contraste, foco no benefício.",
        params: { aspect_ratio: "9:16", size: "864x1536", quality: "high" },
      },
      {
        kind: "video",
        provider: "kie",
        model: "veo3.1",
        prompt: "Movimento dinâmico, zoom in no headline, energia alta.",
        image_url: "{{step1.output}}",
        params: { aspect_ratio: "9:16", duration: 5, resolution: "720p" },
      },
      {
        kind: "audio",
        provider: "elevenlabs",
        model: "eleven_multilingual_v2",
        prompt: "Pare tudo. [Promessa]. Em [tempo], você vai [resultado]. Comenta SIM agora.",
        voice_id: "onwK4e9ZLuTAKqWW03F9",
      },
    ],
  },
  {
    key: "edicao_produto",
    name: "Edição de produto (foto base)",
    description: "Pega uma foto sua → reedita com Flux Kontext em ambiente novo → anima.",
    steps: [
      {
        kind: "image",
        provider: "kie",
        model: "flux-kontext-pro",
        prompt: "Coloque o produto em um ambiente premium luxuoso, mantendo o produto idêntico.",
        image_url: "COLE_URL_DA_SUA_FOTO_AQUI",
        params: { aspect_ratio: "1:1", size: "1024x1024", quality: "high" },
      },
      {
        kind: "video",
        provider: "kie",
        model: "kling-2.1",
        prompt: "Câmera orbital lenta ao redor do produto.",
        image_url: "{{step1.output}}",
        params: { aspect_ratio: "1:1", duration: 5, resolution: "720p" },
      },
    ],
  },
  {
    key: "avatar_falante",
    name: "Avatar Falante (Lipsync)",
    description: "Gera o avatar → cria a fala com ElevenLabs → sincroniza lábios com Seedance 2 da Kie.ai.",
    steps: [
      {
        kind: "image",
        provider: "kie",
        model: "nano-banana-2",
        prompt: "Retrato vertical premium de um avatar olhando diretamente para a câmera, expressão neutra, iluminação cinematográfica suave, fundo desfocado, ultrarrealista, qualidade fotográfica.",
        params: { aspect_ratio: "9:16", size: "864x1536", quality: "high" },
      },
      {
        kind: "audio",
        provider: "elevenlabs",
        model: "eleven_multilingual_v2",
        prompt: "Olá. Este é o roteiro que o avatar vai falar. Mantenha entre 10 e 15 segundos para garantir o lipsync perfeito.",
        voice_id: "JBFqnCBsd6RMkjVDRZzb",
      },
      {
        kind: "video",
        provider: "kie",
        model: "seedance-2",
        prompt: "Avatar falando naturalmente para a câmera, micro-expressões realistas, lipsync perfeito.",
        image_url: "{{step1.output}}",
        audio_url: "{{step2.output}}",
        params: { aspect_ratio: "9:16", duration: 10, resolution: "1080p", generate_audio: false },
      },
    ],
  },
];
