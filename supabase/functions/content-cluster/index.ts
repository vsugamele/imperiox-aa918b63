// Generates a content cluster from one source idea — produces 5 derived formats
// (legenda Instagram, copy de anúncio, story 3 frames, email curto, hook reels)
// All anchored to the same core idea, project context and avatar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FORMATS = [
  { role: "instagram_caption", label: "Legenda Instagram", brief: "Legenda completa para feed (gancho de 1ª linha forte, corpo storytelling, CTA, 3-5 hashtags)." },
  { role: "ad_copy", label: "Copy de Anúncio", brief: "Copy de anúncio Meta Ads: 1 headline (até 40 chars), 1 primary text (até 125 chars c/ gancho de dor) e 1 description." },
  { role: "story_frames", label: "Story 3 frames", brief: "3 frames numerados (Frame 1 — gancho visual + texto curto / Frame 2 — tensão ou prova / Frame 3 — CTA com sticker)." },
  { role: "email_short", label: "Email curto", brief: "Email curto (máx 120 palavras): assunto + 1ª linha de preview + corpo + 1 CTA único." },
  { role: "reels_hook", label: "Hook Reels (5)", brief: "5 variações de hook (3-5s) DIFERENTES entre si (pergunta, contradição, dado chocante, antes/depois, autoridade). Sem corpo, só os ganchos." },
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function generateOne(opts: {
  format: typeof FORMATS[number];
  sourceIdea: string;
  context: string;
}): Promise<string> {
  const sys = `Você é um copywriter sênior brasileiro. Gere conteúdo OBJETIVO, sem floreios, em português BR. Use a ideia central fornecida — NÃO mude o ângulo. Apenas REEMBALE no formato pedido.`;
  const user = `IDEIA CENTRAL (mantenha o ângulo intacto):\n${opts.sourceIdea}\n\nCONTEXTO DO PROJETO:\n${opts.context}\n\nFORMATO PEDIDO: ${opts.format.label}\nESPECIFICAÇÃO: ${opts.format.brief}\n\nResponda apenas com o conteúdo final, sem preâmbulo.`;

  // Retry once on 429/500/502/503/504 with 800ms backoff
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.choices?.[0]?.message?.content || "";
    }
    const retryable = [429, 500, 502, 503, 504].includes(res.status);
    if (!retryable || attempt === 1) {
      const txt = await res.text();
      throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
    }
    console.warn(`[content-cluster] ${opts.format.role} ${res.status} — retry em 800ms`);
    await sleep(800);
  }
  throw new Error("unreachable");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("missing auth");
    const supaUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await supaUser.auth.getUser();
    const user = userData?.user;
    if (!user) throw new Error("unauthorized");

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json();
    const projectId: string = body.project_id;
    const sourceContentId: string | null = body.source_content_id || null;
    const sourceIdea: string = body.source_idea || "";
    const funnelStage: string | null = body.funnel_stage || null;
    // Optional: regenerate only specific formats (retry path)
    const onlyRoles: string[] | null = Array.isArray(body.only_roles) && body.only_roles.length ? body.only_roles : null;
    const reuseClusterId: string | null = body.cluster_id || null;

    if (!projectId || !sourceIdea) throw new Error("project_id and source_idea required");

    const targetFormats = onlyRoles ? FORMATS.filter(f => onlyRoles.includes(f.role)) : FORMATS;
    if (!targetFormats.length) throw new Error("no valid formats requested");

    // Build minimal project context (briefing + avatar top points)
    const { data: project } = await supa.from("imphq_projects").select("name, data").eq("id", projectId).single();
    const pData: any = project?.data || {};
    const produto = pData.produtos?.[0] || {};
    const briefing = pData.briefing || {};
    const avatar = produto.avatar || pData.avatar || {};
    const dores = (avatar.dores || []).slice(0, 3).map((d: any) => typeof d === "string" ? d : d?.dor || d?.texto).filter(Boolean);
    const desejos = (avatar.desejos || []).slice(0, 3).map((d: any) => typeof d === "string" ? d : d?.desejo || d?.texto).filter(Boolean);

    const context = [
      `Projeto: ${project?.name}`,
      produto.nome ? `Produto: ${produto.nome}` : "",
      briefing.publico ? `Público: ${briefing.publico}` : "",
      dores.length ? `Top dores: ${dores.join(" | ")}` : "",
      desejos.length ? `Top desejos: ${desejos.join(" | ")}` : "",
      funnelStage ? `Estágio do funil: ${funnelStage}` : "",
    ].filter(Boolean).join("\n");

    const clusterId = reuseClusterId || crypto.randomUUID();

    // Generate all in parallel
    const results = await Promise.allSettled(
      targetFormats.map(f => generateOne({ format: f, sourceIdea, context }))
    );

    const failed_formats: { role: string; label: string; error: string }[] = [];
    const inserts = results.map((r, i) => {
      const fmt = targetFormats[i];
      const ok = r.status === "fulfilled";
      if (!ok) {
        failed_formats.push({ role: fmt.role, label: fmt.label, error: (r as any).reason?.message || "erro" });
      }
      const content = ok ? r.value : `❌ Falhou: ${(r as any).reason?.message || "erro"}`;
      return {
        project_id: projectId,
        user_id: user.id,
        content_type: fmt.role,
        content,
        product_name: project?.name || "",
        model_used: "google/gemini-3-flash-preview",
        status: ok ? "rascunho" : "erro",
        funnel_stage: funnelStage,
        cluster_id: clusterId,
        cluster_role: fmt.role,
        source_idea: sourceIdea,
        metadata: { source_content_id: sourceContentId, format_label: fmt.label, retry: !!onlyRoles },
      };
    });

    const { data: saved, error } = await supa.from("imphq_generated_contents").insert(inserts).select("id, content_type, content, cluster_id, cluster_role, status");
    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      cluster_id: clusterId,
      items: saved,
      failed_formats,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[content-cluster] error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
