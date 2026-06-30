// Helper para executar uma skill do imphq_skills via Lovable AI Gateway.
// Carrega o system_prompt da skill, monta o user message com contexto rico
// (avatar, branding, produto) e retorna o texto (ou JSON se schema for passado).

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

export interface SkillContext {
  produto_nome: string;
  ticket?: string;
  promessa?: string;
  avatar?: any;
  branding?: any;
  nicho?: string;
  extra?: string;
}

export async function loadSkillPrompt(supa: any, slug: string): Promise<string | null> {
  const { data } = await supa.from("imphq_skills").select("system_prompt").eq("slug", slug).maybeSingle();
  return data?.system_prompt || null;
}

function buildUserMessage(ctx: SkillContext, instruction: string): string {
  const lines: string[] = [];
  lines.push(`# PRODUTO\nNome: ${ctx.produto_nome}`);
  if (ctx.ticket) lines.push(`Ticket: ${ctx.ticket}`);
  if (ctx.promessa) lines.push(`Promessa: ${ctx.promessa}`);
  if (ctx.nicho) lines.push(`Nicho: ${ctx.nicho}`);
  if (ctx.avatar) {
    lines.push(`\n# AVATAR\n${typeof ctx.avatar === "string" ? ctx.avatar : JSON.stringify(ctx.avatar).slice(0, 2000)}`);
  }
  if (ctx.branding) {
    lines.push(`\n# BRANDING\n${typeof ctx.branding === "string" ? ctx.branding : JSON.stringify(ctx.branding).slice(0, 1000)}`);
  }
  if (ctx.extra) lines.push(`\n# CONTEXTO ADICIONAL\n${ctx.extra}`);
  lines.push(`\n# TAREFA\n${instruction}`);
  return lines.join("\n");
}

export async function runSkill(opts: {
  systemPrompt: string;
  ctx: SkillContext;
  instruction: string;
  model?: string;
  jsonSchema?: any;
  fallbackSystem?: string;
}): Promise<any> {
  const system = opts.systemPrompt || opts.fallbackSystem || "Você é o Imperius, estrategista de copy pt-BR.";
  const user = buildUserMessage(opts.ctx, opts.instruction);
  const body: any = {
    model: opts.model || "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (opts.jsonSchema) {
    body.response_format = { type: "json_schema", json_schema: { name: "out", strict: true, schema: opts.jsonSchema } };
  }
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`AI ${res.status}: ${txt.slice(0, 300)}`);
  const j = JSON.parse(txt);
  const content = j.choices?.[0]?.message?.content || "";
  if (opts.jsonSchema) {
    try { return JSON.parse(content); }
    catch { return JSON.parse(content.replace(/```json|```/g, "").trim()); }
  }
  return content;
}
