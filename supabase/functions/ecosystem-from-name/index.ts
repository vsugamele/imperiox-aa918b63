// Corte Express — pipeline 1-clique: nome do produto → ecossistema completo
// usando as skills reais (avatar-architect, vsl-filemon-e3, lp-persuasiva,
// ads-copy-multiplier, roteiros-virais-reels, vinicius_sugamele) + creative-image-gen
// + 3 fluxos pós-venda em OpenFlow.
//
// SSE: emite eventos de progresso (uma linha por etapa concluída).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadSkillPrompt, runSkill } from "../_shared/run-skill.ts";
import { buildPostSaleBlueprints } from "./post-sale-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Step =
  | "avatar" | "vsl" | "lp" | "angulos" | "reels"
  | "imagens" | "whatsapp_x1" | "fluxos_pos_venda";

const ALL_STEPS: Step[] = [
  "avatar", "vsl", "lp", "angulos", "reels", "imagens", "whatsapp_x1", "fluxos_pos_venda",
];

interface Input {
  produto_nome: string;
  ticket?: string;
  promessa?: string;
  nicho?: string;
  projeto_id?: string;
  novo_projeto_nome?: string;
  etapas?: Step[];
  swipe_id?: string;       // referência opcional de Swipefiles para inspirar VSL/LP
  skip_audit?: boolean;    // pular auditoria automática no final
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const enc = new TextEncoder();
  const emit = (data: any) =>
    writer.write(enc.encode(`data: ${JSON.stringify(data)}\n\n`)).catch(() => {});

  (async () => {
    try {
      const body: Input = await req.json();
      const { produto_nome, ticket, promessa, nicho } = body;
      if (!produto_nome) throw new Error("produto_nome obrigatório");

      const etapas = (body.etapas && body.etapas.length > 0) ? body.etapas : ALL_STEPS;
      const sb = createClient(SUPABASE_URL, SERVICE_KEY);

      // Auth
      const authHeader = req.headers.get("Authorization") || "";
      const userJwt = authHeader.replace("Bearer ", "");
      const { data: userData } = await sb.auth.getUser(userJwt);
      const userId = userData?.user?.id;
      if (!userId) throw new Error("Não autenticado");

      // Resolver projeto (cria se necessário)
      let projectId = body.projeto_id;
      if (!projectId) {
        const newId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const nome = body.novo_projeto_nome || produto_nome;
        const { error } = await sb.from("imphq_projects").insert({
          id: newId, name: nome, user_id: userId, category: nicho || "Infoproduto",
          data: { nicho, criado_via: "corte-express" }, active: true,
        });
        if (error) throw new Error(`Criar projeto: ${error.message}`);
        projectId = newId;
        emit({ type: "project_created", projeto_id: projectId, nome });
      }

      // Branding já existente
      const { data: proj } = await sb.from("imphq_projects").select("data, avatar, brand_kit, name").eq("id", projectId).maybeSingle();
      const projData = (proj?.data as any) || {};
      const branding = proj?.brand_kit || projData?.branding || {};
      let avatar: any = proj?.avatar || projData?.avatar || null;

      const ctxBase = { produto_nome, ticket, promessa, nicho, branding };

      // Pré-carrega prompts das skills usadas
      const slugs = [
        "avatar-architect", "vsl-filemon-e3", "lp-persuasiva",
        "ads-copy-multiplier", "roteiros-virais-reels", "vinicius_sugamele",
      ];
      const prompts: Record<string, string> = {};
      await Promise.all(slugs.map(async (s) => {
        const p = await loadSkillPrompt(sb, s);
        if (p) prompts[s] = p;
      }));

      const resultado: any = { projeto_id: projectId, etapas: {} };

      // ===== 1. AVATAR =====
      if (etapas.includes("avatar")) {
        emit({ type: "step_start", step: "avatar" });
        try {
          const av = await runSkill({
            systemPrompt: prompts["avatar-architect"] || "",
            ctx: ctxBase,
            instruction: `Gere o Tomo de Onisciência do Avatar para o produto "${produto_nome}". Retorne JSON com: nome (string), dores (array de 5 strings densas), desejos (array de 5), objecoes (array de 5), gatilhos_emocionais (array de 5), linguagem (string descrevendo tom e jargões), dia_perfeito (string), dia_horrivel (string).`,
            model: "google/gemini-2.5-flash",
            jsonSchema: {
              type: "object", additionalProperties: false,
              required: ["nome","dores","desejos","objecoes","gatilhos_emocionais","linguagem","dia_perfeito","dia_horrivel"],
              properties: {
                nome: { type: "string" },
                dores: { type: "array", items: { type: "string" } },
                desejos: { type: "array", items: { type: "string" } },
                objecoes: { type: "array", items: { type: "string" } },
                gatilhos_emocionais: { type: "array", items: { type: "string" } },
                linguagem: { type: "string" },
                dia_perfeito: { type: "string" },
                dia_horrivel: { type: "string" },
              },
            },
          });
          await sb.from("imphq_projects").update({
            avatar: av,
            data: { ...projData, avatar: av },
          }).eq("id", projectId);
          avatar = av;
          resultado.etapas.avatar = { ok: true, nome: av.nome };
          emit({ type: "step_done", step: "avatar", preview: av.nome });
        } catch (e: any) {
          resultado.etapas.avatar = { ok: false, error: String(e?.message || e) };
          emit({ type: "step_error", step: "avatar", error: String(e?.message || e) });
        }
      }

      const ctxComAvatar = { ...ctxBase, avatar };

      // ===== Helper genérico p/ etapas paralelas =====
      async function runStep(step: Step, fn: () => Promise<{ preview: string; hubAsset?: HubAssetSeed | null }>) {
        emit({ type: "step_start", step });
        try {
          const out = await fn();
          resultado.etapas[step] = { ok: true };
          if (out.hubAsset) hubSeeds.push(out.hubAsset);
          emit({ type: "step_done", step, preview: out.preview });
        } catch (e: any) {
          resultado.etapas[step] = { ok: false, error: String(e?.message || e) };
          emit({ type: "step_error", step, error: String(e?.message || e) });
        }
      }

      // Sementes para construir o Hub depois das etapas paralelas
      type HubAssetSeed = { catId: string; itemId: string; output: string };
      const hubSeeds: HubAssetSeed[] = [];
      if (avatar) {
        hubSeeds.push({
          catId: "publico", itemId: "avatar_4",
          output: typeof avatar === "string" ? avatar : JSON.stringify(avatar, null, 2),
        });
      }

      // ===== Etapas paralelas (após o avatar) =====
      const parallelJobs: Promise<void>[] = [];

      if (etapas.includes("vsl")) parallelJobs.push(runStep("vsl", async () => {
        const vsl = await runSkill({
          systemPrompt: prompts["vsl-filemon-e3"] || "",
          ctx: ctxComAvatar,
          instruction: `Gere uma VSL completa de 15-25 min seguindo o Método E3 (Raio-X → Mechanism Lab → Logic Points → Story Architect → Lead → Offer Builder). Output em markdown com 7 blocos: ## HOOK (90s), ## HISTÓRIA (4min), ## PROBLEMA (3min), ## NOVO MECANISMO (4min), ## PROVAS (3min), ## OFERTA (4min), ## CTA + URGÊNCIA (2min). Densidade alta, sem fluff.`,
          model: "google/gemini-2.5-pro",
        });
        await sb.from("imphq_swipes").insert({
          user_id: userId, project_id: projectId,
          title: `VSL — ${produto_nome}`, formato: "vsl", plataforma: "youtube",
          status: "rascunho", raw_text: vsl, media_type: "text", blocks: [],
        });
        return { preview: "Roteiro VSL salvo em Swipefiles", hubAsset: { catId: "vsl", itemId: "vsl_7blocos", output: vsl } };
      }));

      if (etapas.includes("lp")) parallelJobs.push(runStep("lp", async () => {
        const lp = await runSkill({
          systemPrompt: prompts["lp-persuasiva"] || "",
          ctx: ctxComAvatar,
          instruction: `Gere a estrutura COMPLETA de uma Landing Page de alta conversão em markdown. Blocos: # Headline + Sub, ## Hero (cópia + CTA), ## Problema (3 bullets), ## História de Transformação, ## Solução / Novo Mecanismo, ## O que você recebe (bullets), ## Prova social (3 depoimentos placeholder), ## Oferta (preço, parcelamento, bônus), ## Garantia, ## FAQ (5 perguntas), ## CTA final + escassez.`,
          model: "google/gemini-2.5-pro",
        });
        await sb.from("imphq_swipes").insert({
          user_id: userId, project_id: projectId,
          title: `LP — ${produto_nome}`, formato: "lp", plataforma: "web",
          status: "rascunho", raw_text: lp, media_type: "text", blocks: [],
        });
        return { preview: "Estrutura de LP salva", hubAsset: { catId: "ofertas", itemId: "core", output: lp } };
      }));

      if (etapas.includes("angulos")) parallelJobs.push(runStep("angulos", async () => {
        const angulos = await runSkill({
          systemPrompt: prompts["ads-copy-multiplier"] || "",
          ctx: ctxComAvatar,
          instruction: `Gere 5 ângulos de criativo distintos para anúncios pagos (dor, desejo, prova/autoridade, curiosidade/mecanismo, urgência). Para cada um: angulo, headline (até 60 chars), hook (1 frase de 3s), body (3-4 linhas) e cta (texto botão). Saída em JSON.`,
          model: "google/gemini-2.5-flash",
          jsonSchema: {
            type: "object", additionalProperties: false, required: ["criativos"],
            properties: {
              criativos: {
                type: "array",
                items: {
                  type: "object", additionalProperties: false,
                  required: ["angulo","headline","hook","body","cta"],
                  properties: {
                    angulo: { type: "string" }, headline: { type: "string" },
                    hook: { type: "string" }, body: { type: "string" }, cta: { type: "string" },
                  },
                },
              },
            },
          },
        });
        const consolidado = (angulos.criativos || []).map((c: any, i: number) =>
          `## Ângulo ${i + 1}: ${c.angulo}\n**Headline:** ${c.headline}\n**Hook (3s):** ${c.hook}\n**Body:**\n${c.body}\n**CTA:** ${c.cta}`
        ).join("\n\n---\n\n");
        await sb.from("imphq_swipes").insert({
          user_id: userId, project_id: projectId,
          title: `5 Ângulos Criativos — ${produto_nome}`, formato: "anuncio",
          plataforma: "meta", status: "rascunho",
          raw_text: consolidado, media_type: "text", blocks: angulos.criativos || [],
        });
        return { preview: `${(angulos.criativos || []).length} ângulos salvos`, hubAsset: { catId: "ads", itemId: "copy_anuncio", output: consolidado } };
      }));

      if (etapas.includes("reels")) parallelJobs.push(runStep("reels", async () => {
        const reels = await runSkill({
          systemPrompt: prompts["roteiros-virais-reels"] || "",
          ctx: ctxComAvatar,
          instruction: `Gere 5 roteiros de Reels/TikTok (30-60s cada) usando estruturas variadas (Dica Direta, Esquema, Passo a Passo, Antes/Depois, Provocação). Para cada: estrutura, hook (3s), roteiro_completo (texto formatado com cenas/tempo), cta. Saída em JSON.`,
          model: "google/gemini-2.5-flash",
          jsonSchema: {
            type: "object", additionalProperties: false, required: ["reels"],
            properties: {
              reels: {
                type: "array",
                items: {
                  type: "object", additionalProperties: false,
                  required: ["estrutura","hook","roteiro_completo","cta"],
                  properties: {
                    estrutura: { type: "string" }, hook: { type: "string" },
                    roteiro_completo: { type: "string" }, cta: { type: "string" },
                  },
                },
              },
            },
          },
        });
        const consolidado = (reels.reels || []).map((r: any, i: number) =>
          `## Reel ${i + 1} — ${r.estrutura}\n**Hook (3s):** ${r.hook}\n\n${r.roteiro_completo}\n\n**CTA:** ${r.cta}`
        ).join("\n\n---\n\n");
        await sb.from("imphq_swipes").insert({
          user_id: userId, project_id: projectId,
          title: `5 Roteiros Reels — ${produto_nome}`, formato: "reels",
          plataforma: "instagram", status: "rascunho",
          raw_text: consolidado, media_type: "text", blocks: reels.reels || [],
        });
        return { preview: `${(reels.reels || []).length} roteiros de Reels`, hubAsset: { catId: "scripts", itemId: "reels", output: consolidado } };
      }));

      if (etapas.includes("imagens")) parallelJobs.push(runStep("imagens", async () => {
        const angulosBase = ["dor","desejo","prova","mecanismo","urgência"];
        const promptsImg = angulosBase.map(a =>
          `Criativo de anúncio para "${produto_nome}". Ângulo: ${a}. Estilo fotográfico premium, formato 1:1, alto contraste, sem texto.`
        );
        const urls: string[] = [];
        await Promise.all(promptsImg.map(async (p) => {
          try {
            const r = await fetch(`${SUPABASE_URL}/functions/v1/creative-image-gen`, {
              method: "POST",
              headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ project_id: projectId, prompt: p, save_to_library: true }),
            });
            if (r.ok) {
              const j = await r.json().catch(() => ({}));
              if (j?.image_url) urls.push(j.image_url);
              else if (j?.asset_id) urls.push(j.asset_id);
            }
          } catch { /* segue */ }
        }));
        const consolidado = urls.length > 0
          ? urls.map((u, i) => `### Criativo ${i + 1}\n![](${u})`).join("\n\n")
          : "Nenhuma imagem gerada.";
        return { preview: `${urls.length}/5 imagens geradas`, hubAsset: urls.length > 0 ? { catId: "ads", itemId: "criativos", output: consolidado } : null };
      }));

      if (etapas.includes("whatsapp_x1")) parallelJobs.push(runStep("whatsapp_x1", async () => {
        const wa = await runSkill({
          systemPrompt: prompts["vinicius_sugamele"] || "",
          ctx: ctxComAvatar,
          instruction: `Crie uma sequência de 7 mensagens de WhatsApp 1:1 para vender "${produto_nome}" via abordagem consultiva (não passiva-agressiva, sem caixa-alta gratuita). Estrutura: t1 quebra-gelo+qualificação, t2 conexão+dor, t3 prova social, t4 apresentação do mecanismo, t5 oferta com link, t6 follow-up de dúvida, t7 downsell/última chance. Saída JSON.`,
          model: "google/gemini-2.5-flash",
          jsonSchema: {
            type: "object", additionalProperties: false, required: ["mensagens"],
            properties: {
              mensagens: {
                type: "array",
                items: {
                  type: "object", additionalProperties: false,
                  required: ["ordem","objetivo","texto","delay_minutos"],
                  properties: {
                    ordem: { type: "number" }, objetivo: { type: "string" },
                    texto: { type: "string" }, delay_minutos: { type: "number" },
                  },
                },
              },
            },
          },
        });
        const textoConsolidado = (wa.mensagens || []).sort((a:any,b:any)=>a.ordem-b.ordem).map((m: any) =>
          `### Toque ${m.ordem} — ${m.objetivo} (após ${m.delay_minutos}min)\n${m.texto}`
        ).join("\n\n");
        await sb.from("imphq_swipes").insert({
          user_id: userId, project_id: projectId,
          title: `WhatsApp X1 — ${produto_nome}`, formato: "whatsapp_sequence",
          plataforma: "whatsapp", status: "rascunho",
          raw_text: textoConsolidado, media_type: "text", blocks: wa.mensagens || [],
        });
        return { preview: `${wa.mensagens?.length || 0} mensagens`, hubAsset: { catId: "scripts", itemId: "dm", output: textoConsolidado } };
      }));

      await Promise.allSettled(parallelJobs);

      // ===== Fluxos pós-venda OpenFlow (programáticos, depois do paralelo) =====
      if (etapas.includes("fluxos_pos_venda")) {
        emit({ type: "step_start", step: "fluxos_pos_venda" });
        try {
          const bps = buildPostSaleBlueprints({ project_id: projectId, produto_nome, created_by: userId });
          const { data, error } = await sb.from("imphq_flow_blueprints").insert(bps).select("id, title");
          if (error) throw error;
          resultado.etapas.fluxos_pos_venda = { ok: true, blueprints: data };
          emit({ type: "step_done", step: "fluxos_pos_venda", preview: `${data?.length || 0} fluxos OpenFlow criados` });
        } catch (e: any) {
          resultado.etapas.fluxos_pos_venda = { ok: false, error: String(e?.message || e) };
          emit({ type: "step_error", step: "fluxos_pos_venda", error: String(e?.message || e) });
        }
      }

      // ===== Garante produto no briefing + monta Hub no canvas =====
      try {
        emit({ type: "step_start", step: "hub" as any });
        // 1. Adicionar produto ao briefing se não existir
        const { data: projRow } = await sb.from("imphq_projects").select("data").eq("id", projectId).maybeSingle();
        const pd: any = (projRow?.data && typeof projRow.data === "object") ? projRow.data : {};
        const briefing = (pd.briefing && typeof pd.briefing === "object") ? pd.briefing : null;
        const target = briefing || pd;
        const lista: any[] = Array.isArray(target.produtos) ? target.produtos : [];
        const existe = lista.some((p: any) => (typeof p === "string" ? p : p?.nome || p?.name) === produto_nome);
        if (!existe) {
          target.produtos = [...lista, { nome: produto_nome, ticket, promessa, criado_via: "one-click" }];
          const newData = briefing ? { ...pd, briefing: target } : { ...pd, produtos: target.produtos };
          await sb.from("imphq_projects").update({ data: newData }).eq("id", projectId);
        }

        // 2. Layout: produto no centro-esquerda (80,80), assets em colunas y por faixa
        // Faixas: Aquisição (publico, ads, scripts/reels) y=120, Conversão (vsl, ofertas, copy) y=440, Maximização (scripts/dm) y=760
        const FAIXA: Record<string, number> = {
          publico: 120, ads: 120, scripts: 760, vsl: 440, ofertas: 440, copy: 440, emails: 760, eventos_wa: 760,
        };
        const colByFaixa: Record<number, number> = {};
        const hubAssets = hubSeeds.map((seed) => {
          const y = FAIXA[seed.catId] ?? 440;
          const col = (colByFaixa[y] = (colByFaixa[y] ?? 0) + 1);
          return {
            id: crypto.randomUUID(),
            catId: seed.catId,
            itemId: seed.itemId,
            pos_x: 420 + (col - 1) * 260,
            pos_y: y,
            output: seed.output,
            generated_at: new Date().toISOString(),
            status: "generated" as const,
          };
        });

        // 3. Persistir no imphq_funis (tipo=hub) keyed pelo produto_nome
        const { data: hubRow } = await sb.from("imphq_funis").select("id, data").eq("project_id", projectId).eq("tipo", "hub").maybeSingle();
        if (hubRow) {
          const hub = (hubRow.data as any)?.hub || {};
          hub[produto_nome] = hubAssets;
          await sb.from("imphq_funis").update({ data: { ...(hubRow.data as any || {}), hub } }).eq("id", hubRow.id);
        } else {
          await sb.from("imphq_funis").insert({
            id: crypto.randomUUID(),
            project_id: projectId,
            nome: `Hub: ${produto_nome}`,
            tipo: "hub",
            status: "Ativo",
            data: { hub: { [produto_nome]: hubAssets } },
          });
        }
        resultado.hub = { assets: hubAssets.length };
        emit({ type: "step_done", step: "hub" as any, preview: `Hub montado com ${hubAssets.length} ativos posicionados` });
      } catch (e: any) {
        emit({ type: "step_error", step: "hub" as any, error: String(e?.message || e) });
      }

      emit({ type: "done", resultado });
    } catch (e: any) {
      console.error("[corte-express] fatal", e);
      emit({ type: "fatal", error: String(e?.message || e) });
    } finally {
      writer.close().catch(() => {});
    }
  })();

  return new Response(stream.readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});
