import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAnglesForDay } from "../_shared/creativeAngles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function detectStage(diasDesdeInicio: number): { estagio: string; instrucao: string } {
  if (diasDesdeInicio <= 7) return { estagio: "aquecimento", instrucao: "Foque em problema/dor do avatar. Tom acolhedor, identificação. Sem pitch direto." };
  if (diasDesdeInicio <= 30) return { estagio: "educacao", instrucao: "Eduque sobre o mecanismo único da solução. Construa autoridade. CTA suave para o produto." };
  if (diasDesdeInicio <= 90) return { estagio: "prova_objecao", instrucao: "Use prova social, depoimentos, quebra de objeções. CTA direto para a oferta." };
  return { estagio: "nutricao_leve", instrucao: "Insight rápido + soft pitch. Cadência reduzida, valor primeiro." };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id, sequence_id, enrollment_id } = await req.json();
    if (!lead_id || !sequence_id || !enrollment_id) {
      return new Response(JSON.stringify({ error: "lead_id, sequence_id, enrollment_id obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: enrollment } = await supabase.from("imphq_lead_sequence_enrollments").select("*").eq("id", enrollment_id).single();
    const { data: sequence } = await supabase.from("imphq_nurture_sequences").select("*").eq("id", sequence_id).single();
    const { data: lead } = await supabase.from("imphq_leads").select("*").eq("id", lead_id).single();
    if (!enrollment || !sequence || !lead) {
      return new Response(JSON.stringify({ error: "Dados não encontrados" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: project } = await supabase.from("imphq_projects").select("data, name, brand_kit").eq("id", sequence.project_id).single();
    const { data: ultimosEmails } = await supabase
      .from("imphq_nurture_emails")
      .select("assunto, estagio, dia_numero")
      .eq("enrollment_id", enrollment_id)
      .order("dia_numero", { ascending: false })
      .limit(5);

    const diasDesdeInicio = Math.floor((Date.now() - new Date(enrollment.data_inicio).getTime()) / (1000 * 60 * 60 * 24));
    const dia_numero = diasDesdeInicio + 1;
    const { estagio, instrucao } = detectStage(diasDesdeInicio);

    // Ângulo do dia (rotaciona pelo catálogo Filemon) — evita e-mails repetitivos
    const anguloDia = getAnglesForDay(1, new Date(Date.now() + dia_numero * 86400000))[0];

    const projectData: any = project?.data || {};
    const avatar = projectData?.avatar || projectData?.briefing?.avatar || {};
    const copyArsenal = projectData?.copy_arsenal || projectData?.briefing?.copy_arsenal || {};

    const systemPrompt = `Você é um copywriter de e-mail marketing especialista em nutrição de leads.
Escreve em português brasileiro, tom direto, sem clichês, valor genuíno antes de pitch.
Produto: ${sequence.produto_nome}
Objetivo da sequência: ${sequence.objetivo || "Converter lead em comprador"}
Marca: ${project?.name || ""}
Estágio atual: ${estagio} — ${instrucao}

🎯 ÂNGULO PSICOLÓGICO DESTE E-MAIL: ${anguloDia.nome} — ${anguloDia.gatilho}.
Use este ângulo como espinha dorsal. Exemplo de tom: "${anguloDia.exemploHook}"

Avatar (resumo): ${JSON.stringify(avatar).slice(0, 1500)}
Copy Arsenal (frases-chave): ${JSON.stringify(copyArsenal).slice(0, 800)}

Histórico recente (NÃO REPITA TEMA):
${(ultimosEmails || []).map(e => `Dia ${e.dia_numero} (${e.estagio}): "${e.assunto}"`).join("\n") || "(primeiro e-mail)"}

REGRAS CRÍTICAS:
- Assunto: máx 60 caracteres, curiosidade ou benefício direto, sem emojis em excesso
- Corpo HTML: usar <p>, <strong>, <a> apenas. Sem CSS inline pesado. Mobile-first.
- 150-300 palavras no corpo
- Saudação personalizada: "Oi {{nome}}" ou similar
- 1 CTA claro no fim (link para o produto se estágio permitir)
- Rodapé curto com link de unsubscribe: <p style="font-size:11px;color:#888">Para parar de receber: <a href="{{unsubscribe_url}}">descadastrar</a></p>
- NÃO use markdown, apenas HTML válido

Retorne JSON: { "assunto": "...", "corpo_html": "...", "corpo_texto": "..." }`;

    const userPrompt = `Gere o e-mail do dia ${dia_numero} (estágio: ${estagio}) para o lead "${lead.nome || lead.email}". Tema deve ser distinto dos últimos enviados.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: sequence.modelo_ia || "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("[nurture-generator] AI error:", aiRes.status, txt);
      return new Response(JSON.stringify({ error: "AI falhou", details: txt }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    // Substituir variáveis simples
    const nome = lead.nome || (lead.email || "").split("@")[0];
    const renderVar = (s: string) => (s || "").replaceAll("{{nome}}", nome).replaceAll("{{produto}}", sequence.produto_nome);
    const assunto = renderVar(parsed.assunto || `Dia ${dia_numero}`).slice(0, 80);
    let corpo_html = renderVar(parsed.corpo_html || "<p>Conteúdo</p>");
    const corpo_texto = renderVar(parsed.corpo_texto || corpo_html.replace(/<[^>]+>/g, ""));

    const { data: newEmail, error: insErr } = await supabase.from("imphq_nurture_emails").insert({
      enrollment_id, lead_id, sequence_id, dia_numero, estagio,
      assunto, corpo_html, corpo_texto,
      status: "agendado",
      agendado_para: new Date().toISOString(),
      gerado_por_ia: true,
      modelo_ia: sequence.modelo_ia,
      contexto_usado: { dias_desde_inicio: diasDesdeInicio, ultimos_assuntos: (ultimosEmails || []).map(e => e.assunto) },
    }).select().single();

    if (insErr) throw insErr;

    // Inject tracking pixel + rewrite links now that we have the email ID
    const trackBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/nurture-track`;
    const eid = newEmail.id;
    // Rewrite anchor hrefs (skip mailto/anchors and unsubscribe)
    corpo_html = corpo_html.replace(/<a\s+([^>]*?)href="([^"]+)"([^>]*)>/gi, (match, pre, url, post) => {
      if (url.startsWith("mailto:") || url.startsWith("#") || url.includes("unsubscribe_url")) return match;
      const wrapped = `${trackBase}?eid=${eid}&type=click&url=${encodeURIComponent(url)}`;
      return `<a ${pre}href="${wrapped}"${post}>`;
    });
    // Append tracking pixel
    corpo_html += `<img src="${trackBase}?eid=${eid}&type=open" width="1" height="1" alt="" style="display:none" />`;

    await supabase.from("imphq_nurture_emails").update({ corpo_html } as any).eq("id", eid);
    newEmail.corpo_html = corpo_html;

    return new Response(JSON.stringify({ success: true, email: newEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[nurture-generator]", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
