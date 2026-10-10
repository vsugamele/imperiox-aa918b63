// Microlead do Método H&W (MHW1.6): escreve um rascunho de abertura de 1–2 min (300–400 palavras, 7 etapas) para
// entrar antes da lead de uma VSL, confere o roteiro e devolve os pesos do teste contra o controle. Sem cron e sem
// mexer em página: devolve texto para alguém revisar; subir no split é decisão humana.
// Body: { produto, publico, promessa_vsl, mecanismo_vsl, formato_viral?, angulo?, avatar?, aberturas_no_ar?, modelo?,
//         controle?, reservas?: string[] }
import { checkMicrolead, microleadPrompt, microleadSplit, type MicroleadBrief } from "../_shared/microlead.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const required = ["produto", "publico", "promessa_vsl", "mecanismo_vsl"] as const;
    const faltando = required.filter((k) => !String(body?.[k] ?? "").trim());
    if (faltando.length) return json({ error: `Faltam: ${faltando.join(", ")}` }, 400);
    const brief: MicroleadBrief = {
      produto: String(body.produto), publico: String(body.publico), promessa_vsl: String(body.promessa_vsl), mecanismo_vsl: String(body.mecanismo_vsl),
      formato_viral: body.formato_viral ?? null, angulo: body.angulo ?? null, avatar: body.avatar ?? null,
      aberturas_no_ar: Array.isArray(body.aberturas_no_ar) ? body.aberturas_no_ar.map(String) : [],
    };
    const prompt = microleadPrompt(brief);
    const split = microleadSplit(String(body.controle ?? "controle"), Array.isArray(body.reservas) ? body.reservas.map(String) : [], "microlead-nova");
    if (body?.so_brief === true || !OPENROUTER_API_KEY) return json({ ok: true, prompt, split, texto: null, aviso: OPENROUTER_API_KEY ? undefined : "OPENROUTER_API_KEY ausente: devolvendo só o brief" });

    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Imperio HQ microlead-writer" },
      body: JSON.stringify({ model: String(body.modelo ?? "google/gemini-2.5-flash"), messages: [{ role: "user", content: prompt }], max_tokens: 1800 }),
    });
    if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
    const saida = d.choices?.[0]?.message?.content?.trim() ?? "";
    // Parte (A) é o texto falado; a checagem de tamanho vale só para ela.
    const falado = saida.split(/\n\s*\(?B\)?[\s.:)-]/i)[0] ?? saida;
    return json({ ok: true, prompt, texto: saida, checagem: checkMicrolead(falado.replace(/^\s*\(?A\)?[\s.:)-]*/i, "")), split });
  } catch (e) {
    console.error("[microlead-writer]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
