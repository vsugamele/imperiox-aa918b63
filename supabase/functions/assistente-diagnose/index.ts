// Diagnóstico do Assistente: calcula checklist + gargalos + score por área (campanhas, lançamento, nutrição).
// Input: { project_id: string, area?: "campanhas"|"lancamento"|"nutricao"|"all", force?: boolean }
// Output: { results: [{ area, score, checklist, gargalos, next_action }] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface FrameworkItem { key: string; label: string; weight: number; }
const FRAMEWORKS: Record<string, FrameworkItem[]> = {
  campanhas: [
    { key: "welcome", label: "Mensagem de boas-vindas", weight: 10 },
    { key: "aquecimento", label: "Sequência de aquecimento (3+ msgs)", weight: 15 },
    { key: "cta_checkout", label: "CTA direto para checkout", weight: 15 },
    { key: "recovery", label: "Recuperação de PIX/boleto", weight: 15 },
    { key: "upsell", label: "Upsell pós-compra", weight: 10 },
    { key: "delays", label: "Anti-spam (delays e janela de envio)", weight: 10 },
    { key: "provider", label: "Provider WhatsApp configurado", weight: 15 },
    { key: "variacoes", label: "Variações A/B de copy", weight: 10 },
  ],
  lancamento: [
    { key: "avatar", label: "Avatar definido", weight: 10 },
    { key: "mecanismo", label: "Mecanismo único", weight: 10 },
    { key: "captura", label: "Página de captura", weight: 10 },
    { key: "aquecimento", label: "Sequência de aquecimento", weight: 10 },
    { key: "cpl", label: "CPL / Webinar / Evento ao vivo", weight: 10 },
    { key: "carta", label: "Carta de vendas", weight: 10 },
    { key: "carrinho", label: "Sequência de carrinho aberto", weight: 10 },
    { key: "recovery", label: "Recovery de carrinho", weight: 10 },
    { key: "posvenda", label: "Pós-venda e ascensão", weight: 10 },
    { key: "metas", label: "Meta diária definida", weight: 10 },
  ],
  nutricao: [
    { key: "ativa", label: "Sequência ativa", weight: 20 },
    { key: "cadencia", label: "Cadência definida", weight: 15 },
    { key: "minimo_emails", label: "Pelo menos 12 e-mails", weight: 15 },
    { key: "tags", label: "Tags de filtro configuradas", weight: 10 },
    { key: "templates", label: "Templates por estágio", weight: 15 },
    { key: "tracking", label: "Tracking de conversão", weight: 15 },
    { key: "reativacao", label: "Reativação 90d", weight: 10 },
  ],
};

function buildChecklist(area: string, signals: Record<string, boolean>) {
  return FRAMEWORKS[area].map((it) => ({
    key: it.key, label: it.label, weight: it.weight, done: !!signals[it.key],
  }));
}
function scoreOf(checklist: any[]) {
  return checklist.reduce((s, i) => s + (i.done ? i.weight : 0), 0);
}

async function diagCampanhas(sb: any, project_id: string) {
  const [{ data: camps }, { data: steps }, { data: providers }] = await Promise.all([
    sb.from("imphq_wa_campaigns").select("id,welcome_message,exit_message,status,provider_id").eq("project_id", project_id),
    sb.from("imphq_wa_campaign_steps").select("id,campaign_id,content,content_b,days_offset").in("campaign_id", []),
    sb.from("imphq_wa_providers").select("id,project_id").eq("project_id", project_id).limit(1),
  ]);
  const campIds = (camps || []).map((c: any) => c.id);
  let allSteps: any[] = [];
  if (campIds.length) {
    const { data: s2 } = await sb.from("imphq_wa_campaign_steps").select("*").in("campaign_id", campIds);
    allSteps = s2 || [];
  }
  const sig: Record<string, boolean> = {
    welcome: (camps || []).some((c: any) => !!c.welcome_message),
    aquecimento: allSteps.length >= 3,
    cta_checkout: allSteps.some((s: any) => /checkout|comprar|pagar|garanta|vaga/i.test(s.content || "")),
    recovery: allSteps.some((s: any) => /pix|boleto|carrinho|abandonou/i.test(s.content || "")),
    upsell: allSteps.some((s: any) => /upsell|order ?bump|oferta extra/i.test(s.content || "")),
    delays: allSteps.some((s: any) => s.days_offset > 0),
    provider: (providers || []).length > 0,
    variacoes: allSteps.some((s: any) => !!s.content_b),
  };
  const checklist = buildChecklist("campanhas", sig);
  const gargalos: any[] = [];
  if (!sig.provider) gargalos.push({ titulo: "Sem provider WhatsApp", desc: "Configure um chip antes de qualquer envio.", impacto: "alto" });
  if ((camps || []).length === 0) gargalos.push({ titulo: "Nenhuma campanha criada", desc: "Crie a primeira campanha (welcome + aquecimento + CTA).", impacto: "alto" });
  if (!sig.recovery) gargalos.push({ titulo: "Sem recuperação de PIX/boleto", desc: "Adicione 2-3 mensagens de cobrança para PIX pendente.", impacto: "alto" });
  if (!sig.variacoes) gargalos.push({ titulo: "Sem A/B de copy", desc: "Adicione variações B para os 3 passos principais.", impacto: "medio" });
  const checklistScore = scoreOf(checklist);
  const next = !sig.provider ? "Configurar provider WhatsApp" : !camps?.length ? "Criar primeira campanha com IA" : !sig.recovery ? "Adicionar mensagens de recovery" : "Otimizar copy com variações A/B";
  return { area: "campanhas", score: checklistScore, checklist, gargalos: gargalos.slice(0, 5), next_action: next };
}

async function diagLancamento(sb: any, project_id: string) {
  const [{ data: proj }, { data: forms }, { data: camps }, { data: kanbanCols }] = await Promise.all([
    sb.from("imphq_projects").select("avatar,settings,daily_revenue_goal").eq("id", project_id).maybeSingle(),
    sb.from("imphq_lead_forms").select("id").eq("project_id", project_id).limit(5),
    sb.from("imphq_campaigns").select("id,data,funil,produto").eq("project_id", project_id),
    sb.from("imphq_kanban_columns").select("id,title").eq("project_id", project_id),
  ]);
  const avatarOk = !!proj?.avatar && Object.keys(proj.avatar || {}).length > 2;
  const settings = proj?.settings || {};
  const cks = (camps || []).reduce((acc: any, c: any) => { acc[c.funil || "x"] = true; return acc; }, {});
  const sig: Record<string, boolean> = {
    avatar: avatarOk,
    mecanismo: !!settings.mecanismo || !!settings.mecanismo_unico,
    captura: (forms || []).length > 0 || !!cks.aquisicao,
    aquecimento: !!cks.aquisicao || !!cks.conversao,
    cpl: !!settings.cpl_url || (camps || []).some((c: any) => /cpl|webinar|evento/i.test(c?.data?.tipo || "")),
    carta: !!settings.sales_page_url || (camps || []).some((c: any) => /carta|vsl/i.test(c?.data?.tipo || "")),
    carrinho: !!cks.conversao,
    recovery: (camps || []).some((c: any) => /recuper|abando/i.test(c?.data?.objetivo || "")),
    posvenda: !!cks.maximizacao || !!cks.retencao,
    metas: Number(proj?.daily_revenue_goal || 0) > 0,
  };
  const checklist = buildChecklist("lancamento", sig);
  const gargalos: any[] = [];
  if (!sig.avatar) gargalos.push({ titulo: "Avatar incompleto", desc: "Sem avatar definido, copy fica genérica e CPL sobe.", impacto: "alto" });
  if (!sig.captura) gargalos.push({ titulo: "Sem página de captura", desc: "Funil precisa de entrada. Crie um formulário de captura.", impacto: "alto" });
  if (!sig.carrinho) gargalos.push({ titulo: "Falta sequência de carrinho", desc: "Adicione campanha de conversão (carrinho aberto).", impacto: "alto" });
  if (!sig.metas) gargalos.push({ titulo: "Sem meta diária", desc: "Defina daily_revenue_goal para medir progresso.", impacto: "medio" });
  const next = !sig.avatar ? "Construir avatar com IA" : !sig.captura ? "Criar formulário de captura" : !sig.carrinho ? "Criar campanha de carrinho com IA" : "Estruturar pós-venda";
  return { area: "lancamento", score: scoreOf(checklist), checklist, gargalos: gargalos.slice(0, 5), next_action: next };
}

async function diagNutricao(sb: any, project_id: string) {
  const [{ data: seqs }] = await Promise.all([
    sb.from("imphq_nurture_sequences").select("*").eq("project_id", project_id),
  ]);
  const seqIds = (seqs || []).map((s: any) => s.id);
  let emails: any[] = [];
  if (seqIds.length) {
    const { data } = await sb.from("imphq_nurture_emails").select("sequence_id,estagio,aberto_em,clicado_em,enviado_em").in("sequence_id", seqIds).limit(5000);
    emails = data || [];
  }
  const ativa = (seqs || []).some((s: any) => s.ativa);
  const emailsPorSeq: Record<string, number> = {};
  emails.forEach((e: any) => { emailsPorSeq[e.sequence_id] = (emailsPorSeq[e.sequence_id] || 0) + 1; });
  const estagios = new Set(emails.map((e: any) => e.estagio).filter(Boolean));
  const aberturas = emails.filter((e: any) => e.aberto_em).length;
  const enviados = emails.filter((e: any) => e.enviado_em).length;
  const taxaAbertura = enviados > 0 ? aberturas / enviados : 0;

  const sig: Record<string, boolean> = {
    ativa,
    cadencia: (seqs || []).some((s: any) => !!s.cadencia),
    minimo_emails: Object.values(emailsPorSeq).some((n) => n >= 12),
    tags: (seqs || []).some((s: any) => (s.filter_tags || []).length > 0),
    templates: estagios.size >= 2,
    tracking: (seqs || []).some((s: any) => Number(s.total_conversoes || 0) > 0 || Number(s.receita_atribuida || 0) > 0),
    reativacao: (seqs || []).some((s: any) => /reativ|90d|inativo|frio/i.test(`${s.nome} ${s.objetivo || ""}`)),
  };
  const checklist = buildChecklist("nutricao", sig);
  const gargalos: any[] = [];
  if ((seqs || []).length === 0) gargalos.push({ titulo: "Nenhuma sequência criada", desc: "Crie a primeira sequência de nutrição com IA.", impacto: "alto" });
  if (!ativa && seqs?.length) gargalos.push({ titulo: "Sequências pausadas", desc: "Ative as sequências para começar a nutrir.", impacto: "alto" });
  if (enviados > 50 && taxaAbertura < 0.15) gargalos.push({ titulo: `Taxa de abertura baixa (${(taxaAbertura * 100).toFixed(0)}%)`, desc: "Reescreva assuntos com IA. Meta: 25%+.", impacto: "alto" });
  if (!sig.minimo_emails) gargalos.push({ titulo: "Sequências curtas", desc: "Expanda para 12+ e-mails (1 ano de relacionamento).", impacto: "medio" });
  if (!sig.tracking) gargalos.push({ titulo: "Sem conversões atribuídas", desc: "Configure UTMs e tracking de receita.", impacto: "medio" });
  const next = !seqs?.length ? "Criar sequência de nutrição com IA" : !ativa ? "Ativar sequências" : !sig.minimo_emails ? "Expandir sequência com IA" : "Reescrever assuntos para subir abertura";
  return { area: "nutricao", score: scoreOf(checklist), checklist, gargalos: gargalos.slice(0, 5), next_action: next };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { project_id, area = "all", force = false } = await req.json();
    if (!project_id) throw new Error("project_id obrigatório");
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    if (!force) {
      const { data: cached } = await sb.from("imphq_assistente_diagnostics")
        .select("*").eq("project_id", project_id)
        .gte("calculated_at", new Date(Date.now() - 6 * 3600 * 1000).toISOString());
      if (cached && cached.length) {
        const filtered = area === "all" ? cached : cached.filter((c: any) => c.area === area);
        if (filtered.length === (area === "all" ? 3 : 1)) {
          return new Response(JSON.stringify({ results: filtered, cached: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const areas = area === "all" ? ["campanhas", "lancamento", "nutricao"] : [area];
    const results: any[] = [];
    for (const a of areas) {
      let r;
      if (a === "campanhas") r = await diagCampanhas(sb, project_id);
      else if (a === "lancamento") r = await diagLancamento(sb, project_id);
      else r = await diagNutricao(sb, project_id);
      await sb.from("imphq_assistente_diagnostics").upsert({
        project_id, area: a, score: r.score, checklist: r.checklist,
        gargalos: r.gargalos, next_action: r.next_action, calculated_at: new Date().toISOString(),
      }, { onConflict: "project_id,area" });
      results.push(r);
    }

    return new Response(JSON.stringify({ results, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("assistente-diagnose:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
