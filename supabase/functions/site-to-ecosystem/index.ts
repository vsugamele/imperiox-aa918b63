// Orquestra: site -> projeto + avatar + produtos (principal/OB/upsell/lowticket) + VSL + criativos + LP + funil
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function gemini(system: string, user: string, jsonSchema?: any) {
  const body: any = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (jsonSchema) {
    body.response_format = { type: "json_schema", json_schema: { name: "out", strict: true, schema: jsonSchema } };
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
  if (jsonSchema) {
    try { return JSON.parse(content); } catch { return JSON.parse(content.replace(/```json|```/g, "").trim()); }
  }
  return content;
}

const ECOSYSTEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["avatar", "produtos", "vsl_roteiro", "criativos_imagem", "criativos_video", "lp_estrutura"],
  properties: {
    avatar: {
      type: "object", additionalProperties: false,
      required: ["nome", "dores", "desejos", "objecoes", "linguagem"],
      properties: {
        nome: { type: "string" },
        dores: { type: "array", items: { type: "string" } },
        desejos: { type: "array", items: { type: "string" } },
        objecoes: { type: "array", items: { type: "string" } },
        linguagem: { type: "string" },
      },
    },
    produtos: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["tipo", "nome", "promessa", "mecanismo", "preco_sugerido", "bullets"],
        properties: {
          tipo: { type: "string", enum: ["principal", "orderbump", "upsell", "lowticket"] },
          nome: { type: "string" },
          promessa: { type: "string" },
          mecanismo: { type: "string" },
          preco_sugerido: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
        },
      },
    },
    vsl_roteiro: {
      type: "object", additionalProperties: false,
      required: ["hook", "historia", "problema", "solucao", "mecanismo", "oferta", "cta"],
      properties: {
        hook: { type: "string" }, historia: { type: "string" }, problema: { type: "string" },
        solucao: { type: "string" }, mecanismo: { type: "string" }, oferta: { type: "string" }, cta: { type: "string" },
      },
    },
    criativos_imagem: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["angulo", "headline", "prompt_imagem"],
        properties: { angulo: { type: "string" }, headline: { type: "string" }, prompt_imagem: { type: "string" } },
      },
    },
    criativos_video: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["angulo", "hook", "roteiro"],
        properties: { angulo: { type: "string" }, hook: { type: "string" }, roteiro: { type: "string" } },
      },
    },
    lp_estrutura: { type: "string" },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { site_id, projeto_id, novo_projeto_nome, nicho, tom } = await req.json();
    if (!site_id) throw new Error("site_id obrigatório");
    if (!projeto_id && !novo_projeto_nome) throw new Error("projeto_id ou novo_projeto_nome obrigatório");

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const userJwt = authHeader.replace("Bearer ", "");
    const { data: userData } = await sb.auth.getUser(userJwt);
    const userId = userData?.user?.id;
    if (!userId) throw new Error("Não autenticado");

    // 1. Site
    const { data: site, error: siteErr } = await sb.from("imphq_sites").select("*").eq("id", site_id).maybeSingle();
    if (siteErr || !site) throw new Error("Site não encontrado");

    // 2. Projeto (cria se necessário)
    let projectId = projeto_id as string | undefined;
    if (!projectId) {
      const newId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const { error } = await sb.from("imphq_projects").insert({
        id: newId,
        name: novo_projeto_nome,
        user_id: userId,
        category: nicho || "Infoproduto",
        data: { nicho, briefing_origem: { site_id, site_url: site.url } },
        brand_kit: site.branding_json || {},
        active: true,
      });
      if (error) throw new Error(`Criar projeto: ${error.message}`);
      projectId = newId;
    }

    // 3. AI: gera o ecossistema completo em uma chamada
    const system = `Você é o Imperius, estrategista de copy e funis (pt-BR). Dado um site de referência, gere um ecossistema completo de produto pronto pra subir: avatar, escada de valor (principal + order bump + upsell + low ticket), VSL 7 blocos, 6 criativos imagem, 4 criativos vídeo e estrutura de LP. Linguagem direta, emocional, com mecanismo único. Tom: ${tom || "consultivo premium"}.`;
    const user = `## SITE DE REFERÊNCIA
URL: ${site.url}
Título: ${site.titulo}
Tipo: ${site.tipo}
Nicho: ${nicho || site.tags?.join(", ") || "auto-detectar"}
Resumo: ${site.summary || ""}

### Conteúdo extraído
${(site.content_md || "").slice(0, 6000)}

## TAREFA
Gere o JSON do ecossistema seguindo o schema. Importantes:
- 4 produtos: tipo principal (ticket alto), orderbump (complemento barato), upsell (premium pós-compra), lowticket (porta-de-entrada R$ 27-47).
- 6 criativos imagem com ângulos diferentes (dor, desejo, prova, mecanismo, autoridade, urgência).
- 4 criativos vídeo (Reels 30-60s) com hook forte nos primeiros 3s.
- LP em markdown com blocos: Headline, Sub, Bullets, Prova, Oferta, Garantia, CTA.`;

    const eco = await gemini(system, user, ECOSYSTEM_SCHEMA);

    // 4. Persiste
    // 4a. Projeto: avatar + produtos no data
    const { data: projCur } = await sb.from("imphq_projects").select("data, avatar").eq("id", projectId).maybeSingle();
    const curData = (projCur?.data as any) || {};
    const novosProdutos = (eco.produtos || []).map((p: any) => ({
      nome: p.nome,
      tipo: p.tipo,
      preco: p.preco_sugerido,
      promessa: p.promessa,
      mecanismo: p.mecanismo,
      bullets: p.bullets,
      status: "ativo",
      links: [],
      ofertas: [],
    }));
    await sb.from("imphq_projects").update({
      avatar: eco.avatar,
      data: { ...curData, produtos: [...(curData.produtos || []), ...novosProdutos], lp_estrutura: eco.lp_estrutura },
    }).eq("id", projectId);

    // 4b. Vincula site
    await sb.from("imphq_project_sites").upsert({
      site_id, projeto_id: projectId, papel: site.tipo === "vsl" ? "lp" : (site.tipo || "lp"), user_id: userId,
    }, { onConflict: "site_id,projeto_id" } as any).then(() => {}).catch(() => {});

    // 4c. VSL como swipe
    const vslText = `# Roteiro VSL\n\n## Hook\n${eco.vsl_roteiro.hook}\n\n## História\n${eco.vsl_roteiro.historia}\n\n## Problema\n${eco.vsl_roteiro.problema}\n\n## Solução\n${eco.vsl_roteiro.solucao}\n\n## Mecanismo\n${eco.vsl_roteiro.mecanismo}\n\n## Oferta\n${eco.vsl_roteiro.oferta}\n\n## CTA\n${eco.vsl_roteiro.cta}`;
    const { data: swipe } = await sb.from("imphq_swipes").insert({
      user_id: userId, project_id: projectId, title: `VSL — ${novosProdutos[0]?.nome || site.titulo}`,
      formato: "vsl", plataforma: "youtube", status: "rascunho",
      raw_text: vslText, media_type: "text", source_url: site.url,
    }).select("id").maybeSingle();

    // 4d. Criativos imagem + vídeo como creative_assets
    const allCreatives = [
      ...(eco.criativos_imagem || []).map((c: any) => ({
        user_id: userId, project_id: projectId, formato: "imagem",
        angulo: c.angulo, headline_copy: c.headline, prompt_usado: c.prompt_imagem,
        aprovado: false, metadata: { origem: "site-to-ecosystem", site_id },
      })),
      ...(eco.criativos_video || []).map((c: any) => ({
        user_id: userId, project_id: projectId, formato: "video_script",
        angulo: c.angulo, headline_copy: c.hook, prompt_usado: c.roteiro,
        aprovado: false, metadata: { origem: "site-to-ecosystem", site_id },
      })),
    ];
    let criativosIds: string[] = [];
    if (allCreatives.length > 0) {
      const { data } = await sb.from("imphq_creative_assets").insert(allCreatives).select("id");
      criativosIds = (data || []).map((r: any) => r.id);
    }

    // 4e. Monta funil chamando funnel-autobuild
    let funilId: string | null = null;
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/funnel-autobuild`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, mode: "apply" }),
      });
      const fj = await r.json().catch(() => ({}));
      funilId = fj?.funil_id || fj?.id || null;
    } catch (e) {
      console.error("[site-to-ecosystem] autobuild falhou", e);
    }

    return new Response(JSON.stringify({
      success: true,
      projeto_id: projectId,
      funil_id: funilId,
      swipe_vsl_id: swipe?.id,
      criativos_ids: criativosIds,
      produtos_criados: novosProdutos.length,
      avatar_nome: eco.avatar?.nome,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[site-to-ecosystem] error", e);
    return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
