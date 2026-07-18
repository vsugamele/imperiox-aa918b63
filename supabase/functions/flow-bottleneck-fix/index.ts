// flow-bottleneck-fix: identifica nó com pior conversão e gera correção via Lovable AI Gateway
// usando frameworks Schwartz/Bencivenga/Filemon-E3. Cria sugestão como variante B testável.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireUser } from "../_shared/require-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;
  try {
    const { blueprint_id, framework = "schwartz", create_variant = true } = await req.json();
    if (!blueprint_id) throw new Error("blueprint_id obrigatório");

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: bp } = await supa
      .from("imphq_flow_blueprints")
      .select("id, title, blueprint, project_id")
      .eq("id", blueprint_id)
      .maybeSingle();
    if (!bp) throw new Error("Blueprint não encontrado");

    const { data: stats } = await supa
      .from("imphq_flow_node_stats")
      .select("node_id, entered, completed, dropped, active")
      .eq("blueprint_id", blueprint_id);

    if (!stats?.length) {
      return new Response(JSON.stringify({ error: "Sem dados de execução ainda" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pior nó: maior drop_rate com volume mínimo
    const candidates = stats
      .filter((s: any) => (s.entered || 0) >= 10)
      .map((s: any) => ({
        ...s,
        drop_rate: s.entered > 0 ? s.dropped / s.entered : 0,
        conv_rate: s.entered > 0 ? s.completed / s.entered : 0,
      }))
      .sort((a, b) => b.drop_rate - a.drop_rate);

    if (!candidates.length) {
      return new Response(JSON.stringify({ error: "Volume insuficiente (mín 10/nó)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const worst = candidates[0];

    // Achar texto original do nó
    let originalCopy = "";
    let blockId = "";
    const nodes = (bp.blueprint as any)?.nodes || [];
    for (const n of nodes) {
      if (n.id === worst.node_id) {
        for (const blk of (n.blocks || [])) {
          if (typeof blk.content === "string" && blk.content.length > 5) {
            originalCopy = blk.content; blockId = blk.id; break;
          }
        }
      }
    }

    const frameworks: Record<string, string> = {
      schwartz: "Eugene Schwartz — Breakthrough Advertising. Use 1 das 7 manobras: graficar promessa, escada de credibilidade, mecanismo único, reframe de produto, presupposição de necessidade, especificação obsessiva, ou prova viva.",
      bencivenga: "Gary Bencivenga — Blindar provas. Adicione 2-3 provas concretas (números, depoimentos, dados), antecipe a objeção principal e neutralize.",
      filemon: "Filemon Brasil VSL E3 — reescreva no formato Empatia-Escola-Escada: 1 frase de dor reconhecida, 1 contradição que abre curiosidade, 1 micro-passo concreto que prova autoridade.",
    };

    const sysPrompt = `Você é o Imperador da Copy. Reescreva o texto abaixo para corrigir um gargalo de conversão (${(worst.drop_rate*100).toFixed(0)}% de abandono).\n\nFRAMEWORK: ${frameworks[framework] || frameworks.schwartz}\n\nResponda APENAS com a nova copy, sem aspas, sem explicação.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: `TEXTO ORIGINAL:\n${originalCopy || "(nó sem copy explícita — gere de zero baseado no contexto do funil: " + bp.title + ")"}` },
        ],
      }),
    });
    if (!aiRes.ok) throw new Error(`AI ${aiRes.status}: ${await aiRes.text()}`);
    const aiData = await aiRes.json();
    const newCopy = aiData?.choices?.[0]?.message?.content?.trim() || "";

    let variant_id: string | null = null;
    if (create_variant && newCopy) {
      // Garante A (original) + B (nova)
      const { data: existing } = await supa
        .from("imphq_flow_node_variants")
        .select("id, variant_key")
        .eq("blueprint_id", blueprint_id)
        .eq("node_id", worst.node_id);
      const hasA = existing?.some((v: any) => v.variant_key === "A");
      if (!hasA && originalCopy) {
        await supa.from("imphq_flow_node_variants").insert({
          blueprint_id, node_id: worst.node_id, block_id: blockId,
          variant_key: "A", copy: originalCopy, weight: 50, status: "testing",
        });
      }
      const nextKey = existing?.length ? String.fromCharCode(65 + (existing?.length || 0)) : "B";
      const { data: ins } = await supa.from("imphq_flow_node_variants").insert({
        blueprint_id, node_id: worst.node_id, block_id: blockId,
        variant_key: nextKey, copy: newCopy, weight: 50, status: "testing",
      }).select("id").single();
      variant_id = ins?.id || null;
    }

    return new Response(JSON.stringify({
      ok: true,
      bottleneck: worst,
      original: originalCopy,
      suggestion: newCopy,
      framework,
      variant_id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
