// Dissecador de Referências (REF3.1): pede ao Gemini (vídeo) a dissecação completa de um anúncio em vídeo, no mesmo
// formato das 105 análises trazidas do Centro (analise.transcript / anatomy / editorial / angle_* / replication_prompt),
// mais o dossiê da copy (gancho, mecanismo, vilão, promessa, CTA) e as cenas-chave que viram quadros do storyboard.
// TS puro: monta o pedido e valida a resposta. A chamada HTTP fica na função ref-dissect.

export const DISSECT_MODEL = "google/gemini-2.5-flash";
export const MAX_DISSECT_BYTES = 20 * 1024 * 1024;
export const MAX_DISSECT_TENTATIVAS = 3;

const BLOCK_KINDS = ["hook", "problem", "agitation", "mechanism", "body", "bridge", "proof", "demonstration", "offer", "reason_why", "cta"] as const;
const AWARENESS = ["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"] as const;

export interface DissectSegment { start: number; end: number; text: string }
export interface DissectBlock { kind: string; start: number; end: number; label: string; purpose: string }
export interface DissectCena { seconds: number; descricao: string }
export interface Dissecacao {
  duracao: number | null;
  transcript: DissectSegment[];
  anatomy: { intent: string | null; cta_mode: string | null; blocks: DissectBlock[] };
  editorial: Record<string, string | null>;
  copy: { gancho: string | null; mecanismo: string | null; vilao: string | null; promessa: string | null; cta: string | null; prova: string | null };
  awareness_level: string | null;
  angle_family: string | null;
  angle_lens: string | null;
  belief_shift: { from: string; to: string } | null;
  quality_score: number | null;
  replication_prompt: string | null;
  criador: string | null;
  cenas: DissectCena[];
}

export function dissectMessages(dataUrl: string, mode: "video_url" | "image_url" = "video_url", contexto?: { titulo?: string | null; transcricao?: string | null }) {
  const media = mode === "video_url" ? { type: "video_url", video_url: { url: dataUrl } } : { type: "image_url", image_url: { url: dataUrl } };
  const hint = [
    contexto?.titulo ? `Title in our library: ${contexto.titulo}` : "",
    contexto?.transcricao ? `A previous plain transcript (may be imperfect, use the video as the source of truth): ${String(contexto.transcricao).slice(0, 4000)}` : "",
  ].filter(Boolean).join("\n");
  const schema = `{
"duracao": total seconds (number),
"transcript": [{"start": s, "end": s, "text": spoken words verbatim in the ORIGINAL language}] (segments of 3-10 s covering all speech; [] if no speech),
"anatomy": {"intent": 1 sentence in Portuguese, "cta_mode": "direto" | "suave" | "loop" | "sem_cta", "blocks": [{"kind": one of ${JSON.stringify(BLOCK_KINDS)}, "start": s, "end": s, "label": short name in Portuguese, "purpose": 1-2 sentences in Portuguese explaining WHY this block works}]},
"copy": {"gancho": exact hook (first 3 s, words or visual), "mecanismo": the mechanism/why it works as the ad frames it, "vilao": the enemy/villain blamed (or null), "promessa": main promise, "cta": call to action as said/shown, "prova": main proof used (or null)} — keep quotes in the original language, explanations in Portuguese,
"editorial": {"topic", "format" (e.g. "UGC Talking-head", "Narrativa b-roll", "Podcast cut"), "primaryNiche", "audienceHypothesis", "copyOperation" (what the copy does to the viewer's belief), "payoff", "ctaObserved", "critique" (weak points), "transfer" (how to reuse this structure for another product)} — all in Portuguese,
"awareness_level": one of ${JSON.stringify(AWARENESS)},
"angle_family": short Portuguese name of the angle, "angle_lens": the lens/perspective used,
"belief_shift": {"from": belief before, "to": belief after} in Portuguese,
"quality_score": 0-10 (how well it is built for direct response),
"replication_prompt": Portuguese instructions to record a new video with the same structure for another product (5-8 sentences),
"criador": creator/brand name if visible, else null,
"cenas": 8-12 key visual moments [{"seconds": s, "descricao": Portuguese, what is on screen}] spread across the video, always including 0-1 s and the CTA
}`;
  return [
    { role: "system", content: "You are a senior direct-response creative strategist who dissects video ads frame by frame. Answer ONLY with a JSON object, no markdown." },
    { role: "user", content: [{ type: "text", text: `Dissect this video ad. Return exactly this JSON shape:\n${schema}\n${hint}` }, media] },
  ];
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };

/** Lê e normaliza a resposta do modelo. Null se faltar o essencial (anatomia com blocos ou cenas). */
export function parseDissecacao(raw: string): Dissecacao | null {
  const m = String(raw ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let d: Record<string, unknown>;
  try { d = JSON.parse(m[0]); } catch { return null; }
  const duracao = num(d.duracao);
  const clampT = (t: number | null) => (t === null ? 0 : duracao ? Math.min(t, duracao) : t);
  const transcript = (Array.isArray(d.transcript) ? d.transcript : [])
    .map((s) => ({ start: clampT(num(obj(s).start)), end: clampT(num(obj(s).end)), text: str(obj(s).text) ?? "" }))
    .filter((s) => s.text);
  const an = obj(d.anatomy);
  const blocks = (Array.isArray(an.blocks) ? an.blocks : [])
    .map((b) => ({ kind: str(obj(b).kind) ?? "body", start: clampT(num(obj(b).start)), end: clampT(num(obj(b).end)), label: str(obj(b).label) ?? "", purpose: str(obj(b).purpose) ?? "" }))
    .filter((b) => b.label || b.purpose);
  const cenas = (Array.isArray(d.cenas) ? d.cenas : [])
    .map((c) => ({ seconds: clampT(num(obj(c).seconds)), descricao: str(obj(c).descricao) ?? "" }))
    .sort((a, b) => a.seconds - b.seconds)
    .filter((c, i, arr) => i === 0 || c.seconds - arr[i - 1].seconds >= 0.4)
    .slice(0, 14);
  if (!blocks.length || !cenas.length) return null;
  const ed = obj(d.editorial);
  const editorial: Record<string, string | null> = {};
  for (const k of ["topic", "format", "primaryNiche", "audienceHypothesis", "copyOperation", "payoff", "ctaObserved", "critique", "transfer"]) editorial[k] = str(ed[k]);
  const cp = obj(d.copy);
  const bs = obj(d.belief_shift);
  const q = num(d.quality_score);
  return {
    duracao,
    transcript,
    anatomy: { intent: str(an.intent), cta_mode: str(an.cta_mode), blocks },
    editorial,
    copy: { gancho: str(cp.gancho), mecanismo: str(cp.mecanismo), vilao: str(cp.vilao), promessa: str(cp.promessa), cta: str(cp.cta), prova: str(cp.prova) },
    awareness_level: AWARENESS.includes(str(d.awareness_level) as typeof AWARENESS[number]) ? str(d.awareness_level) : null,
    angle_family: str(d.angle_family),
    angle_lens: str(d.angle_lens),
    belief_shift: str(bs.from) && str(bs.to) ? { from: str(bs.from)!, to: str(bs.to)! } : null,
    quality_score: q === null ? null : Math.min(10, q),
    replication_prompt: str(d.replication_prompt),
    criador: str(d.criador),
    cenas,
  };
}

/** bucket + caminho de um link do nosso Storage (público ou assinado). */
export function storageObject(url: string | null | undefined): { bucket: string; path: string } | null {
  const m = String(url ?? "").match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/?]+)\/([^?]+)/);
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
}
