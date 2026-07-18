// Geração de imagens dos nós do OpenFlow com contexto rico:
// branding do projeto + site de referência vinculado ao funil + imagem de referência opcional.
// Tipos: mockup_pagina | mensagem_autoridade | icone
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireUser } from "../_shared/require-auth.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Tipo = "mockup_pagina" | "mensagem_autoridade" | "icone";

const TEMPLATES: Record<Tipo, (ctx: string, extra: string) => string> = {
  mockup_pagina: (ctx, extra) =>
    `Gere um MOCKUP fotorrealista de uma página web (landing page / VSL / checkout) dentro de um navegador desktop.\n\nContexto da marca e produto:\n${ctx}\n\nInstruções específicas: ${extra || "siga 100% o branding acima"}.\n\nRequisitos: layout limpo, hierarquia clara (headline, sub, CTA), respeite paleta e tipografia do branding. Sem texto inventado em outro idioma — use português.`,
  mensagem_autoridade: (ctx, extra) =>
    `Gere uma imagem para enviar via WhatsApp a um lead, transmitindo AUTORIDADE, PROVA e BENEFÍCIO do produto.\n\nContexto:\n${ctx}\n\nInstruções: ${extra || "destaque resultado/transformação"}.\n\nRequisitos: formato vertical 4:5, estilo fotográfico premium, expressão de confiança, paleta alinhada ao branding, sem watermark, sem rosto de pessoa famosa.`,
  icone: (ctx, extra) =>
    `Gere um ÍCONE/ilustração minimalista representando o passo do funil.\n\nContexto:\n${ctx}\n\nInstruções: ${extra || "estilo flat, alto contraste"}.\n\nRequisitos: fundo transparente conceitual, paleta da marca, sem texto.`,
};

async function buildContext(supa: any, blueprint: any, projectId?: string): Promise<string> {
  const parts: string[] = [];

  if (projectId) {
    const { data: proj } = await supa.from("imphq_projects").select("data,name").eq("id", projectId).maybeSingle();
    const d = typeof proj?.data === "string" ? JSON.parse(proj.data) : (proj?.data || {});
    const b = d?.briefing || d || {};
    if (proj?.name) parts.push(`Produto: ${proj.name}`);
    const br = b?.branding || b?.identidade || {};
    if (br?.tom_de_voz || br?.tom) parts.push(`Tom de voz: ${br.tom_de_voz || br.tom}`);
    if (br?.paleta || br?.cores) parts.push(`Cores: ${JSON.stringify(br.paleta || br.cores).slice(0, 200)}`);
    if (br?.fonte || br?.tipografia) parts.push(`Tipografia: ${br.fonte || br.tipografia}`);
    if (br?.estilo) parts.push(`Estilo visual: ${br.estilo}`);
    const a = b?.avatar || {};
    if (a?.dores || b?.dores) parts.push(`Dor do avatar: ${JSON.stringify(a?.dores || b?.dores).slice(0, 200)}`);
    if (a?.desejos || b?.desejos) parts.push(`Desejo: ${JSON.stringify(a?.desejos || b?.desejos).slice(0, 200)}`);

    // Site de referência vinculado ao projeto/funil
    const { data: sites } = await supa.from("imphq_sites").select("data,url,title").eq("project_id", projectId).limit(2);
    if (sites?.length) {
      sites.forEach((s: any, i: number) => {
        const sd = typeof s.data === "string" ? JSON.parse(s.data) : (s.data || {});
        const ref: string[] = [`Site ref #${i + 1} (${s.url || s.title})`];
        if (sd?.palette || sd?.cores) ref.push(`paleta=${JSON.stringify(sd.palette || sd.cores).slice(0, 120)}`);
        if (sd?.fonts) ref.push(`fontes=${JSON.stringify(sd.fonts).slice(0, 80)}`);
        if (sd?.copy_principal) ref.push(`copy="${String(sd.copy_principal).slice(0, 150)}"`);
        parts.push(ref.join(" | "));
      });
    }
  }

  if (blueprint?.title) parts.push(`Funil: ${blueprint.title}`);
  return parts.join("\n").slice(0, 2000);
}

async function genWithGemini(prompt: string, refImageUrl?: string): Promise<Uint8Array> {
  const content: any[] = [{ type: "text", text: prompt }];
  if (refImageUrl) content.push({ type: "image_url", image_url: { url: refImageUrl } });

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });
  if (!resp.ok) throw new Error(`Gemini image fail: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  const url: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error("Sem imagem retornada");
  const m = url.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  const b64 = m?.[2] || url.split(",")[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;
  try {
    const { blueprint_id, block_id, tipo = "mockup_pagina", extra = "", reference_url } = await req.json();
    if (!blueprint_id || !block_id) {
      return new Response(JSON.stringify({ error: "blueprint_id e block_id obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: bp } = await supa.from("imphq_flow_blueprints").select("*").eq("id", blueprint_id).maybeSingle();
    if (!bp) throw new Error("Blueprint não encontrado");

    const ctx = await buildContext(supa, bp.blueprint, bp.project_id);
    const tpl = TEMPLATES[tipo as Tipo] || TEMPLATES.mockup_pagina;
    const prompt = tpl(ctx, extra);

    const bytes = await genWithGemini(prompt, reference_url);
    const path = `${blueprint_id}/${block_id}-${Date.now()}.png`;
    const { error: upErr } = await supa.storage.from("flow-media").upload(path, bytes, {
      contentType: "image/png", upsert: true,
    });
    if (upErr) throw upErr;
    const { data: signed } = await supa.storage.from("flow-media").createSignedUrl(path, 60 * 60 * 24 * 365);
    const image_url = signed?.signedUrl;

    // Atualiza blueprint inline
    const blueprint: any = bp.blueprint;
    blueprint.nodes = (blueprint.nodes || []).map((n: any) => ({
      ...n,
      blocks: (n.blocks || []).map((b: any) =>
        b.id === block_id ? { ...b, image_url, image_prompt: prompt.slice(0, 500), image_tipo: tipo } : b
      ),
    }));
    await supa.from("imphq_flow_blueprints").update({ blueprint }).eq("id", blueprint_id);

    // Registra na library para reaproveitar
    if (bp.project_id) {
      await supa.from("imphq_content_library").insert({
        project_id: bp.project_id,
        title: `Funil ${bp.title} – ${tipo}`,
        file_url: image_url,
        thumbnail_url: image_url,
        file_type: "image/png",
        tags: ["openflow", tipo, blueprint_id],
        size_bytes: bytes.byteLength,
      }).then(() => {}, () => {});
    }

    return new Response(JSON.stringify({ image_url, prompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("flow-image-context", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
