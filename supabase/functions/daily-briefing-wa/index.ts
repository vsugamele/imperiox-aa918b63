// Envia o briefing diário via WhatsApp por projeto para usuários com wa_briefing_enabled = true
// e cuja hora preferida bate com a hora atual (BRT), ou on-demand via target_jid.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildTodayBoard, type BoardNode } from "../_shared/today-board.ts";
import { buildTeamDaySection } from "../_shared/team-day.ts";
import { localDate, type TeamMember } from "../_shared/map-steps.ts";
import { liveBriefingLine, type LiveBriefingSnapshot } from "../_shared/live-panel.ts";

interface RecoveryData {
  phone?: string | null;
  telefone?: string | null;
  nome?: unknown;
  name?: unknown;
  email?: unknown;
}

interface BriefingSale {
  id: string;
  project_id: string | null;
  valor: number | null;
  status: string | null;
  produto_nome: string | null;
  data_venda: string | null;
  created_at: string | null;
  nome: string | null;
  lead_id: string | null;
  data: RecoveryData | null;
}

interface RecoveryLead {
  id: string;
  nome: string | null;
  phone: string | null;
  email: string | null;
}

interface RecoveryConversation {
  id: string;
  phone: string;
  status: string;
  last_message_at: string | null;
  ia_ativa: boolean | null;
  message_count: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("IMPERIO_APP_URL") || "https://imperiox.vercel.app";

/**
 * Seção "Dia de cada um" (UX1.2): etapas dos mapas por responsável, mesma regra da tela Hoje.
 * Falha aqui não derruba o briefing: a seção só fica de fora.
 */
async function buildTeamDay(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  try {
    const [projRes, nodesRes, archivedRes, teamRes] = await Promise.all([
      supabase.from("imphq_projects").select("id, name").or("is_archived.eq.false,is_archived.is.null"),
      supabase.from("imphq_company_map_nodes")
        .select("id, map_id, label, kind, description, notes, checklist, position, executor_type, linked_skill_id, linked_project_id, stage_role, step_status, owner_member_id, due_date"),
      supabase.from("imphq_company_maps").select("id").not("archived_at", "is", null),
      supabase.from("imphq_team_members").select("id, name, email, user_id").or("is_active.eq.true,is_active.is.null").order("created_at"),
    ]);
    for (const res of [projRes, nodesRes, archivedRes, teamRes]) if (res.error) throw res.error;
    const archived = new Set((archivedRes.data || []).map((m) => String(m.id)));
    // Dia de Brasília (o envio das 21h BRT já cai no dia seguinte em UTC).
    const today = localDate(new Date(Date.now() - 3 * 3600000));
    const boards = buildTodayBoard({
      projects: (projRes.data || []) as Array<{ id: string; name: string }>,
      nodes: ((nodesRes.data || []) as BoardNode[]).filter((n) => !archived.has(n.map_id)),
      salesToday: [], leadsToday: [], today,
    });
    return buildTeamDaySection(boards, (teamRes.data || []) as TeamMember[], APP_URL);
  } catch (e) {
    console.error("[daily-briefing-wa] team day section:", e instanceof Error ? e.message : String(e));
    return [];
  }
}

function brtHour() {
  const d = new Date();
  return (d.getUTCHours() - 3 + 24) % 24;
}

function brtNowStr() {
  const d = new Date();
  const brt = new Date(d.getTime() - 3 * 3600000);
  const day = String(brt.getUTCDate()).padStart(2, "0");
  const month = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const hours = String(brt.getUTCHours()).padStart(2, "0");
  const mins = String(brt.getUTCMinutes()).padStart(2, "0");
  return `${day}/${month} · ${hours}:${mins} BRT`;
}

function normalizePhone(raw: string) {
  const trimmed = (raw || "").trim();
  if (trimmed.endsWith("@g.us")) return trimmed;
  let p = trimmed.replace(/\D/g, "");
  if (!p.startsWith("55") && (p.length === 10 || p.length === 11)) p = "55" + p;
  return p;
}

function formatBrPhoneForWa(raw: string): string {
  let clean = (raw || "").replace(/\D/g, "");
  if (!clean) return "";
  if (clean.length === 10) {
    clean = "55" + clean.slice(0, 2) + "9" + clean.slice(2);
  } else if (clean.length === 11) {
    if (clean.startsWith("55")) {
      const ddd = clean.slice(2, 4);
      const rest = clean.slice(4);
      if (rest.length === 7) clean = `55${ddd}9${rest}`;
      else if (rest.length === 8 && !rest.startsWith("9")) clean = `55${ddd}9${rest}`;
    } else {
      clean = "55" + clean;
    }
  } else if (clean.length === 12 && clean.startsWith("55")) {
    const ddd = clean.slice(2, 4);
    const rest = clean.slice(4);
    if (!rest.startsWith("9")) clean = `55${ddd}9${rest}`;
  }
  return clean;
}

const PROJECT_EMOJIS: Record<string, string> = {
  jp_freitas: "💈",
  linfaflow: "🌿",
  slimsoda: "🥤",
  tatuagem: "🎨",
  laise: "✈️",
  "dr---fitness": "💪",
  lipo: "💧",
};

async function buildOperationalBriefing(supabase: ReturnType<typeof createClient>, isOnDemand: boolean) {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Projetos cadastrados
  const { data: allProjects } = await supabase
    .from("imphq_projects")
    .select("id, name, category, active, data");

  const coreIds = ["jp_freitas", "linfaflow", "slimsoda"];

  // 2. Vendas recentes (considerando data_venda real para não puxar reprocessamento histórico antigo)
  const { data: rawVendas } = await supabase
    .from("imphq_vendas")
    .select("id, project_id, valor, status, produto_nome, data_venda, created_at, nome, lead_id, data")
    .order("created_at", { ascending: false })
    .limit(100);

  const vendas24h: BriefingSale[] = (rawVendas || []).filter((v: BriefingSale) => {
    const rawTs = v.data_venda || v.created_at;
    const ts = rawTs ? new Date(rawTs).getTime() : 0;
    return ts >= (now.getTime() - 24 * 60 * 60 * 1000);
  });

  // Mapeamento enriquecido de abandonos nas 24h
  const abandonos24h = vendas24h.filter(
    (v: BriefingSale) => v.status === "carrinho_abandonado" || v.status === "pix_gerado"
  );
  const leadIds = abandonos24h.map((a: BriefingSale) => a.lead_id).filter(Boolean);
  const leadsInfoMap: Record<string, RecoveryLead | undefined> = {};
  if (leadIds.length > 0) {
    const { data: lData } = await supabase
      .from("imphq_leads")
      .select("id, nome, phone, email")
      .in("id", leadIds);
    (lData || []).forEach((l: RecoveryLead) => { leadsInfoMap[l.id] = l; });
  }

  const phoneList: string[] = [];
  abandonos24h.forEach((a: BriefingSale) => {
    const lead = a.lead_id ? leadsInfoMap[a.lead_id] : null;
    const rawP = lead?.phone || a.data?.phone || a.data?.telefone;
    if (rawP) {
      const clean = formatBrPhoneForWa(rawP);
      if (clean) phoneList.push(clean);
    }
  });

  const activeConvsMap: Record<string, RecoveryConversation | undefined> = {};
  if (phoneList.length > 0) {
    const { data: cData } = await supabase
      .from("imphq_wa_conversations")
      .select("id, phone, status, last_message_at, ia_ativa, message_count")
      .in("phone", phoneList);
    (cData || []).forEach((c: RecoveryConversation) => {
      const clean = (c.phone || "").replace(/\D/g, "");
      activeConvsMap[clean] = c;
    });
  }

  // 3. Leads nas últimas 24h
  const { data: leads24h } = await supabase
    .from("imphq_leads")
    .select("project_id, id, score, criado_em")
    .gte("criado_em", last24h);

  // 4. WhatsApp providers
  const { data: providers } = await supabase
    .from("imphq_wa_providers")
    .select("project_id, instance_name, status, is_active");

  // 5. WhatsApp AI Config
  const { data: aiConfigs } = await supabase
    .from("imphq_wa_ai_config")
    .select("project_id, enabled, full_autonomy");

  // 6. Conversas com mensagens paradas / não lidas
  const { data: convsData } = await supabase
    .from("imphq_wa_conversations")
    .select("project_id, unread_count, last_message_at, status")
    .gt("unread_count", 0);

  // 7. Mensagens inbound recebidas nas últimas 24h
  const { data: inboundMsgs24h } = await supabase
    .from("imphq_wa_messages")
    .select("project_id, id, direction, status")
    .eq("direction", "incoming")
    .gte("created_at", last24h);

  const vList = vendas24h || [];
  const lList = leads24h || [];
  const pList = providers || [];
  const aList = aiConfigs || [];
  const cList = convsData || [];
  const mList = inboundMsgs24h || [];

  // Filtra projetos prioritários + qualquer outro com atividade recente
  const targetProjects = (allProjects || []).filter((p) => {
    if (coreIds.includes(p.id)) return true;
    const hasSales = vList.some((v) => v.project_id === p.id);
    const hasLeads = lList.some((l) => l.project_id === p.id);
    const hasMsgs = mList.some((m) => m.project_id === p.id);
    return hasSales || hasLeads || hasMsgs;
  }).sort((a, b) => {
    const aIdx = coreIds.indexOf(a.id);
    const bIdx = coreIds.indexOf(b.id);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  // Painel ao vivo (LIVE1.4): última leitura do dia por projeto. Antes do meio-dia mostra o fechamento de ontem;
  // depois, o parcial de hoje. Falha aqui não derruba o briefing: a linha só fica de fora.
  const brtNow = new Date(now.getTime() - 3 * 3600000);
  const liveLabel = brtNow.getUTCHours() < 12 ? "ontem" : "hoje";
  const liveDay = new Date(brtNow.getTime() - (liveLabel === "ontem" ? 86400000 : 0)).toISOString().slice(0, 10);
  const liveByProject = new Map<string, LiveBriefingSnapshot>();
  try {
    const { data: snaps } = await supabase.from("imphq_live_snapshots")
      .select("project_id, moeda, gasto, faturamento, vendas, cpa, zona, roas, taken_at").eq("dia", liveDay).order("taken_at", { ascending: false }).limit(2000);
    for (const sn of (snaps || []) as Array<LiveBriefingSnapshot & { project_id: string }>) if (!liveByProject.has(sn.project_id)) liveByProject.set(sn.project_id, sn);
  } catch (e) {
    console.error("[daily-briefing-wa] live snapshots:", e instanceof Error ? e.message : String(e));
  }

  const lines: string[] = [];
  lines.push(isOnDemand ? "⚡ *Imperius — Raio-X por Projeto*" : "🏛️ *Imperius — Briefing por Projeto*");
  lines.push(`📅 ${brtNowStr()}`);
  lines.push("");

  let totalReceitaAprovada = 0;
  let totalVendasAprovadas = 0;
  let totalAbandonos = 0;
  let totalLeads = 0;
  let totalHotLeads = 0;
  let totalPendingConvs = 0;
  let totalInboundMsgs = 0;
  const actions: string[] = [];

  for (const proj of targetProjects) {
    const pId = proj.id;
    const emoji = PROJECT_EMOJIS[pId] || "🎯";
    const projVendas = vList.filter((v) => v.project_id === pId);
    const aprovadas = projVendas.filter((v) => v.status === "aprovado");
    const abandonos = projVendas.filter((v) => v.status === "carrinho_abandonado" || v.status === "pix_gerado");
    const recAprovada = aprovadas.reduce((s: number, v) => s + Number(v.valor || 0), 0);

    const projLeads = lList.filter((l) => l.project_id === pId);
    const hotLeads = projLeads.filter((l) => Number(l.score || 0) >= 70);

    // Mensagens paradas do projeto
    const projConvs = cList.filter((c) => c.project_id === pId);
    const recentPendingConvs = projConvs.filter((c) =>
      c.last_message_at && new Date(c.last_message_at).getTime() >= Date.now() - 48 * 3600000
    );
    const projInbound = mList.filter((m) => m.project_id === pId);

    totalReceitaAprovada += recAprovada;
    totalVendasAprovadas += aprovadas.length;
    totalAbandonos += abandonos.length;
    totalLeads += projLeads.length;
    totalHotLeads += hotLeads.length;
    totalPendingConvs += recentPendingConvs.length;
    totalInboundMsgs += projInbound.length;

    // Provider WA do projeto
    const prov = pList.find((pr) => pr.project_id === pId || (pId === "jp_freitas" && pr.instance_name === "jpfreitas"));
    const ai = aList.find((ai) => ai.project_id === pId);

    // Meta Ads status
    const creatives = Array.isArray(proj.data?.facebook_creatives) ? proj.data.facebook_creatives : [];
    const hasActiveAds = creatives.some((c) => c.status === "ACTIVE" || c.status === "ACTIVE_CAMPAIGN");

    lines.push(`${emoji} *${proj.name}* (${proj.category || "Operação"})`);
    lines.push(`• Vendas 24h: R$ ${recAprovada.toFixed(2)} (${aprovadas.length} aprovadas)`);
    const live = liveByProject.get(String(pId));
    if (live) lines.push(liveBriefingLine(live, liveLabel));
    
    if (abandonos.length > 0) {
      lines.push(`• Recuperação: ⚠️ ${abandonos.length} abandonos/pix pendentes`);
      abandonos.slice(0, 3).forEach((a: BriefingSale) => {
        const lead = a.lead_id ? leadsInfoMap[a.lead_id] : null;
        const nome = lead?.nome || a.nome || a.data?.nome || "Lead";
        const rawPhone = lead?.phone || a.data?.phone || a.data?.telefone || "";
        const cleanPhone = formatBrPhoneForWa(rawPhone);
        const conv = cleanPhone ? activeConvsMap[cleanPhone] : null;
        const x1Tag = conv ? "🟢 No X1" : "⚠️ Fora do X1";
        lines.push(`  └ *${nome}* (${a.produto_nome || "Produto"}) — ${x1Tag}${cleanPhone ? ` → wa.me/${cleanPhone}` : ""}`);
      });
      actions.push(`[${proj.name}] Recuperar ${abandonos.length} carrinho(s) abandonado(s) de hoje.`);
    }

    lines.push(`• Novos Leads: ${projLeads.length} leads ${hotLeads.length > 0 ? `(🔥 ${hotLeads.length} quentes)` : ""}`);

    if (prov) {
      const isOnline = prov.status === "connected" || prov.is_active;
      const aiMode = ai?.full_autonomy ? "100% IA Autônoma" : "Co-piloto";
      lines.push(`• WhatsApp: ${isOnline ? "🟢" : "🔴"} ${prov.instance_name} (${aiMode})`);
      if (!isOnline) actions.push(`[${proj.name}] Reconectar chip do WhatsApp (${prov.instance_name}).`);
    }

    if (recentPendingConvs.length > 0 || projInbound.length > 0) {
      lines.push(`• Fila de Atendimento: ⚠️ ${recentPendingConvs.length} conversas paradas (${projInbound.length} msgs em 24h)`);
      actions.unshift(`[${proj.name}] Atender ${recentPendingConvs.length} conversas paradas no WhatsApp.`);
    } else {
      lines.push(`• Fila de Atendimento: 🟢 Fila zerada`);
    }

    // Com leitura do painel, o gasto real substitui a lista de criativos (gravada pelo sync da Meta, parado desde 26/06).
    if (creatives.length > 0 && !live) {
      lines.push(`• Meta Ads: ${hasActiveAds ? "🟢 Anúncios rodando" : "🟡 Campanhas pausadas"}`);
      if (!hasActiveAds) actions.push(`[${proj.name}] Reativar tráfego pausado no Meta Ads.`);
    }

    lines.push("");
  }

  // Consolidado
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push("📊 *Consolidado Geral (24h):*");
  lines.push(`💰 Receita Aprovada: R$ ${totalReceitaAprovada.toFixed(2)} (${totalVendasAprovadas} vendas)`);
  if (totalAbandonos > 0) {
    lines.push(`🛒 Em Recuperação: ${totalAbandonos} abandonos na mesa`);
  }
  if (totalPendingConvs > 0 || totalInboundMsgs > 0) {
    lines.push(`💬 Fila WhatsApp: ⚠️ ${totalPendingConvs} conversas paradas (${totalInboundMsgs} msgs em 24h)`);
  } else {
    lines.push(`💬 Fila WhatsApp: 🟢 Fila zerada`);
  }
  lines.push(`🔥 Novos Leads: ${totalLeads} (${totalHotLeads} qualificados)`);
  lines.push(`📱 WhatsApp: ${pList.filter((p) => p.is_active).length} chip(s) ativos`);

  if (actions.length > 0) {
    lines.push("");
    lines.push("⚡ *Ações Prioritárias:*");
    actions.slice(0, 3).forEach((act, idx) => {
      lines.push(`${idx + 1}. ${act}`);
    });
  }

  // Constrói mensagem dedicada de recuperação caso haja abandonos
  let recoveryMessage: string | null = null;
  if (abandonos24h.length > 0) {
    const rLines: string[] = [];
    rLines.push("🎯 *Ficha de Recuperação de Carrinho (Últimas 24h)*");
    rLines.push("");

    abandonos24h.slice(0, 8).forEach((a: BriefingSale, idx: number) => {
      const lead = a.lead_id ? leadsInfoMap[a.lead_id] : null;
      const nome = lead?.nome || a.nome || a.data?.nome || a.data?.name || "Cliente sem nome";
      const rawPhone = lead?.phone || a.data?.phone || a.data?.telefone || "";
      const cleanPhone = formatBrPhoneForWa(rawPhone);

      const email = lead?.email || a.data?.email || null;
      const produto = a.produto_nome || "Produto";
      const valor = Number(a.valor || 0) > 0 ? ` (R$ ${Number(a.valor).toFixed(2)})` : "";
      const conv = cleanPhone ? activeConvsMap[cleanPhone] : null;

      rLines.push(`*${idx + 1}. ${nome}*`);
      rLines.push(`   📦 *Produto:* ${produto}${valor}`);
      if (conv) {
        const iaDesc = conv.ia_ativa ? "IA ativa respondendo" : "Atendimento manual";
        rLines.push(`   💬 *Status no X1:* 🟢 *Em conversa ativa* (${iaDesc})`);
      } else {
        rLines.push(`   💬 *Status no X1:* ⚠️ *NÃO está no WhatsApp* (Sem conversa iniciada)`);
      }

      if (cleanPhone) {
        rLines.push(`   📱 *Iniciar X1:* https://wa.me/${cleanPhone}`);
      }
      if (email) {
        rLines.push(`   📧 *E-mail:* ${email}`);
      }
      rLines.push("");
    });

    rLines.push("_💡 Toque no link wa.me para abrir o WhatsApp e abordar o lead agora!_");
    recoveryMessage = rLines.join("\n");
  }

  const teamDay = await buildTeamDay(supabase);
  if (teamDay.length) {
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push(...teamDay);
  }

  return { briefingText: lines.join("\n"), recoveryMessage };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const force = url.searchParams.get("force") === "true" || body?.force === true;
    const onlyUser = url.searchParams.get("user_id") || body?.user_id;
    const targetJid = url.searchParams.get("target_jid") || body?.target_jid;
    // Prévia: monta a mensagem e não envia nada.
    const dryRun = url.searchParams.get("dry_run") === "true" || body?.dry_run === true;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const hour = brtHour();

    let targets: Array<{ user_id: string; wa_briefing_phone?: string | null; wa_briefing_hour?: number | null }> = [];

    if (targetJid) {
      targets = [{ user_id: "on_demand", wa_briefing_phone: targetJid, wa_briefing_hour: hour }];
    } else {
      let q = supabase
        .from("imphq_notification_preferences")
        .select("user_id, wa_briefing_enabled, wa_briefing_phone, wa_briefing_hour")
        .eq("wa_briefing_enabled", true);
      if (onlyUser) q = q.eq("user_id", onlyUser);

      const { data: prefs } = await q;
      targets = (prefs || []).filter((p: {wa_briefing_hour:number|null}) =>
        force || onlyUser || Number(p.wa_briefing_hour ?? 8) === hour
      );
    }

    const results: Array<{user_id:string} & ({error:string}|{status:number;send:unknown})> = [];

    // Constrói o briefing pontuado por projeto + ficha de recuperação
    const { briefingText, recoveryMessage } = await buildOperationalBriefing(supabase, Boolean(targetJid));

    // Provider global ativo para disparo
    const { data: provider } = await supabase
      .from("imphq_wa_providers")
      .select("*")
      .eq("is_active", true)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    for (const pref of dryRun ? [] : targets) {
      try {
        const phone = normalizePhone(pref.wa_briefing_phone || "");
        if (!phone) {
          results.push({ user_id: pref.user_id, error: "Sem telefone configurado" });
          continue;
        }

        if (!provider?.instance_name) {
          results.push({ user_id: pref.user_id, error: "Nenhum provider WA ativo" });
          continue;
        }

        const sendUrl = `${provider.api_url.replace(/\/$/, "")}/message/sendText/${provider.instance_name}`;
        const sendRes = await fetch(sendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: provider.api_key },
          body: JSON.stringify({ number: phone, text: briefingText }),
        });
        const sendJson = await sendRes.json().catch(() => ({}));
        results.push({ user_id: pref.user_id, status: sendRes.status, send: sendJson });

        // Se houver abandonos e mensagem detalhada de recuperação, envia logo em seguida
        if (recoveryMessage) {
          await new Promise((r) => setTimeout(r, 1200));
          await fetch(sendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: provider.api_key },
            body: JSON.stringify({ number: phone, text: recoveryMessage }),
          }).catch((e) => console.warn("[daily-briefing-wa] recovery msg send error:", e));
        }
      } catch (err) {
        results.push({ user_id: pref.user_id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return new Response(JSON.stringify({ ok: true, dry_run: dryRun, hour, count: results.length, results, message_preview: briefingText, recovery_preview: recoveryMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
