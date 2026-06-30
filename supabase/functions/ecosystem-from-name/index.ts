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

      // ===== 2. VSL (Filemon E3) =====
      if (etapas.includes("vsl")) {
        emit({ type: "step_start", step: "vsl" });
        try {
          const vsl = await runSkill({
            systemPrompt: prompts["vsl-filemon-e3"] || "",
            ctx: ctxComAvatar,
            instruction: `Gere uma VSL completa de 15-25 min seguindo o Método E3 (Raio-X → Mechanism Lab → Logic Points → Story Architect → Lead → Offer Builder). Output em markdown com 7 blocos: ## HOOK (90s), ## HISTÓRIA (4min), ## PROBLEMA (3min), ## NOVO MECANISMO (4min), ## PROVAS (3min), ## OFERTA (4min), ## CTA + URGÊNCIA (2min). Densidade alta, sem fluff.`,
            model: "google/gemini-2.5-pro",
          });
          const { data: swipe } = await sb.from("imphq_swipes").insert({
            user_id: userId, project_id: projectId,
            title: `VSL — ${produto_nome}`, formato: "vsl", plataforma: "youtube",
            status: "rascunho", raw_text: vsl, media_type: "text", blocks: [],
          }).select("id").maybeSingle();
          resultado.etapas.vsl = { ok: true, swipe_id: swipe?.id };
          emit({ type: "step_done", step: "vsl", preview: "Roteiro VSL salvo em Swipefiles" });
        } catch (e: any) {
          resultado.etapas.vsl = { ok: false, error: String(e?.message || e) };
          emit({ type: "step_error", step: "vsl", error: String(e?.message || e) });
        }
      }

      // ===== 3. LP Persuasiva =====
      if (etapas.includes("lp")) {
        emit({ type: "step_start", step: "lp" });
        try {
          const lp = await runSkill({
            systemPrompt: prompts["lp-persuasiva"] || "",
            ctx: ctxComAvatar,
            instruction: `Gere a estrutura COMPLETA de uma Landing Page de alta conversão em markdown. Blocos: # Headline + Sub, ## Hero (cópia + CTA), ## Problema (3 bullets), ## História de Transformação, ## Solução / Novo Mecanismo, ## O que você recebe (bullets), ## Prova social (3 depoimentos placeholder), ## Oferta (preço, parcelamento, bônus), ## Garantia, ## FAQ (5 perguntas), ## CTA final + escassez.`,
            model: "google/gemini-2.5-pro",
          });
          const { data: swipe } = await sb.from("imphq_swipes").insert({
            user_id: userId, project_id: projectId,
            title: `LP — ${produto_nome}`, formato: "lp", plataforma: "web",
            status: "rascunho", raw_text: lp, media_type: "text", blocks: [],
          }).select("id").maybeSingle();
          await sb.from("imphq_projects").update({
            data: { ...projData, avatar, lp_estrutura: lp },
          }).eq("id", projectId);
          resultado.etapas.lp = { ok: true, swipe_id: swipe?.id };
          emit({ type: "step_done", step: "lp", preview: "Estrutura de LP salva" });
        } catch (e: any) {
          resultado.etapas.lp = { ok: false, error: String(e?.message || e) };
          emit({ type: "step_error", step: "lp", error: String(e?.message || e) });
        }
      }

      // ===== 4. 5 ÂNGULOS de criativo =====
      if (etapas.includes("angulos")) {
        emit({ type: "step_start", step: "angulos" });
        try {
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
          const rows = (angulos.criativos || []).map((c: any) => ({
            user_id: userId, project_id: projectId, formato: "imagem",
            angulo: c.angulo, headline_copy: c.headline,
            prompt_usado: `${c.hook}\n\n${c.body}\n\nCTA: ${c.cta}`,
            aprovado: false, metadata: { origem: "corte-express", skill: "ads-copy-multiplier" },
          }));
          let ids: string[] = [];
          if (rows.length) {
            const { data } = await sb.from("imphq_creative_assets").insert(rows).select("id");
            ids = (data || []).map((r: any) => r.id);
          }
          resultado.etapas.angulos = { ok: true, count: ids.length, ids };
          emit({ type: "step_done", step: "angulos", preview: `${ids.length} ângulos salvos` });
        } catch (e: any) {
          resultado.etapas.angulos = { ok: false, error: String(e?.message || e) };
          emit({ type: "step_error", step: "angulos", error: String(e?.message || e) });
        }
      }

      // ===== 5. Roteiros de Reels =====
      if (etapas.includes("reels")) {
        emit({ type: "step_start", step: "reels" });
        try {
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
          const rows = (reels.reels || []).map((r: any) => ({
            user_id: userId, project_id: projectId, formato: "video_script",
            angulo: r.estrutura, headline_copy: r.hook,
            prompt_usado: `${r.roteiro_completo}\n\nCTA: ${r.cta}`,
            aprovado: false, metadata: { origem: "corte-express", skill: "roteiros-virais-reels" },
          }));
          let ids: string[] = [];
          if (rows.length) {
            const { data } = await sb.from("imphq_creative_assets").insert(rows).select("id");
            ids = (data || []).map((r: any) => r.id);
          }
          resultado.etapas.reels = { ok: true, count: ids.length, ids };
          emit({ type: "step_done", step: "reels", preview: `${ids.length} roteiros de Reels` });
        } catch (e: any) {
          resultado.etapas.reels = { ok: false, error: String(e?.message || e) };
          emit({ type: "step_error", step: "reels", error: String(e?.message || e) });
        }
      }

      // ===== 6. Imagens (5 mockups via creative-image-gen) =====
      if (etapas.includes("imagens")) {
        emit({ type: "step_start", step: "imagens" });
        try {
          const angulosBase = ["dor","desejo","prova","mecanismo","urgência"];
          const promptsImg = angulosBase.map(a =>
            `Criativo de anúncio para "${produto_nome}". Ângulo: ${a}. Estilo fotográfico premium, formato 1:1, alto contraste, sem texto.`
          );
          const ids: string[] = [];
          for (const p of promptsImg) {
            try {
              const r = await fetch(`${SUPABASE_URL}/functions/v1/creative-image-gen`, {
                method: "POST",
                headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ project_id: projectId, prompt: p, save_to_library: true }),
              });
              if (r.ok) {
                const j = await r.json().catch(() => ({}));
                if (j?.asset_id || j?.image_url) ids.push(j.asset_id || j.image_url);
              }
            } catch { /* segue baterias */ }
          }
          resultado.etapas.imagens = { ok: ids.length > 0, count: ids.length };
          emit({ type: "step_done", step: "imagens", preview: `${ids.length}/5 imagens geradas` });
        } catch (e: any) {
          resultado.etapas.imagens = { ok: false, error: String(e?.message || e) };
          emit({ type: "step_error", step: "imagens", error: String(e?.message || e) });
        }
      }

      // ===== 7. WhatsApp X1 (sequência consultiva Sugamele) =====
      if (etapas.includes("whatsapp_x1")) {
        emit({ type: "step_start", step: "whatsapp_x1" });
        try {
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
          const { data: tpl } = await sb.from("imphq_wa_campaign_templates").insert({
            user_id: userId, project_id: projectId,
            nome: `X1 Consultivo — ${produto_nome}`,
            descricao: "Sequência 7 toques gerada pelo Corte Express (Sugamele)",
            tipo: "sequencia",
            mensagens: wa.mensagens,
            ativo: false,
          }).select("id").maybeSingle();
          resultado.etapas.whatsapp_x1 = { ok: true, template_id: tpl?.id, count: wa.mensagens?.length || 0 };
          emit({ type: "step_done", step: "whatsapp_x1", preview: `${wa.mensagens?.length || 0} mensagens` });
        } catch (e: any) {
          resultado.etapas.whatsapp_x1 = { ok: false, error: String(e?.message || e) };
          emit({ type: "step_error", step: "whatsapp_x1", error: String(e?.message || e) });
        }
      }

      // ===== 8. Fluxos pós-venda OpenFlow (programáticos) =====
      if (etapas.includes("fluxos_pos_venda")) {
        emit({ type: "step_start", step: "fluxos_pos_venda" });
        try {
          const bps = buildPostSaleBlueprints({ project_id: projectId, produto_nome, user_id: userId });
          const { data, error } = await sb.from("imphq_flow_blueprints").insert(bps).select("id, title");
          if (error) throw error;
          resultado.etapas.fluxos_pos_venda = { ok: true, blueprints: data };
          emit({ type: "step_done", step: "fluxos_pos_venda", preview: `${data?.length || 0} fluxos OpenFlow criados` });
        } catch (e: any) {
          resultado.etapas.fluxos_pos_venda = { ok: false, error: String(e?.message || e) };
          emit({ type: "step_error", step: "fluxos_pos_venda", error: String(e?.message || e) });
        }
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
