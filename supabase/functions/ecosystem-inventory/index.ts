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
    const { projeto_id, produto_nome } = await req.json();
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

    return new Response(JSON.stringify({
      projeto_id,
      produto_nome: produto_nome || null,
      produtos_do_briefing: briefingProdutos,
      inventario,
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
