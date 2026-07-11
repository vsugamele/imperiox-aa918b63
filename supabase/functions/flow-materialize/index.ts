// Materialize a Funil FlowBlueprint into an OpenFlow imphq_automacoes row.
// Converts text/image/wait blocks into acoes[] compatible with the executor.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { blueprint_id } = await req.json();
    if (!blueprint_id) throw new Error("blueprint_id required");
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: bp, error: bpErr } = await supa
      .from("imphq_flow_blueprints")
      .select("id, title, project_id, produto_nome, blueprint, linked_automacao_id")
      .eq("id", blueprint_id)
      .maybeSingle();
    if (bpErr) throw bpErr;
    if (!bp) throw new Error("blueprint not found");

    const nodes = (bp.blueprint as any)?.nodes || [];
    const acoes: any[] = [];
    for (const node of nodes) {
      for (const block of (node.blocks || [])) {
        if (block.type === "text" || block.type === "ai_prompt") {
          acoes.push({ tipo: "enviar_mensagem", texto: block.content || block.prompt || "" });
        } else if (block.type === "image") {
          acoes.push({ tipo: "enviar_midia", tipo_midia: "image", url: block.image_url || "", legenda: block.caption || "" });
        } else if (block.type === "video") {
          acoes.push({ tipo: "enviar_midia", tipo_midia: "video", url: block.video_url || "" });
        } else if (block.type === "wait") {
          acoes.push({ tipo: "aguardar", minutos: block.wait_minutes || block.minutes || 5 });
        } else if (block.type === "condition") {
          acoes.push({ tipo: "condicao", campo: block.field || "tag", valor: block.value || "" });
        }
      }
    }

    if (acoes.length === 0) throw new Error("Nenhum bloco compatível encontrado (texto/imagem/vídeo/espera).");

    const nome = `[Funil] ${bp.title || bp.produto_nome || "Blueprint"}`;
    let automacaoId = bp.linked_automacao_id;

    if (automacaoId) {
      const { error } = await supa
        .from("imphq_automacoes")
        .update({ nome, acoes, updated_at: new Date().toISOString() })
        .eq("id", automacaoId);
      if (error) throw error;
    } else {
      automacaoId = crypto.randomUUID();
      const { error } = await supa.from("imphq_automacoes").insert({
        id: automacaoId,
        project_id: bp.project_id,
        nome,
        trigger_tipo: "manual",
        acoes,
        ativo: false,
        produto: bp.produto_nome,
        linked_blueprint_id: bp.id,
      });
      if (error) throw error;
      await supa.from("imphq_flow_blueprints").update({ linked_automacao_id: automacaoId }).eq("id", blueprint_id);
    }

    return new Response(JSON.stringify({ ok: true, automacao_id: automacaoId, steps: acoes.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
