// One-shot seed: insere/atualiza as 3 skills (Breakthrough, Credibility, VSL Filemon)
// em imphq_skills + imphq_copy_engine_prompts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

import { breakthrough_md, credibility_md, vsl_md } from "./prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const [breakthrough, credibility, vsl] = await Promise.all([
      readPrompt("breakthrough"),
      readPrompt("credibility"),
      readPrompt("vsl"),
    ]);

    const skills = [
      {
        id: "breakthrough-techniques",
        slug: "breakthrough-techniques",
        nome: "Breakthrough — 7 Manobras Schwartz",
        descricao:
          "Aplica as 7 técnicas de copy de Eugene Schwartz (Intensificação, Identificação, Gradualização, Redefinição, Mecanização, Concentração, Camuflagem) sobre copy existente.",
        categoria: "Copy & Persuasão",
        status: "Ativo",
        icone: "Zap",
        cor: "#7c3aed",
        system_prompt: breakthrough,
        gatilho: "/breakthrough",
        versao: "v1",
      },
      {
        id: "weaponized-credibility",
        slug: "weaponized-credibility",
        nome: "Weaponized Credibility — Bencivenga",
        descricao:
          "Blinda copy com provas, reason-why e especificidade no estilo Gary Bencivenga. Mata ceticismo sem baixar o claim.",
        categoria: "Copy & Persuasão",
        status: "Ativo",
        icone: "Shield",
        cor: "#0ea5e9",
        system_prompt: credibility,
        gatilho: "/credibilidade",
        versao: "v1",
      },
      {
        id: "vsl-filemon-e3",
        slug: "vsl-filemon-e3",
        nome: "VSL Filemon — Método E3",
        descricao:
          "Pipeline completo de VSL em 6 blocos: Raio-X, Mechanism Lab, Logic Points, Story Architect, Lead e Offer Builder.",
        categoria: "Copy & Persuasão",
        status: "Ativo",
        icone: "Film",
        cor: "#c9922a",
        system_prompt: vsl,
        gatilho: "/vsl",
        versao: "v1",
      },
    ];

    const intents = [
      {
        intent: "breakthrough_techniques",
        label: "Breakthrough — 7 Manobras",
        system_prompt: breakthrough,
        model: "google/gemini-2.5-pro",
        reasoning: "high",
        output_format: "markdown",
        enabled: true,
        apply_style: true,
      },
      {
        intent: "weaponized_credibility",
        label: "Weaponized Credibility",
        system_prompt: credibility,
        model: "google/gemini-2.5-flash",
        reasoning: "medium",
        output_format: "markdown",
        enabled: true,
        apply_style: true,
      },
      {
        intent: "vsl_filemon_e3",
        label: "VSL Filemon E3 — Pipeline completo",
        system_prompt: vsl,
        model: "google/gemini-2.5-pro",
        reasoning: "high",
        output_format: "markdown",
        enabled: true,
        apply_style: true,
      },
    ];

    const r1 = await supabase.from("imphq_skills").upsert(skills, { onConflict: "id" });
    if (r1.error) throw r1.error;

    const r2 = await supabase.from("imphq_copy_engine_prompts").upsert(intents, { onConflict: "intent" });
    if (r2.error) throw r2.error;

    return new Response(
      JSON.stringify({ ok: true, skills: skills.length, intents: intents.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
