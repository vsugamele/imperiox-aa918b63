// Inventário read-only do ecossistema de um produto dentro de um projeto.
// Retorna mapa { etapa: 'ok' | 'fraco' | 'faltando' } pra alimentar o
// modo "Organizar Existente" do One Click.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

type Status = "ok" | "fraco" | "faltando";

function classify(found: { count: number; latest?: string | null }): Status {
  if (!found.count) return "faltando";
  if (found.latest) {
    const age = Date.now() - new Date(found.latest).getTime();
    if (age > NINETY_DAYS_MS) return "fraco";
  }
  return "ok";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { projeto_id, produto_nome } = body;
    if (!projeto_id) throw new Error("projeto_id obrigatório");

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const { data: u } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!u?.user?.id) throw new Error("Não autenticado");

    // Projeto + briefing
    const { data: proj } = await sb.from("imphq_projects")
      .select("data, avatar, brand_kit, name").eq("id", projeto_id).maybeSingle();
    const projData = (proj?.data as any) || {};
    const briefingProdutos: any[] = Array.isArray(projData?.briefing?.produtos)
      ? projData.briefing.produtos : Array.isArray(projData?.produtos) ? projData.produtos : [];
    const avatarPorProduto = projData?.avatares_por_produto || projData?.briefing?.avatares_por_produto || {};

    // Avatar: por produto ou avatar global
    const hasAvatarProd = produto_nome && !!avatarPorProduto?.[produto_nome];
    const hasAvatarGlobal = !!(proj?.avatar || projData?.avatar);

    // Swipes do projeto (filtrar por título contendo produto_nome quando informado)
    const { data: swipes } = await sb.from("imphq_swipes")
      .select("formato, title, updated_at, created_at")
      .eq("project_id", projeto_id);

    const swipesByFormat = (formato: string) => {
      const matching = (swipes || []).filter((s: any) =>
        s.formato === formato &&
        (!produto_nome || (s.title || "").toLowerCase().includes(produto_nome.toLowerCase()))
      );
      return {
        count: matching.length,
        latest: matching.map((s: any) => s.updated_at || s.created_at).sort().slice(-1)[0] || null,
      };
    };

    // Imagens criativas
    const { count: imgCount } = await sb.from("imphq_creative_assets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projeto_id);

    // Fluxos OpenFlow do projeto
    const { count: flowCount } = await sb.from("imphq_flow_blueprints")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projeto_id);

    // Hub
    const { data: hub } = await sb.from("imphq_funis")
      .select("id, data").eq("project_id", projeto_id).eq("tipo", "hub").maybeSingle();
    const hubAssets = hub ? ((hub.data as any)?.hub?.[produto_nome] || []) : [];

    const inventario: Record<string, Status> = {
      avatar: (hasAvatarProd || hasAvatarGlobal) ? "ok" : "faltando",
      vsl: classify(swipesByFormat("vsl")),
      lp: classify(swipesByFormat("lp")),
      angulos: classify(swipesByFormat("anuncio")),
      reels: classify(swipesByFormat("reels")),
      imagens: (imgCount || 0) > 0 ? "ok" : "faltando",
      whatsapp_x1: classify(swipesByFormat("whatsapp_sequence")),
      fluxos_pos_venda: (flowCount || 0) >= 3 ? "ok" : (flowCount || 0) > 0 ? "fraco" : "faltando",
      hub: hubAssets.length > 0 ? "ok" : "faltando",
    };

    // ===== Perfis de Estratégia =====
    type StratItem = { etapa: string; label: string; weight: number; bloco: "Aquisição"|"Conversão"|"Retenção"; esforco: 1|2|3 };
    const PROFILES: Record<string, StratItem[]> = {
      lancamento: [
        { etapa: "avatar", label: "Avatar definido", weight: 12, bloco: "Aquisição", esforco: 2 },
        { etapa: "angulos", label: "Ângulos de criativo (3+)", weight: 12, bloco: "Aquisição", esforco: 1 },
        { etapa: "reels", label: "Roteiros de aquecimento", weight: 10, bloco: "Aquisição", esforco: 1 },
        { etapa: "imagens", label: "Criativos visuais", weight: 8, bloco: "Aquisição", esforco: 1 },
        { etapa: "vsl", label: "CPL/VSL principal", weight: 18, bloco: "Conversão", esforco: 3 },
        { etapa: "lp", label: "Carta de vendas", weight: 14, bloco: "Conversão", esforco: 2 },
        { etapa: "whatsapp_x1", label: "Sequência carrinho aberto", weight: 12, bloco: "Conversão", esforco: 2 },
        { etapa: "fluxos_pos_venda", label: "Recovery + pós-venda", weight: 10, bloco: "Retenção", esforco: 2 },
        { etapa: "hub", label: "Hub montado", weight: 4, bloco: "Retenção", esforco: 1 },
      ],
      perpetuo: [
        { etapa: "avatar", label: "Avatar definido", weight: 10, bloco: "Aquisição", esforco: 2 },
        { etapa: "angulos", label: "Bateria de ângulos perenes", weight: 14, bloco: "Aquisição", esforco: 1 },
        { etapa: "imagens", label: "Criativos escaláveis", weight: 10, bloco: "Aquisição", esforco: 1 },
        { etapa: "vsl", label: "VSL evergreen", weight: 16, bloco: "Conversão", esforco: 3 },
        { etapa: "lp", label: "LP + order bump + upsell", weight: 16, bloco: "Conversão", esforco: 2 },
        { etapa: "whatsapp_x1", label: "Recovery PIX/Boleto", weight: 14, bloco: "Conversão", esforco: 2 },
        { etapa: "fluxos_pos_venda", label: "Ascensão + downsell", weight: 14, bloco: "Retenção", esforco: 2 },
        { etapa: "hub", label: "Hub montado", weight: 6, bloco: "Retenção", esforco: 1 },
      ],
      webinar: [
        { etapa: "avatar", label: "Avatar definido", weight: 10, bloco: "Aquisição", esforco: 2 },
        { etapa: "angulos", label: "Ads de inscrição", weight: 12, bloco: "Aquisição", esforco: 1 },
        { etapa: "imagens", label: "Criativos de inscrição", weight: 8, bloco: "Aquisição", esforco: 1 },
        { etapa: "lp", label: "Página de inscrição + obrigado", weight: 14, bloco: "Aquisição", esforco: 2 },
        { etapa: "vsl", label: "Pitch do webinar (replay)", weight: 18, bloco: "Conversão", esforco: 3 },
        { etapa: "whatsapp_x1", label: "Lembretes + show-up + pitch WA", weight: 18, bloco: "Conversão", esforco: 2 },
        { etapa: "fluxos_pos_venda", label: "Recovery replay + downsell", weight: 14, bloco: "Retenção", esforco: 2 },
        { etapa: "hub", label: "Hub montado", weight: 6, bloco: "Retenção", esforco: 1 },
      ],
      x1: [
        { etapa: "avatar", label: "Avatar + qualificação", weight: 14, bloco: "Aquisição", esforco: 2 },
        { etapa: "reels", label: "Conteúdo de atração", weight: 10, bloco: "Aquisição", esforco: 1 },
        { etapa: "angulos", label: "Ganchos de DM", weight: 10, bloco: "Aquisição", esforco: 1 },
        { etapa: "whatsapp_x1", label: "Script DM + objeções + oferta", weight: 28, bloco: "Conversão", esforco: 2 },
        { etapa: "imagens", label: "Prints/prova social", weight: 8, bloco: "Conversão", esforco: 1 },
        { etapa: "fluxos_pos_venda", label: "Follow-up + ascensão", weight: 20, bloco: "Retenção", esforco: 2 },
        { etapa: "hub", label: "Hub montado", weight: 10, bloco: "Retenção", esforco: 1 },
      ],
    };

    const estrategia = (body.estrategia && PROFILES[body.estrategia]) ? body.estrategia : "perpetuo";
    const perfil = PROFILES[estrategia];

    const checklist = perfil.map((it) => {
      const st = (inventario as any)[it.etapa] as Status | undefined;
      const done = st === "ok";
      const partial = st === "fraco";
      return { ...it, status: st || "faltando", done, partial };
    });

    const totalWeight = checklist.reduce((s, i) => s + i.weight, 0);
    const earned = checklist.reduce((s, i) => s + (i.done ? i.weight : i.partial ? i.weight * 0.5 : 0), 0);
    const score = Math.round((earned / totalWeight) * 100);

    const scoresByBloco: Record<string, { score: number }> = {};
    for (const b of ["Aquisição", "Conversão", "Retenção"] as const) {
      const items = checklist.filter((i) => i.bloco === b);
      const t = items.reduce((s, i) => s + i.weight, 0);
      const e = items.reduce((s, i) => s + (i.done ? i.weight : i.partial ? i.weight * 0.5 : 0), 0);
      scoresByBloco[b] = { score: t ? Math.round((e / t) * 100) : 0 };
    }

    const gaps = checklist
      .filter((i) => !i.done)
      .map((i) => ({ ...i, prioridade: (i.weight * (i.partial ? 0.5 : 1)) / i.esforco }))
      .sort((a, b) => b.prioridade - a.prioridade);

    const ondas = {
      onda1: gaps.filter((g) => g.esforco === 1).slice(0, 4),
      onda2: gaps.filter((g) => g.esforco === 2 && !g.partial).slice(0, 4),
      onda3: gaps.filter((g) => g.esforco === 3 || g.partial).slice(0, 4),
    };

    const next_action = gaps[0]
      ? `Comece por: ${gaps[0].label} (${gaps[0].bloco})`
      : "Funil completo — foque em otimização";

    return new Response(JSON.stringify({
      projeto_id,
      produto_nome: produto_nome || null,
      produtos_do_briefing: briefingProdutos,
      inventario,
      estrategia,
      score,
      scores_por_bloco: scoresByBloco,
      checklist,
      top_gaps: gaps.slice(0, 5),
      ondas,
      next_action,
      detalhes: {
        swipes_total: swipes?.length || 0,
        imagens: imgCount || 0,
        fluxos: flowCount || 0,
        hub_assets: hubAssets.length,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
