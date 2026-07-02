// Escaneia o ecossistema completo de um produto dentro de um projeto.
// Retorna: nodes/edges pra canvas + gaps + score, e permite salvar snapshot.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type NodeKind =
  | "site" | "vsl" | "lp" | "checkout" | "orderbump" | "upsell" | "downsell"
  | "email" | "whatsapp" | "instagram" | "flow" | "creative" | "avatar";

interface EcoNode {
  id: string;
  kind: NodeKind;
  label: string;
  status: "ok" | "faltando" | "fraco";
  count?: number;
  meta?: Record<string, unknown>;
  x?: number; y?: number;
}
interface EcoEdge { from: string; to: string; label?: string }

const LANES: Record<NodeKind, { x: number; y: number }> = {
  avatar:     { x: 60,   y: 40 },
  creative:   { x: 60,   y: 200 },
  instagram:  { x: 60,   y: 360 },
  site:       { x: 340,  y: 40 },
  vsl:        { x: 340,  y: 200 },
  lp:         { x: 340,  y: 360 },
  checkout:   { x: 640,  y: 200 },
  orderbump:  { x: 640,  y: 60 },
  upsell:     { x: 940,  y: 60 },
  downsell:   { x: 940,  y: 200 },
  whatsapp:   { x: 640,  y: 360 },
  email:      { x: 940,  y: 360 },
  flow:       { x: 1240, y: 200 },
};

function laneCoords(kind: NodeKind, idx: number) {
  const base = LANES[kind];
  return { x: base.x, y: base.y + idx * 100 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const action = body?.action || "scan";

    const auth = req.headers.get("Authorization") || "";
    const { data: u } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    if (!u?.user?.id) throw new Error("Não autenticado");

    // ── SAVE / APPROVE ──────────────────────────────────────────
    if (action === "save" || action === "approve") {
      const { project_id, produto_nome, snapshot, gaps, score } = body;
      if (!project_id || !produto_nome) throw new Error("project_id e produto_nome obrigatórios");

      await sb.from("imphq_product_blueprints")
        .update({ is_current: false })
        .eq("project_id", project_id).eq("produto_nome", produto_nome);

      const { data: last } = await sb.from("imphq_product_blueprints")
        .select("versao").eq("project_id", project_id).eq("produto_nome", produto_nome)
        .order("versao", { ascending: false }).limit(1).maybeSingle();
      const versao = ((last as any)?.versao || 0) + 1;

      const row: any = {
        project_id, produto_nome, versao,
        snapshot: snapshot || {}, gaps: gaps || [], score: score || 0,
        is_current: true, created_by: u.user.id,
      };
      if (action === "approve") {
        row.approved_by = u.user.id;
        row.approved_at = new Date().toISOString();
      }
      const { data: saved, error } = await sb.from("imphq_product_blueprints")
        .insert(row).select().single();
      if (error) throw error;
      return json({ ok: true, blueprint: saved });
    }

    // ── SCAN ────────────────────────────────────────────────────
    const { project_id, produto_nome } = body;
    if (!project_id) throw new Error("project_id obrigatório");
    const prodLower = (produto_nome || "").toLowerCase();

    // Projeto (avatar + briefing)
    const { data: proj } = await sb.from("imphq_projects")
      .select("data, avatar, name").eq("id", project_id).maybeSingle();
    const projData = (proj?.data as any) || {};
    const briefingProdutos: any[] = Array.isArray(projData?.briefing?.produtos)
      ? projData.briefing.produtos : Array.isArray(projData?.produtos) ? projData.produtos : [];
    const avatarPorProduto = projData?.avatares_por_produto || projData?.briefing?.avatares_por_produto || {};
    const hasAvatar = !!(proj?.avatar || projData?.avatar || (produto_nome && avatarPorProduto?.[produto_nome]));

    // Blueprint anterior (se existir)
    const { data: lastBp } = await sb.from("imphq_product_blueprints")
      .select("*").eq("project_id", project_id).eq("produto_nome", produto_nome || "")
      .eq("is_current", true).maybeSingle();

    // Paralelo: sites, fluxos, WA campaigns, WA providers, IG triggers, emails, criativos, swipes
    const [sitesR, flowsR, waCampR, waProvR, igTrigR, nurtureR, creativesR, swipesR, hubR] = await Promise.all([
      sb.from("imphq_sites").select("id, url, tipo, produto_nome, titulo, screenshot_url").eq("project_id", project_id) as any,
      sb.from("imphq_flow_blueprints").select("id, title, produto_nome, source").eq("project_id", project_id) as any,
      sb.from("imphq_wa_campaigns").select("id, name, produto_nome, status").eq("project_id", project_id) as any,
      sb.from("imphq_wa_providers").select("id, nome, ativo").eq("project_id", project_id) as any,
      sb.from("imphq_ig_comment_triggers").select("id, palavra_chave, dm_message, produto_nome").eq("project_id", project_id) as any,
      sb.from("imphq_nurture_sequences").select("id, nome, produto_nome").eq("project_id", project_id) as any,
      sb.from("imphq_creative_assets").select("id, kind, produto_nome").eq("project_id", project_id) as any,
      sb.from("imphq_swipes").select("id, title, formato").eq("project_id", project_id) as any,
      sb.from("imphq_funis").select("id, data").eq("project_id", project_id).eq("tipo", "hub").maybeSingle() as any,
    ]);

    const matchProd = (v: any) =>
      !prodLower || !v ? true : String(v).toLowerCase().includes(prodLower);

    const sites = (sitesR.data || []).filter((s: any) => matchProd(s.produto_nome) || matchProd(s.titulo));
    const flows = (flowsR.data || []).filter((f: any) => matchProd(f.produto_nome) || matchProd(f.title));
    const waCamps = (waCampR.data || []).filter((c: any) => matchProd(c.produto_nome) || matchProd(c.name));
    const waProviders = (waProvR.data || []);
    const igTrigs = (igTrigR.data || []).filter((t: any) =>
      matchProd(t.produto_nome) || matchProd(t.palavra_chave) || matchProd(t.dm_message));
    const nurture = (nurtureR.data || []).filter((n: any) => matchProd(n.produto_nome) || matchProd(n.nome));
    const creatives = (creativesR.data || []).filter((c: any) => matchProd(c.produto_nome));
    const swipes = (swipesR.data || []).filter((s: any) => matchProd(s.title));

    const nodes: EcoNode[] = [];
    const edges: EcoEdge[] = [];

    // Avatar
    nodes.push({
      id: "avatar", kind: "avatar", label: "Avatar",
      status: hasAvatar ? "ok" : "faltando",
      ...laneCoords("avatar", 0),
    });

    // Sites — separa por tipo
    const bucketByTipo: Record<string, any[]> = {};
    for (const s of sites) {
      const tipo = String(s.tipo || "site").toLowerCase();
      (bucketByTipo[tipo] ||= []).push(s);
    }
    const pushSite = (kind: NodeKind, list: any[], defaultLabel: string) => {
      list.forEach((s, i) => {
        nodes.push({
          id: `${kind}-${s.id}`, kind, label: s.titulo || defaultLabel,
          status: "ok", meta: { url: s.url, screenshot: s.screenshot_url },
          ...laneCoords(kind, i),
        });
      });
    };
    pushSite("vsl", bucketByTipo["vsl"] || [], "VSL");
    pushSite("lp", bucketByTipo["lp"] || bucketByTipo["landing"] || [], "Landing Page");
    pushSite("checkout", bucketByTipo["checkout"] || [], "Checkout");
    pushSite("orderbump", bucketByTipo["orderbump"] || bucketByTipo["order-bump"] || [], "Order Bump");
    pushSite("upsell", bucketByTipo["upsell"] || [], "Upsell");
    pushSite("downsell", bucketByTipo["downsell"] || [], "Downsell");
    // sites sem tipo mapeado → genéricos
    const restSites = sites.filter((s: any) => !["vsl","lp","landing","checkout","orderbump","order-bump","upsell","downsell"].includes(String(s.tipo || "").toLowerCase()));
    restSites.forEach((s: any, i: number) => {
      nodes.push({ id: `site-${s.id}`, kind: "site", label: s.titulo || s.url, status: "ok", meta: { url: s.url }, ...laneCoords("site", i) });
    });

    // Nós esperados que faltam (gaps críticos por tipo)
    const has = (k: NodeKind) => nodes.some((n) => n.kind === k);
    (["vsl","lp","checkout","orderbump","upsell"] as NodeKind[]).forEach((k, i) => {
      if (!has(k)) {
        nodes.push({
          id: `missing-${k}`, kind: k,
          label: `${labelFor(k)} (faltando)`,
          status: "faltando", ...laneCoords(k, 0),
        });
      }
    });

    // WhatsApp
    if (waCamps.length || waProviders.length) {
      waCamps.slice(0, 3).forEach((c: any, i: number) => {
        nodes.push({
          id: `wa-${c.id}`, kind: "whatsapp",
          label: `WA: ${c.name || "Campanha"}`,
          status: "ok", meta: { status: c.status },
          ...laneCoords("whatsapp", i),
        });
      });
      if (!waCamps.length) {
        nodes.push({ id: "wa-missing", kind: "whatsapp", label: "Sequência WA (faltando)", status: "faltando", ...laneCoords("whatsapp", 0) });
      }
    } else {
      nodes.push({ id: "wa-missing", kind: "whatsapp", label: "WhatsApp (faltando)", status: "faltando", ...laneCoords("whatsapp", 0) });
    }

    // Instagram
    if (igTrigs.length) {
      igTrigs.slice(0, 3).forEach((t: any, i: number) => {
        nodes.push({
          id: `ig-${t.id}`, kind: "instagram",
          label: `IG: ${t.palavra_chave || "gatilho"}`,
          status: "ok", ...laneCoords("instagram", i),
        });
      });
    } else {
      nodes.push({ id: "ig-missing", kind: "instagram", label: "Gatilho IG (faltando)", status: "faltando", ...laneCoords("instagram", 0) });
    }

    // Emails
    if (nurture.length) {
      nurture.slice(0, 3).forEach((n: any, i: number) => {
        nodes.push({ id: `email-${n.id}`, kind: "email", label: `Email: ${n.nome || "Sequência"}`, status: "ok", ...laneCoords("email", i) });
      });
    } else {
      nodes.push({ id: "email-missing", kind: "email", label: "Emails (faltando)", status: "faltando", ...laneCoords("email", 0) });
    }

    // Fluxos OpenFlow
    if (flows.length) {
      flows.slice(0, 3).forEach((f: any, i: number) => {
        nodes.push({ id: `flow-${f.id}`, kind: "flow", label: `Flow: ${f.title || "Fluxo"}`, status: "ok", ...laneCoords("flow", i) });
      });
    } else {
      nodes.push({ id: "flow-missing", kind: "flow", label: "Fluxo pós-venda (faltando)", status: "faltando", ...laneCoords("flow", 0) });
    }

    // Criativos
    if (creatives.length) {
      nodes.push({ id: "creatives", kind: "creative", label: `${creatives.length} criativos`, status: "ok", count: creatives.length, ...laneCoords("creative", 0) });
    } else {
      nodes.push({ id: "creatives-missing", kind: "creative", label: "Criativos (faltando)", status: "faltando", ...laneCoords("creative", 0) });
    }

    // Arestas canônicas (avatar → tudo; site principal → checkout → wa/email/flow)
    edges.push({ from: "avatar", to: "creatives" });
    const vslNode = nodes.find((n) => n.kind === "vsl");
    const lpNode = nodes.find((n) => n.kind === "lp");
    const coNode = nodes.find((n) => n.kind === "checkout");
    if (vslNode && coNode) edges.push({ from: vslNode.id, to: coNode.id });
    if (lpNode && coNode) edges.push({ from: lpNode.id, to: coNode.id, label: "checkout" });
    if (coNode) {
      const obN = nodes.find((n) => n.kind === "orderbump");
      const upN = nodes.find((n) => n.kind === "upsell");
      const dwN = nodes.find((n) => n.kind === "downsell");
      const waN = nodes.find((n) => n.kind === "whatsapp");
      const emN = nodes.find((n) => n.kind === "email");
      const flN = nodes.find((n) => n.kind === "flow");
      if (obN) edges.push({ from: coNode.id, to: obN.id, label: "OB" });
      if (upN) edges.push({ from: coNode.id, to: upN.id, label: "upsell" });
      if (dwN) edges.push({ from: upN?.id || coNode.id, to: dwN.id, label: "downsell" });
      if (waN) edges.push({ from: coNode.id, to: waN.id, label: "recovery" });
      if (emN) edges.push({ from: coNode.id, to: emN.id, label: "aprovada" });
      if (flN) edges.push({ from: coNode.id, to: flN.id, label: "pós-venda" });
    }

    // Gaps → cards acionáveis
    const gapMap: Record<string, { label: string; action: string; endpoint?: string }> = {
      avatar:    { label: "Mapear Avatar", action: "gerar_avatar" },
      vsl:       { label: "Gerar roteiro de VSL", action: "gerar_vsl" },
      lp:        { label: "Gerar Landing Page", action: "gerar_lp" },
      checkout:  { label: "Configurar Checkout", action: "config_checkout" },
      orderbump: { label: "Criar Order Bump", action: "gerar_orderbump" },
      upsell:    { label: "Criar Upsell", action: "gerar_upsell" },
      whatsapp:  { label: "Criar sequência WhatsApp X1", action: "gerar_wa" },
      instagram: { label: "Criar gatilho de IG", action: "gerar_ig" },
      email:     { label: "Criar sequência de emails", action: "gerar_emails" },
      flow:      { label: "Montar fluxo pós-venda", action: "gerar_flow" },
      creative:  { label: "Gerar criativos", action: "gerar_criativos" },
    };
    const gaps = nodes
      .filter((n) => n.status === "faltando")
      .map((n) => ({
        node_id: n.id, kind: n.kind, ...gapMap[n.kind]
      }));

    const total = nodes.length;
    const okCount = nodes.filter((n) => n.status === "ok").length;
    const score = total ? Math.round((okCount / total) * 100) : 0;

    return json({
      project_id, produto_nome,
      project_name: proj?.name,
      briefing_produtos: briefingProdutos.map((p: any) => p.nome || p.name).filter(Boolean),
      nodes, edges, gaps, score,
      current_blueprint: lastBp || null,
      counts: {
        sites: sites.length, flows: flows.length, wa: waCamps.length,
        ig: igTrigs.length, emails: nurture.length, criativos: creatives.length,
        swipes: swipes.length,
      },
    });
  } catch (e: any) {
    console.error("[product-ecosystem-scan]", e);
    return json({ error: String(e?.message || e) }, 400);
  }
});

function labelFor(k: NodeKind): string {
  const M: Record<NodeKind, string> = {
    avatar: "Avatar", site: "Site", vsl: "VSL", lp: "Landing Page",
    checkout: "Checkout", orderbump: "Order Bump", upsell: "Upsell", downsell: "Downsell",
    whatsapp: "WhatsApp", instagram: "Instagram", email: "Emails", flow: "Fluxo", creative: "Criativos",
  };
  return M[k] || k;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
