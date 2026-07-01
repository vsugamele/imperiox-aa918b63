// Sales Script Autopilot — orquestra geração completa de fluxo de venda:
// 1. flow-generator (blueprint base x1_vendas)
// 2. copy-engine breakthrough_techniques nos nodes-chave
// 3. copy-engine weaponized_credibility nos nodes de prova/pitch
// 4. flow-image-worker (imagens em fila — já automático no flow-generator)
// 5. cria imphq_flow_wa_triggers vinculando keywords + provider
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ReqBody {
  project_id: string;
  produto_nome?: string;
  produto_id?: string;
  tom?: string;
  apply_breakthrough?: boolean;
  apply_credibility?: boolean;
  provider_id?: string | null;
  keywords?: string[];
  pitch_link?: string;
}

const KEY_NODE_HINTS = ["hook", "abertura", "pitch", "oferta", "dor", "solu", "prova", "garantia"];

function nodeIsKey(node: any): boolean {
  const t = `${node?.title || ""} ${(node?.blocks || []).map((b: any) => b.text || "").join(" ")}`.toLowerCase();
  return KEY_NODE_HINTS.some((k) => t.includes(k));
}

function nodeIsProof(node: any): boolean {
  const t = `${node?.title || ""} ${(node?.blocks || []).map((b: any) => b.text || "").join(" ")}`.toLowerCase();
  return /prova|garantia|caso|depoimento|testem|result|pitch|oferta/.test(t);
}

function nodeTextDump(node: any): string {
  return (node?.blocks || [])
    .filter((b: any) => b.type === "text" || !b.type)
    .map((b: any) => b.text || "")
    .filter(Boolean)
    .join("\n\n");
}

function rewriteNodeText(node: any, newText: string): void {
  const blocks = node.blocks || [];
  const textBlocks = blocks.filter((b: any) => b.type === "text" || !b.type);
  if (!textBlocks.length) return;
  // Distribui parágrafos do newText entre os blocos existentes
  const parts = newText.split(/\n{2,}/).filter(Boolean);
  for (let i = 0; i < textBlocks.length; i++) {
    textBlocks[i].text = parts[i] || parts[parts.length - 1] || textBlocks[i].text;
  }
}

async function invokeCopyEngine(intent: string, copy: string, project_id: string, produto_nome?: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/copy-engine`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        intent,
        input: `COPY ORIGINAL A POTENCIALIZAR/BLINDAR:\n\n${copy}\n\nReescreva mantendo o sentido, formato curto para WhatsApp (1 ideia por mensagem, máx 3 parágrafos).`,
        context: { project_id, product_slug: produto_nome },
      }),
    });
    if (!res.ok) {
      console.error("[autopilot] copy-engine fail", intent, res.status);
      return null;
    }
    const data = await res.json();
    return data?.content || null;
  } catch (e) {
    console.error("[autopilot] copy-engine err", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as ReqBody;
    if (!body.project_id) {
      return new Response(JSON.stringify({ error: "project_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const log: Array<{ step: string; status: string; detail?: string }> = [];

    // 1. Gerar blueprint base
    log.push({ step: "blueprint", status: "running" });
    const genRes = await fetch(`${SUPABASE_URL}/functions/v1/flow-generator`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        project_id: body.project_id,
        produto_nome: body.produto_nome,
        produto_id: body.produto_id,
        objetivo: "x1_vendas",
        canal: "whatsapp",
        tom: body.tom || "Sugamele, consultivo, pt-BR",
      }),
    });
    if (!genRes.ok) {
      const txt = await genRes.text();
      return new Response(JSON.stringify({ error: "flow-generator falhou", detail: txt }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const gen = await genRes.json();
    const blueprint_id: string = gen.blueprint_id;
    log.push({ step: "blueprint", status: "ok", detail: `${gen.image_jobs || 0} imagens em fila` });

    // 2. Buscar blueprint para enriquecer
    const { data: bpRow } = await sb
      .from("imphq_flow_blueprints")
      .select("blueprint")
      .eq("id", blueprint_id)
      .single();
    const blueprint: any = bpRow?.blueprint || {};
    blueprint.meta = blueprint.meta || {};
    blueprint.meta.skill_log = blueprint.meta.skill_log || [];

    // 3. Aplicar skills aos nodes-chave
    const nodes: any[] = blueprint.nodes || [];
    for (const node of nodes) {
      const original = nodeTextDump(node);
      if (!original || original.length < 30) continue;

      if (body.apply_breakthrough !== false && nodeIsKey(node)) {
        const out = await invokeCopyEngine("breakthrough_techniques", original, body.project_id, body.produto_nome);
        if (out) {
          rewriteNodeText(node, out);
          blueprint.meta.skill_log.push({
            node_id: node.id, skill: "breakthrough_techniques",
            label: "7 Manobras de Schwartz",
            before: original.slice(0, 200), after: out.slice(0, 200),
          });
        }
      }

      if (body.apply_credibility !== false && nodeIsProof(node)) {
        const refresh = nodeTextDump(node);
        const out = await invokeCopyEngine("weaponized_credibility", refresh, body.project_id, body.produto_nome);
        if (out) {
          rewriteNodeText(node, out);
          blueprint.meta.skill_log.push({
            node_id: node.id, skill: "weaponized_credibility",
            label: "Blindagem de Provas (Bencivenga)",
            before: refresh.slice(0, 200), after: out.slice(0, 200),
          });
        }
      }
    }

    // 4. Atrelar canal WhatsApp no metadata
    blueprint.meta.wa = {
      provider_id: body.provider_id || null,
      keywords: body.keywords || [],
      pitch_link: body.pitch_link || null,
    };

    // 5. Salvar blueprint enriquecido
    await sb.from("imphq_flow_blueprints")
      .update({ blueprint })
      .eq("id", blueprint_id);
    log.push({ step: "skills", status: "ok", detail: `${blueprint.meta.skill_log.length} aplicações` });

    // 6. Criar trigger WA (se houver keywords)
    let trigger_id: string | null = null;
    if ((body.keywords?.length || 0) > 0) {
      const { data: trig } = await sb
        .from("imphq_flow_wa_triggers")
        .insert({
          project_id: body.project_id,
          produto_id: body.produto_id || null,
          produto_nome: body.produto_nome || null,
          blueprint_id,
          provider_id: body.provider_id || null,
          keywords: body.keywords,
          pitch_link: body.pitch_link || null,
        })
        .select("id").single();
      trigger_id = trig?.id || null;
      log.push({ step: "wa_trigger", status: "ok", detail: `${body.keywords?.length} keywords` });
    }

    return new Response(JSON.stringify({
      blueprint_id,
      trigger_id,
      image_jobs: gen.image_jobs || 0,
      skill_count: blueprint.meta.skill_log.length,
      log,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[sales-script-autopilot] error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
