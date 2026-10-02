// Regras da esteira de conteúdo (Story OP1.2). TS puro e sem dependências: usado pelas edge functions,
// pela CLI e testável no vitest. Contrato do GeeLark conferido na doc oficial (github.com/GeeLark/geelark-openapi) em 02/10/2026.

export type SocialPlatform = "tiktok" | "instagram" | "facebook" | "youtube";
export type PostStatus = "agendado" | "enviando" | "publicando" | "publicado" | "falhou" | "cancelado";
export type AccountStatus = "aquecendo" | "ativo" | "pausado" | "bloqueado";

/** Regra anti-loop do projeto: no máximo 3 tentativas por postagem, depois para. */
export const MAX_POST_ATTEMPTS = 3;

export interface DispatchCandidate {
  post: { status: string; attempts: number; scheduled_at: string };
  content: { status: string; media_url: string | null };
  account: { status: string; provider: string; geelark_env_id: string | null };
}

/** Por que a postagem não pode sair agora (null = pode). Só peça aprovada, em conta ativa do GeeLark, dentro das tentativas. */
export function dispatchBlocker(c: DispatchCandidate, now: Date = new Date()): string | null {
  if (c.post.status !== "agendado") return `postagem em "${c.post.status}"`;
  if (c.post.attempts >= MAX_POST_ATTEMPTS) return `${MAX_POST_ATTEMPTS} tentativas esgotadas`;
  if (new Date(c.post.scheduled_at).getTime() > now.getTime()) return "ainda não chegou a hora";
  if (c.content.status !== "aprovado") return `peça em "${c.content.status}" (só sai aprovada)`;
  if (!c.content.media_url) return "peça sem vídeo";
  if (c.account.provider !== "geelark") return `conta via ${c.account.provider}, não GeeLark`;
  if (!c.account.geelark_env_id) return "conta sem aparelho do GeeLark";
  if (c.account.status !== "ativo") return `conta em "${c.account.status}"`;
  return null;
}

/** Link da conta com UTM por postagem: a venda volta para o vídeo que trouxe o clique. */
export function utmLink(linkUrl: string, p: { platform: string; handle: string; postId: string }): string {
  const url = new URL(linkUrl);
  url.searchParams.set("utm_source", p.platform);
  url.searchParams.set("utm_medium", "organic");
  url.searchParams.set("utm_campaign", p.handle.replace(/^@/, ""));
  url.searchParams.set("utm_content", p.postId.slice(0, 8));
  return url.toString();
}

// ── GeeLark ─────────────────────────────────────────────────────────────

export interface GeelarkRequest { path: string; body: Record<string, unknown> }

/** Pedido de postagem por plataforma. `videoUrl` é a resourceUrl devolvida pelo upload temporário do GeeLark. */
export function geelarkPublishRequest(p: {
  platform: SocialPlatform;
  envId: string;
  videoUrl: string;
  caption: string;
  title?: string | null;
  scheduleAt: Date;
  page?: string | null;
  label?: string;
}): GeelarkRequest {
  const scheduleAt = Math.floor(p.scheduleAt.getTime() / 1000);
  const name = (p.label || "imperio").slice(0, 128);
  switch (p.platform) {
    case "tiktok":
      // Retentativas ficam com o Império (MAX_POST_ATTEMPTS): o GeeLark não repete sozinho.
      return { path: "/open/v1/task/add", body: { planName: name, taskType: 1, list: [{ scheduleAt, envId: p.envId, video: p.videoUrl, videoDesc: p.caption.slice(0, 4000), maxTryTimes: 0, needShareLink: true }] } };
    case "instagram":
      return { path: "/open/v1/rpa/task/instagramPubReels", body: { name, scheduleAt, id: p.envId, description: p.caption.slice(0, 2200), video: [p.videoUrl], needShareLink: true } };
    case "facebook":
      return { path: "/open/v1/rpa/task/faceBookPubReels", body: { name, scheduleAt, id: p.envId, description: p.caption.slice(0, 500), video: p.videoUrl, ...(p.page ? { page: p.page } : {}) } };
    case "youtube":
      return { path: "/open/v1/rpa/task/youtubePubShort", body: { name, scheduleAt, id: p.envId, title: (p.title || p.caption).slice(0, 100), video: p.videoUrl, sameStyleVoice: 0, originalVoice: 100 } };
  }
}

/** ID da tarefa criada: TikTok devolve `taskIds[]`, as tarefas RPA devolvem `taskId`. */
export function geelarkTaskId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { taskId?: unknown; taskIds?: unknown };
  if (typeof d.taskId === "string" && d.taskId) return d.taskId;
  if (Array.isArray(d.taskIds) && typeof d.taskIds[0] === "string") return d.taskIds[0];
  return null;
}

/** Falhas que indicam problema na conta, não na postagem: não adianta tentar de novo. */
const ACCOUNT_BLOCKED_CODES = new Set([20136, 20137]);
const ACCOUNT_LOGGED_OUT_CODES = new Set([20115, 20116, 20128, 20130, 20144]);

export interface TaskOutcome {
  postStatus: PostStatus;
  /** Nova situação da conta, quando a falha é da conta. */
  accountStatus?: AccountStatus;
  retry: boolean;
  error?: string;
}

/** Traduz o status da tarefa do GeeLark (1 esperando, 2 rodando, 3 concluída, 4 falhou, 7 cancelada). */
export function geelarkTaskOutcome(task: { status: number; failCode?: number | null; failDesc?: string | null }, attempts: number): TaskOutcome {
  switch (task.status) {
    case 1:
    case 2:
      return { postStatus: "publicando", retry: false };
    case 3:
      return { postStatus: "publicado", retry: false };
    case 7:
      return { postStatus: "cancelado", retry: false, error: "Tarefa cancelada no GeeLark" };
    case 4: {
      const code = task.failCode ?? 0;
      const error = `GeeLark ${code}: ${task.failDesc || "falha sem descrição"}`;
      if (ACCOUNT_BLOCKED_CODES.has(code)) return { postStatus: "falhou", accountStatus: "bloqueado", retry: false, error };
      if (ACCOUNT_LOGGED_OUT_CODES.has(code)) return { postStatus: "falhou", accountStatus: "pausado", retry: false, error };
      return { postStatus: attempts < MAX_POST_ATTEMPTS ? "agendado" : "falhou", retry: attempts < MAX_POST_ATTEMPTS, error };
    }
    default:
      return { postStatus: "publicando", retry: false, error: `Status desconhecido do GeeLark: ${task.status}` };
  }
}

/** Distribui as peças pelas contas respeitando o limite diário de cada uma, a partir de `start`, com intervalo entre posts da mesma conta. */
export function planPosts(
  contentIds: ReadonlyArray<string>,
  accounts: ReadonlyArray<{ id: string; daily_post_limit: number; taken: ReadonlyArray<string> }>,
  start: Date,
  gapMinutes = 180,
): Array<{ contentId: string; accountId: string; scheduledAt: Date }> {
  const out: Array<{ contentId: string; accountId: string; scheduledAt: Date }> = [];
  const usable = accounts.filter((a) => a.daily_post_limit > 0);
  if (!usable.length) return out;
  const perDay = new Map<string, number>();
  for (const contentId of contentIds) {
    for (const acc of usable) {
      if (acc.taken.includes(contentId)) continue;
      let day = 0;
      while ((perDay.get(`${acc.id}:${day}`) ?? 0) >= acc.daily_post_limit) day++;
      const slot = perDay.get(`${acc.id}:${day}`) ?? 0;
      perDay.set(`${acc.id}:${day}`, slot + 1);
      out.push({ contentId, accountId: acc.id, scheduledAt: new Date(start.getTime() + day * 86_400_000 + slot * gapMinutes * 60_000) });
    }
  }
  return out;
}
