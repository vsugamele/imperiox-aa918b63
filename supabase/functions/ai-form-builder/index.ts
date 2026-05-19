import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { briefing, project_id, product_name, form_type, optimize_form_id } = await req.json();
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Modo OTIMIZAR: precisa de form_id, briefing fica opcional
    let optimizeCtx = "";
    let resolvedProjectId = project_id || null;
    if (optimize_form_id) {
      const { data: form } = await sb.from("imphq_capture_forms").select("*").eq("id", optimize_form_id).maybeSingle();
      if (form) {
        resolvedProjectId = resolvedProjectId || form.project_id;
        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: resps } = await sb.from("imphq_lead_responses")
          .select("field_key,answer").eq("form_id", optimize_form_id).gte("created_at", since).limit(2000);
        const stats: Record<string, { total: number; empty: number }> = {};
        (resps || []).forEach((r: any) => {
          stats[r.field_key] = stats[r.field_key] || { total: 0, empty: 0 };
          stats[r.field_key].total++;
          if (!r.answer || r.answer.trim() === "") stats[r.field_key].empty++;
        });
        optimizeCtx = `MODO OTIMIZAR — formulário atual: ${form.nome}\n` +
          `CAMPOS ATUAIS: ${JSON.stringify(form.fields)}\n` +
          `ESTATÍSTICAS 30d (${(resps || []).length} respostas): ${JSON.stringify(stats)}\n` +
          `OBJETIVO: reduzir campos fracos (alto % vazio), reescrever labels confusos, manter as perguntas que mais qualificam. NÃO mude o form_type.\n`;
      }
    }

    if (!briefing && !optimize_form_id) {
      return new Response(JSON.stringify({ error: "briefing ou optimize_form_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega contexto do projeto (avatar, produtos, branding) + formulários anteriores
    let contexto = "";
    if (resolvedProjectId) {
      const { data: proj } = await sb.from("imphq_projects").select("name, data").eq("id", resolvedProjectId).maybeSingle();
      if (proj) {
        const d: any = proj.data || {};
        contexto = `PROJETO: ${proj.name}\n`;
        if (d.avatar) contexto += `AVATAR (resumo): ${JSON.stringify(d.avatar).slice(0, 1500)}\n`;
        if (d.produtos) contexto += `PRODUTOS: ${JSON.stringify(d.produtos).slice(0, 800)}\n`;
        if (d.branding?.tom) contexto += `TOM DE VOZ: ${d.branding.tom}\n`;
      }
      const { data: priorForms } = await sb.from("imphq_capture_forms")
        .select("nome,settings,fields").eq("project_id", resolvedProjectId).limit(8);
      if (priorForms?.length) {
        const resumo = priorForms.map((f: any) => `- ${f.nome} [${(f.settings || {}).form_type || "?"}]: ${(f.fields || []).map((x: any) => x.label).join(", ")}`).join("\n");
        contexto += `FORMULÁRIOS JÁ EXISTENTES NO PROJETO (evite duplicar perguntas):\n${resumo}\n`;
      }
    }
    if (product_name) contexto += `PRODUTO ALVO: ${product_name}\n`;
    if (optimizeCtx) contexto += `\n${optimizeCtx}`;

    const sys = `Você é Imperius, estrategista de captura. Receba um briefing e gere um formulário OTIMIZADO em pt-BR.

REGRAS:
- captura simples (lead magnet/topo): MÁXIMO 3 campos (nome, email, whatsapp)
- vendas (checkout/oferta): 3-5 campos enxutos
- pesquisa: 5-10 perguntas qualificadoras usando o avatar
- aplicacao (mentoria/high-ticket): 5-8 perguntas de qualificação dura (faturamento, nicho, objetivo)
- pos_compra: NPS + depoimento + como conheceu
- Use o AVATAR do projeto para perguntas inteligentes quando for pesquisa/aplicacao
- form_type DEVE ser: 'captura' | 'vendas' | 'pesquisa' | 'aplicacao' | 'pos_compra' | 'lead_magnet'
- stage DEVE ser: 'lead_capturado' | 'pre_lancamento' | 'webinar' | 'aplicacao' | 'pesquisa'
- field.type: text | email | tel | select | textarea | number | radio | checkbox
- field.key: snake_case sem acento
- campaign_name: nome curto e datado se o briefing indicar (ex: "Webinar Cortes — Abril 2026")`;

    const tools = [{
      type: "function",
      function: {
        name: "criar_formulario",
        description: "Retorna estrutura completa do formulário",
        parameters: {
          type: "object",
          properties: {
            nome: { type: "string" },
            form_type: { type: "string", enum: ["captura", "vendas", "pesquisa", "aplicacao", "pos_compra", "lead_magnet"] },
            campaign_name: { type: "string" },
            stage: { type: "string", enum: ["lead_capturado", "pre_lancamento", "webinar", "aplicacao", "pesquisa"] },
            description: { type: "string" },
            tag: { type: "string" },
            fields: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  label: { type: "string" },
                  type: { type: "string", enum: ["text", "email", "tel", "select", "textarea", "number", "radio", "checkbox"] },
                  required: { type: "boolean" },
                  placeholder: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                },
                required: ["key", "label", "type", "required"],
              },
            },
          },
          required: ["nome", "form_type", "campaign_name", "stage", "description", "fields"],
        },
      },
    }];

    const userMsg = `${contexto ? contexto + "\n---\n" : ""}${briefing ? `BRIEFING: ${briefing}` : "Otimize o formulário acima com base nas estatísticas."}${form_type ? `\nTIPO SUGERIDO: ${form_type}` : ""}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
        tools,
        tool_choice: { type: "function", function: { name: "criar_formulario" } },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições. Tente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos em Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI Gateway ${resp.status}: ${txt}`);
    }

    const data = await resp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("IA não retornou estrutura válida");
    const formData = JSON.parse(tc.function.arguments);

    return new Response(JSON.stringify({ success: true, form: formData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[ai-form-builder]", err);
    return new Response(JSON.stringify({ error: err.message || "Falha ao gerar formulário" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
