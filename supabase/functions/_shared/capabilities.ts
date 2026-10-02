// Catálogo de capacidades (libs, bancos de assets e ferramentas de render) que as IAs consultam
// antes de executar uma etapa. TS puro e sem dependências: usado pelo project-mcp e testável no vitest.
// Os itens ficam na tabela imphq_capabilities; aqui mora só a regra "tipo de etapa → tarefa".

export type CapabilityTask =
  | "criativo_video" | "criativo_imagem" | "audio" | "pagina" | "interface"
  | "dashboard" | "automacao" | "icones" | "ilustracao" | "3d";

export const CAPABILITY_TASKS: Array<{ key: CapabilityTask; label: string }> = [
  { key: "criativo_video", label: "Criativo de vídeo (ads, reels, VSL)" },
  { key: "criativo_imagem", label: "Criativo estático, thumbnail, card" },
  { key: "audio", label: "Áudio, trilha, efeitos sonoros" },
  { key: "pagina", label: "Página (advertorial, VSL, PDP, quiz)" },
  { key: "interface", label: "Interface do Império / apps" },
  { key: "dashboard", label: "Gráficos e dashboards" },
  { key: "automacao", label: "Render, captura e automação de arquivos" },
  { key: "icones", label: "Ícones" },
  { key: "ilustracao", label: "Ilustrações e personagens" },
  { key: "3d", label: "3D e efeitos WebGL" },
];

export type CapabilityPriority = "alta" | "media" | "baixa";

export interface Capability {
  id: string;
  nome: string;
  url: string | null;
  categoria: string;
  descricao: string | null;
  quando_usar: string | null;
  serve_para: string[];
  prioridade: CapabilityPriority;
  licenca_nota: string | null;
  /** Slugs de imphq_skills que usam esta ferramenta. */
  skills: string[];
  ativo: boolean;
}

const VIDEO_KINDS = new Set([
  "reels", "stories", "tiktok", "tiktok_ads", "youtube", "youtube_ads", "kwai", "live",
  "vsl", "webinar", "replay", "panda_video", "vturb",
]);
const AD_FAMILY_KINDS = new Set([
  "anuncio", "meta_ads", "google_ads", "native_ads", "facebook", "instagram", "linkedin",
  "twitter", "influenciador", "trafego_organico", "remarketing",
]);
const PAGE_KINDS = new Set([
  "advertorial", "agendar_reuniao", "area_membros", "blog", "captura", "checkout", "comunidade",
  "obrigado", "pagina_oto", "pagina_vendas", "quiz", "replay", "vsl", "webinar",
]);
const DASHBOARD_KINDS = new Set(["meta", "google_analytics", "utmify", "pixel_meta"]);
const AUTOMATION_KINDS = new Set(["ia", "processo", "n8n", "zapier"]);

/** Tarefas em que um tipo de etapa do mapa costuma precisar de ferramenta. Vazio = etapa sem produção de peça. */
export function tasksForKind(kind: string | null | undefined): CapabilityTask[] {
  const k = (kind || "").toLowerCase();
  const tasks = new Set<CapabilityTask>();
  if (VIDEO_KINDS.has(k)) tasks.add("criativo_video");
  if (AD_FAMILY_KINDS.has(k)) { tasks.add("criativo_imagem"); tasks.add("criativo_video"); }
  if (k === "imagem") tasks.add("criativo_imagem");
  if (PAGE_KINDS.has(k)) tasks.add("pagina");
  if (DASHBOARD_KINDS.has(k)) tasks.add("dashboard");
  if (AUTOMATION_KINDS.has(k)) tasks.add("automacao");
  return [...tasks];
}

const PRIORITY_RANK: Record<CapabilityPriority, number> = { alta: 0, media: 1, baixa: 2 };

/** Melhores capacidades ativas para as tarefas, da prioridade alta para a baixa (nome desempata). */
export function pickCapabilities(caps: ReadonlyArray<Capability>, tasks: ReadonlyArray<string>, limit = 4): Capability[] {
  if (!tasks.length) return [];
  const wanted = new Set(tasks);
  return caps
    .filter((c) => c.ativo && c.serve_para.some((t) => wanted.has(t)))
    .sort((a, b) => PRIORITY_RANK[a.prioridade] - PRIORITY_RANK[b.prioridade] || a.nome.localeCompare(b.nome))
    .slice(0, limit);
}

/** Ferramentas ativas que a skill usa (campo skills), da prioridade alta para a baixa. */
export function capabilitiesForSkill(caps: ReadonlyArray<Capability>, skill: string | null | undefined): Capability[] {
  const s = (skill || "").trim();
  if (!s || s === "none") return [];
  return caps
    .filter((c) => c.ativo && (c.skills || []).includes(s))
    .sort((a, b) => PRIORITY_RANK[a.prioridade] - PRIORITY_RANK[b.prioridade] || a.nome.localeCompare(b.nome));
}

/** Sugestões para uma etapa: primeiro as ligadas à skill dela, depois as do tipo da etapa, sem repetir. */
export function pickStepCapabilities(
  caps: ReadonlyArray<Capability>, kind: string | null | undefined, skill: string | null | undefined, limit = 4,
): Capability[] {
  const linked = capabilitiesForSkill(caps, skill);
  const seen = new Set(linked.map((c) => c.id));
  const byKind = pickCapabilities(caps, tasksForKind(kind), caps.length).filter((c) => !seen.has(c.id));
  return [...linked, ...byKind].slice(0, limit);
}
