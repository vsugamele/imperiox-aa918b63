// Content Calendar AI — semanal, gera 7 ideias por projeto Vendendo
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { requireUserOrServiceRole } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function genIdeas(projeto: any, vendasResumo: string, avatar: string) {
  const sys = `Você é estrategista de conteúdo. Gere 7 ideias de posts para a semana (1/dia). Mix de formatos. Responda JSON: { "ideias": [{"dia": "Seg", "formato": "reel"|"carrossel"|"story", "titulo": "...", "hook": "...", "cta": "...", "prompt_studio": "prompt detalhado pra IA gerar copy completa"}] }`;
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Projeto: ${projeto.name}\nNicho: ${projeto.nicho || "—"}\nAvatar: ${avatar}\nVendas recentes: ${vendasResumo}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  try {
    return JSON.parse(data?.choices?.[0]?.message?.content || "{}");
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: projetos } = await supabase
      .from("imphq_projects")
      .select("id, name, status")
      .eq("status", "vendendo")
      .limit(20);

    let totalIdeas = 0;
    let projsProcessados = 0;

    for (const p of projetos || []) {
      const [{ data: vendas }, { data: avatarData }, { data: col }] = await Promise.all([
        supabase
          .from("imphq_vendas")
          .select("produto_nome, valor")
          .eq("project_id", p.id)
          .eq("status", "aprovada")
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .limit(50),
        supabase.from("imphq_avatars").select("data").eq("project_id", p.id).maybeSingle(),
        supabase.from("imphq_kanban_columns").select("id").eq("project_id", p.id).ilike("title", "%ideias%").maybeSingle(),
      ]);

      const vendasResumo = (vendas || []).length > 0
        ? `${vendas?.length} vendas, top: ${[...new Set((vendas || []).map((v: any) => v.produto_nome).filter(Boolean))].slice(0, 3).join(", ")}`
        : "Sem vendas recentes";
      const avatarStr = JSON.stringify(avatarData?.data || {}).slice(0, 500);

      const result = await genIdeas(p, vendasResumo, avatarStr);
      if (!result?.ideias) continue;

      let columnId = col?.id;
      if (!columnId) {
        const { data: newCol } = await supabase
          .from("imphq_kanban_columns")
          .insert({ project_id: p.id, title: "💡 Ideias IA", position: 0 })
          .select()
          .single();
        columnId = newCol?.id;
      }

      if (columnId) {
        for (const ideia of result.ideias) {
          await supabase.from("imphq_kanban_cards").insert({
            column_id: columnId,
            project_id: p.id,
            title: `${(ideia.formato || "").toUpperCase()} · ${ideia.titulo}`,
            description: `**Hook:** ${ideia.hook}\n\n**CTA:** ${ideia.cta}\n\n---\n**Prompt Studio:**\n${ideia.prompt_studio}`,
            tags: ["ia-gerado", ideia.formato, ideia.dia].filter(Boolean),
            ai_generated: true,
            metadata: { source: "content-calendar-ai", ideia },
          });
          totalIdeas++;
        }
      }
      projsProcessados++;
    }

    return new Response(
      JSON.stringify({ ok: true, projetos: projsProcessados, ideias: totalIdeas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("content-calendar-ai:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
