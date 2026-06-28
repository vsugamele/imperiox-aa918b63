import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Y bands per memory
const Y_AQ = 80;
const Y_LP = 240;
const Y_CV = 400;
const Y_MX = 720;
const Y_RT = 1040;
const COL_W = 320;

type Etapa = {
  nome: string;
  tipo?: string;
  visitantes: number;
  conversoes: number;
  url?: string;
  pos_x?: number;
  pos_y?: number;
  descricao?: string;
  connects_to?: number[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { project_id, funil_id, mode = "preview" } = await req.json();
    if (!project_id) throw new Error("project_id obrigatório");

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Coletar dados em paralelo
    const [projRes, flowsRes, waCampRes, emailSeqRes, projSitesRes, adsRes, capFormsRes] =
      await Promise.all([
        sb.from("imphq_projects").select("id,name,briefing").eq("id", project_id).maybeSingle(),
        sb.from("imphq_flows").select("id,nome").eq("project_id", project_id),
        sb.from("imphq_wa_campaigns").select("id,name,status").eq("project_id", project_id),
        sb.from("imphq_nurture_sequences").select("id,nome").eq("project_id", project_id),
        sb.from("imphq_project_sites").select("site_id,papel").eq("projeto_id", project_id),
        sb.from("imphq_ads_spend").select("campaign_name,project_id").eq("project_id", project_id).limit(20),
        sb.from("imphq_capture_forms").select("id,nome").eq("project_id", project_id),
      ]);

    const project = projRes.data;
    const briefing =
      typeof project?.briefing === "string" ? JSON.parse(project.briefing) : (project?.briefing || {});
    const produtos: any[] = briefing?.produtos || [];

    const flows = flowsRes.data || [];
    const waCamp = waCampRes.data || [];
    const emailSeq = emailSeqRes.data || [];
    const projSites = projSitesRes.data || [];

    // Hidratar sites a partir dos site_ids
    const siteIds = projSites.map((p: any) => p.site_id).filter(Boolean);
    let sites: any[] = [];
    if (siteIds.length > 0) {
      const { data } = await sb
        .from("imphq_sites")
        .select("id,titulo,url,tipo")
        .in("id", siteIds);
      sites = data || [];
    }
    const adsCampaigns = Array.from(
      new Set((adsRes.data || []).map((a: any) => a.campaign_name).filter(Boolean))
    ).slice(0, 5);
    const capForms = capFormsRes.data || [];

    const detected = {
      produtos: produtos.length,
      flows: flows.length,
      wa_campaigns: waCamp.length,
      email_sequences: emailSeq.length,
      sites: sites.length,
      ads_campaigns: adsCampaigns.length,
      capture_forms: capForms.length,
    };

    if (mode === "detect") {
      return new Response(JSON.stringify({ detected, project_name: project?.name || "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Construir etapas
    const etapas: Etapa[] = [];

    // === AQUISIÇÃO (y=80) ===
    let x = 80;
    adsCampaigns.forEach((name: string) => {
      etapas.push({
        nome: name.length > 40 ? name.slice(0, 38) + "…" : name,
        tipo: "face_ads",
        visitantes: 0,
        conversoes: 0,
        pos_x: x,
        pos_y: Y_AQ,
        descricao: "Campanha de tráfego",
      });
      x += COL_W;
    });
    if (adsCampaigns.length === 0) {
      etapas.push({ nome: "Tráfego", tipo: "face_ads", visitantes: 0, conversoes: 0, pos_x: x, pos_y: Y_AQ });
      x += COL_W;
    }

    // === LP / Captura (y=240) ===
    let lpX = 80;
    const lpStartIdx = etapas.length;
    const lpSites = sites.slice(0, 4);
    lpSites.forEach((s: any) => {
      const tipo = String(s.tipo || "").toLowerCase();
      const mappedTipo = tipo.includes("vsl") ? "vsl" : tipo.includes("check") ? "checkout" : "pagina";
      etapas.push({
        nome: s.titulo || s.url || "Página",
        tipo: mappedTipo,
        visitantes: 0,
        conversoes: 0,
        url: s.url,
        pos_x: lpX,
        pos_y: Y_LP,
        descricao: "Página do projeto",
      });
      lpX += COL_W;
    });
    capForms.slice(0, 2).forEach((c: any) => {
      etapas.push({
        nome: c.nome || "Captura",
        tipo: "pagina",
        visitantes: 0,
        conversoes: 0,
        url: c.url,
        pos_x: lpX,
        pos_y: Y_LP,
        descricao: "Formulário de captura",
      });
      lpX += COL_W;
    });
    if (lpStartIdx === etapas.length) {
      etapas.push({ nome: "Landing Page", tipo: "pagina", visitantes: 0, conversoes: 0, pos_x: 80, pos_y: Y_LP });
    }

    // Conectar Aquisição -> primeira LP
    const lpFirstIdx = lpStartIdx;
    for (let i = 0; i < lpStartIdx; i++) {
      etapas[i].connects_to = [lpFirstIdx];
    }

    // === CONVERSÃO (y=400) — produtos ===
    let cvX = 80;
    const cvStartIdx = etapas.length;
    const sortTipo = (t: string) => {
      const x = (t || "").toLowerCase();
      if (x.includes("principal") || x === "front") return 0;
      if (x.includes("order")) return 1;
      if (x.includes("upsell")) return 2;
      if (x.includes("down")) return 3;
      return 4;
    };
    const prodSorted = [...produtos].sort(
      (a, b) => sortTipo(a.tipo_oferta || a.tipo) - sortTipo(b.tipo_oferta || b.tipo)
    );
    prodSorted.forEach((p: any) => {
      const t = String(p.tipo_oferta || p.tipo || "").toLowerCase();
      const mapped = t.includes("order")
        ? "upsell"
        : t.includes("upsell")
        ? "upsell"
        : t.includes("down")
        ? "upsell"
        : "checkout";
      etapas.push({
        nome: p.nome || p.name || "Produto",
        tipo: mapped,
        visitantes: 0,
        conversoes: 0,
        url: p.ofertas?.[0]?.link || p.link || p.url,
        pos_x: cvX,
        pos_y: Y_CV,
        descricao: `${p.tipo_oferta || p.tipo || ""} ${p.preco_por || p.preco || ""}`.trim(),
      });
      cvX += COL_W;
    });
    if (cvStartIdx === etapas.length) {
      etapas.push({ nome: "Checkout", tipo: "checkout", visitantes: 0, conversoes: 0, pos_x: 80, pos_y: Y_CV });
    }

    // LP -> Checkout principal
    for (let i = lpStartIdx; i < cvStartIdx; i++) {
      etapas[i].connects_to = [cvStartIdx];
    }
    // encadear orderbump/upsell/down em sequência
    for (let i = cvStartIdx; i < etapas.length - 1; i++) {
      etapas[i].connects_to = [i + 1];
    }
    const lastCvIdx = etapas.length - 1;

    // === MAXIMIZAÇÃO (y=720) — automações pós-venda ===
    let mxX = 80;
    const mxStartIdx = etapas.length;
    flows.slice(0, 4).forEach((f: any) => {
      etapas.push({
        nome: f.name || "Fluxo",
        tipo: "whatsapp",
        visitantes: 0,
        conversoes: 0,
        pos_x: mxX,
        pos_y: Y_MX,
        descricao: "OpenFlow vinculado",
      });
      mxX += COL_W;
    });
    waCamp.slice(0, 2).forEach((c: any) => {
      etapas.push({
        nome: c.nome || "Campanha WA",
        tipo: "whatsapp",
        visitantes: 0,
        conversoes: 0,
        pos_x: mxX,
        pos_y: Y_MX,
        descricao: "Broadcast WhatsApp",
      });
      mxX += COL_W;
    });
    emailSeq.slice(0, 3).forEach((s: any) => {
      etapas.push({
        nome: s.nome || "Sequência email",
        tipo: "email",
        visitantes: 0,
        conversoes: 0,
        pos_x: mxX,
        pos_y: Y_MX,
        descricao: "Nurture e-mail",
      });
      mxX += COL_W;
    });

    // Checkout -> automações
    if (mxStartIdx > cvStartIdx && etapas.length > mxStartIdx) {
      etapas[lastCvIdx].connects_to = Array.from(
        { length: etapas.length - mxStartIdx },
        (_, i) => mxStartIdx + i
      );
    }

    // === RETENÇÃO (y=1040) ===
    const retIdx = etapas.length;
    etapas.push({
      nome: "Aluno / Comunidade",
      tipo: "outro",
      visitantes: 0,
      conversoes: 0,
      pos_x: 80,
      pos_y: Y_RT,
      descricao: "Pós-venda · entrega",
    });
    for (let i = mxStartIdx; i < retIdx; i++) {
      etapas[i].connects_to = [retIdx];
    }

    // Snapshot do estado anterior se houver funil
    if (funil_id && mode === "apply") {
      const { data: cur } = await sb.from("imphq_funis").select("data,project_id").eq("id", funil_id).maybeSingle();
      if (cur?.data) {
        await sb.from("imphq_funnel_snapshots").insert([
          {
            projeto_id: (cur as any).project_id || project_id,
            funil_id,
            label: `Auto-backup antes de Montar Automático ${new Date().toLocaleString("pt-BR")}`,
            motivo: "auto_before_autobuild",
            canvas: (cur as any).data,
          },
        ]);
      }
      await sb.from("imphq_funis").update({ data: { etapas } as any }).eq("id", funil_id);
    }

    return new Response(
      JSON.stringify({ etapas, detected, project_name: project?.name || "" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
