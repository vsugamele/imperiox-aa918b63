import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Pipelines disponíveis
const PIPELINES: Record<string, { slug: string; label: string }[]> = {
  essencial: [
    { slug: "market-intel", label: "Inteligência de Mercado" },
    { slug: "avatar-architect", label: "Avatar Architect" },
    { slug: "mapeamento-desejos", label: "Mapeamento de Desejos" },
    { slug: "dossie-problemas", label: "Dossiê de Problemas" },
    { slug: "lp-persuasiva", label: "Arquitetura de LP" },
  ],
  completo: [
    { slug: "market-intel", label: "Inteligência de Mercado" },
    { slug: "funnel-hacker", label: "Funnel Hacker (concorrência)" },
    { slug: "avatar-architect", label: "Avatar Architect" },
    { slug: "mapeamento-desejos", label: "Mapeamento de Desejos" },
    { slug: "dossie-problemas", label: "Dossiê de Problemas" },
    { slug: "reposicionamento", label: "Reposicionamento Estratégico" },
    { slug: "mecanismo-unico", label: "Mecanismo Único Supremo" },
    { slug: "alquimia-escada-valor", label: "Escada de Valor" },
    { slug: "lp-persuasiva", label: "Arquitetura de LP" },
    { slug: "devastador-copy", label: "Devastador Copy" },
    { slug: "objection-destroyer", label: "Objection Destroyer" },
    { slug: "ads-copy-multiplier", label: "Ads Copy Multiplier" },
    { slug: "video-hook-generator", label: "Video Hooks" },
    { slug: "roteiros-virais-reels", label: "Roteiros Reels" },
    { slug: "tripwire-matador", label: "Tripwire Matador" },
  ],
};

function resolvePipeline(input: any): { slug: string; label: string }[] {
  const preset = (input?.preset as string) || "essencial";
  if (Array.isArray(input?.skills) && input.skills.length > 0) {
    return input.skills.map((slug: string) => ({ slug, label: slug }));
  }
  return PIPELINES[preset] ?? PIPELINES.essencial;
}

async function updateRun(runId: string, patch: Record<string, unknown>) {
  await supabase.from("imphq_autopilot_runs").update(patch).eq("id", runId);
}

async function fetchSkillPrompt(slug: string): Promise<{ id: string; system_prompt: string; nome: string } | null> {
  const { data } = await supabase
    .from("imphq_skills")
    .select("id, nome, system_prompt")
    .eq("slug", slug)
    .maybeSingle();
  if (data?.system_prompt) return data as any;
  // fallback by ilike on nome
  const { data: data2 } = await supabase
    .from("imphq_skills")
    .select("id, nome, system_prompt")
    .ilike("nome", `%${slug.replace(/-/g, " ")}%`)
    .limit(1)
    .maybeSingle();
  return (data2 as any) ?? null;
}

async function callAI(systemPrompt: string, userPrompt: string, model = "google/gemini-2.5-flash"): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

async function scrapeCompetitor(url: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const md: string = json?.data?.markdown ?? json?.markdown ?? "";
    return md.slice(0, 8000) || null;
  } catch {
    return null;
  }
}

async function extractAssets(produto: string, nicho: string, accumulated: Record<string, string>): Promise<any> {
  const ctx = Object.entries(accumulated)
    .map(([slug, txt]) => `### ${slug}\n${txt.slice(0, 4000)}`)
    .join("\n\n");

  const system = `Você é Imperius, estrategista de copy. Extraia e gere assets prontos para usar a partir do contexto fornecido. Retorne APENAS JSON válido, sem markdown, sem prefixo. Use pt-BR. Seja específico ao produto, evite genéricos.`;

  const user = `PRODUTO: ${produto}\nNICHO: ${nicho || "—"}\n\nCONTEXTO DAS SKILLS:\n${ctx}\n\nGere o JSON no schema:\n{
  "headlines": string[10],
  "subheadlines": string[5],
  "ad_copies": [{ "hook": string, "body": string, "cta": string }] (6 itens),
  "video_hooks": string[8],
  "emails": [{ "subject": string, "preview": string, "body": string }] (5 itens, sequência de nutrição),
  "ctas": string[6],
  "bullets_lp": string[8],
  "garantia": string,
  "faq": [{ "q": string, "a": string }] (5 itens),
  "promessa_principal": string,
  "mecanismo_unico_nome": string
}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`extract ${res.status}`);
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(content);
  } catch (err) {
    console.error("[autopilot] extractAssets failed", err);
    return null;
  }
}

async function runAutopilot(runId: string, projectId: string, input: any) {
  try {
    const { nome, nicho, url_concorrente } = input;
    const pipeline = resolvePipeline(input);
    const stepsState = pipeline.map((s) => ({
      slug: s.slug,
      label: s.label,
      status: "pending" as "pending" | "running" | "done" | "failed",
      output: "" as string,
      error: null as string | null,
    }));

    await updateRun(runId, {
      status: "running",
      total_steps: pipeline.length,
      steps: stepsState,
    });

    // 1) Optional concorrente scrape
    let scrapedContext = "";
    if (url_concorrente) {
      const scraped = await scrapeCompetitor(url_concorrente);
      if (scraped) {
        scrapedContext = `\n\n## CONCORRENTE ANALISADO (${url_concorrente})\n${scraped}\n`;
        await updateRun(runId, { scraped_context: scraped });
      }
    }

    const baseContext = `## PRODUTO\nNome: ${nome}\nNicho: ${nicho || "—"}\n${
      url_concorrente ? `URL concorrente: ${url_concorrente}\n` : ""
    }${scrapedContext}`;

    const accumulatedResults: Record<string, string> = {};

    // 2) Sequential skill execution
    for (let i = 0; i < pipeline.length; i++) {
      const step = pipeline[i];
      stepsState[i].status = "running";
      await updateRun(runId, { current_step: i, steps: stepsState });

      try {
        const skill = await fetchSkillPrompt(step.slug);
        if (!skill?.system_prompt) {
          throw new Error(`Skill '${step.slug}' não encontrada em imphq_skills`);
        }

        // Inject previous results as context for downstream skills
        let previousContext = "";
        if (i > 0) {
          previousContext = "\n\n## CONTEXTO ACUMULADO DAS SKILLS ANTERIORES\n";
          for (const [slug, txt] of Object.entries(accumulatedResults)) {
            previousContext += `\n### ${slug}\n${txt.slice(0, 2500)}\n`;
          }
        }

        const userPrompt = `${baseContext}${previousContext}\n\n---\nExecute sua skill agora considerando todo o contexto acima. Seja completo, profundo e estratégico. Saída em markdown bem estruturado em pt-BR.`;

        const output = await callAI(skill.system_prompt, userPrompt);
        accumulatedResults[step.slug] = output;

        stepsState[i].status = "done";
        stepsState[i].output = output;
        await updateRun(runId, { steps: stepsState });

        // Persist in imphq_skill_outputs with shared pipeline_id (runId)
        await supabase.from("imphq_skill_outputs").insert({
          skill_id: skill.id,
          skill_nome: skill.nome,
          result: output,
          project_id: projectId,
          produto: nome,
          model: "google/gemini-2.5-flash",
          extra_instructions: `[autopilot run ${runId}]`,
          pipeline_id: runId,
        });
      } catch (err: any) {
        stepsState[i].status = "failed";
        stepsState[i].error = err.message ?? String(err);
        await updateRun(runId, { steps: stepsState });
        // continue with next skill
      }
    }

    // 3) Consolidate into project.data.autopilot + briefing
    const { data: project } = await supabase
      .from("imphq_projects")
      .select("data, avatar")
      .eq("id", projectId)
      .maybeSingle();

    const currentData = (project?.data as any) ?? {};
    const currentBriefing = currentData.briefing ?? {};
    const currentConcorrentes = Array.isArray(currentData.concorrentes) ? currentData.concorrentes : [];

    // 3.1) Extrai assets prontos em JSON estruturado
    const assets = await extractAssets(nome, nicho || "", accumulatedResults);

    const newData = {
      ...currentData,
      briefing: {
        ...currentBriefing,
        nicho: nicho || currentBriefing.nicho || "",
        produto_principal: nome,
      },
      concorrentes: url_concorrente
        ? [{ url: url_concorrente, scraped_at: new Date().toISOString() }, ...currentConcorrentes].slice(0, 10)
        : currentConcorrentes,
      autopilot: {
        run_id: runId,
        completed_at: new Date().toISOString(),
        results: accumulatedResults,
        assets: assets ?? null,
      },
    };

    await supabase.from("imphq_projects").update({ data: newData }).eq("id", projectId);

    await updateRun(runId, {
      status: "completed",
      current_step: pipeline.length,
      assets: assets ?? null,
    });
  } catch (err: any) {
    console.error("[autopilot] fatal", err);
    await updateRun(runId, { status: "failed", error: err.message ?? String(err) });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body.action ?? "start";

    if (action === "start") {
      const { project_id, input, user_id } = body;
      if (!project_id || !input?.nome) {
        return new Response(JSON.stringify({ error: "project_id e input.nome obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const startPipeline = resolvePipeline(input);
      const { data: run, error } = await supabase
        .from("imphq_autopilot_runs")
        .insert({
          project_id,
          input,
          user_id: user_id ?? null,
          status: "pending",
          total_steps: startPipeline.length,
          steps: startPipeline.map((s) => ({ slug: s.slug, label: s.label, status: "pending", output: "", error: null })),
        })
        .select()
        .single();

      if (error) throw error;

      // Background execution
      // @ts-ignore EdgeRuntime
      EdgeRuntime.waitUntil(runAutopilot(run.id, project_id, input));

      return new Response(JSON.stringify({ run_id: run.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "ação desconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
