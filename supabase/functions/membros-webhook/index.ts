// Endpoint dedicado para Área de Membros externa
// Recebe eventos tipados e segrega em leads, eventos, respostas e atividades
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tipos de eventos suportados
type EventType =
  | "membro_cadastrado"      // Cadastro gratuito na área
  | "webinar_inscrito"       // Inscrição em webinar
  | "webinar_assistido"      // Assistiu (parcial ou total)
  | "prova_enviada"          // Submeteu prova/depoimento
  | "pesquisa_respondida"    // Respondeu form de pesquisa
  | "aula_concluida"         // Concluiu uma aula
  | "login_membros"          // Login na área
  | "custom";                // Evento customizado

interface MembrosPayload {
  project_id: string;
  event_type: EventType;
  // Dados do lead/membro
  email: string;
  nome?: string;
  phone?: string;
  // Contexto do evento
  origem?: string;           // Ex: "area-membros", "webinar-X"
  tags?: string[];
  // Metadados específicos
  metadata?: Record<string, any>;
  // Para pesquisas/provas/forms
  form_id?: string;
  form_name?: string;
  respostas?: Record<string, any>; // { pergunta: resposta }
  // UTMs
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  page_url?: string;
}

// Mapeia event_type → status do lead e pontuação
const EVENT_CONFIG: Record<EventType, { status?: string; pontos: number; acao: string }> = {
  membro_cadastrado:    { status: "membro",            pontos: 15, acao: "membro_cadastrado" },
  webinar_inscrito:     { status: "webinar_inscrito",  pontos: 10, acao: "webinar_inscrito" },
  webinar_assistido:    { status: "webinar_assistido", pontos: 25, acao: "webinar_assistido" },
  prova_enviada:        { status: "engajado",          pontos: 20, acao: "prova_enviada" },
  pesquisa_respondida:  { status: "qualificado",      pontos: 15, acao: "pesquisa_respondida" },
  aula_concluida:       { pontos: 5,                                acao: "aula_concluida" },
  login_membros:        { pontos: 2,                                acao: "login_membros" },
  custom:               { pontos: 1,                                acao: "evento_custom" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = (await req.json()) as MembrosPayload;

    // Validação mínima
    if (!body.email || !body.event_type || !body.project_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "project_id, email e event_type são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = body.email.trim().toLowerCase();
    const config = EVENT_CONFIG[body.event_type] || EVENT_CONFIG.custom;
    const origem = body.origem || "area-membros";

    // 1. Upsert do Lead (dedup por email)
    const { data: existing } = await supabase
      .from("imphq_leads")
      .select("id, data, status, tags")
      .eq("email", email)
      .maybeSingle();

    let leadId: string;
    const now = new Date().toISOString();
    const newInteraction = {
      evento: config.acao,
      event_type: body.event_type,
      data: now,
      origem,
      metadata: body.metadata || {},
      utms: {
        utm_source: body.utm_source,
        utm_medium: body.utm_medium,
        utm_campaign: body.utm_campaign,
      },
    };

    if (existing) {
      leadId = existing.id;
      const currentData = (existing.data as Record<string, any>) || {};
      const interacoes: any[] = currentData.interacoes || [];
      interacoes.push(newInteraction);

      const mergedTags = Array.from(
        new Set([...(existing.tags || []), ...(body.tags || []), `area-membros`])
      );

      const updates: any = {
        data: {
          ...currentData,
          visitor_id: currentData.visitor_id || leadId,
          interacoes,
          ultimo_evento: config.acao,
          ultima_origem: origem,
        },
        tags: mergedTags,
      };
      if (body.nome) updates.nome = body.nome;
      if (body.phone) updates.phone = body.phone;
      // Precedence: lead < membro < cliente < vip. Nunca rebaixa quem já comprou.
      if (config.status) {
        const rank: Record<string, number> = { lead: 1, membro: 2, cliente: 3, vip: 4 };
        const currentRank = rank[existing.status as string] || 0;
        const newRank = rank[config.status] || 0;
        if (newRank > currentRank) updates.status = config.status;
      }

      // Override project_id via regra Tag→Projeto (mesmo em lead existente)
      if (mergedTags.length) {
        const { data: allRules } = await supabase
          .from("imphq_tag_project_rules")
          .select("project_id, priority, tag, tags_all, origem, plataforma")
          .order("priority", { ascending: true });
        const match = (allRules || []).find((r: any) => {
          const needed: string[] = (r.tags_all && r.tags_all.length > 0) ? r.tags_all : (r.tag ? [r.tag] : []);
          if (needed.length === 0) return false;
          if (!needed.every((t: string) => mergedTags.includes(t))) return false;
          if (r.plataforma && r.plataforma !== origem) return false;
          if (r.origem && r.origem !== origem) return false;
          return true;
        });
        if (match?.project_id) updates.project_id = match.project_id;
      }

      await supabase.from("imphq_leads").update(updates).eq("id", leadId);
    } else {
      leadId = crypto.randomUUID();
      // Resolver tag → projeto (override project_id se houver regra)
      let resolvedProjectId = body.project_id;
      const allTags = [...(body.tags || []), "area-membros"];
      if (allTags.length) {
        const { data: allRules } = await supabase
          .from("imphq_tag_project_rules")
          .select("project_id, priority, tag, tags_all, origem, plataforma")
          .order("priority", { ascending: true });
        const match = (allRules || []).find((r: any) => {
          const needed: string[] = (r.tags_all && r.tags_all.length > 0) ? r.tags_all : (r.tag ? [r.tag] : []);
          if (needed.length === 0) return false;
          if (!needed.every((t: string) => allTags.includes(t))) return false;
          if (r.plataforma && r.plataforma !== origem) return false;
          if (r.origem && r.origem !== origem) return false;
          return true;
        });
        if (match?.project_id) resolvedProjectId = match.project_id;
      }

      await supabase.from("imphq_leads").insert({
        id: leadId,
        nome: body.nome || email,
        email,
        phone: body.phone || null,
        plataforma: origem,
        status: config.status || "lead",
        tags: allTags,
        project_id: resolvedProjectId,

        data: {
          visitor_id: leadId,
          ultimo_evento: config.acao,
          ultima_origem: origem,
          captura_origem: origem,
          capturado_em: now,
          interacoes: [newInteraction],
        },
      });
    }

    // 2. Salvar respostas (se houver) - segregado em imphq_lead_responses
    if (body.respostas && Object.keys(body.respostas).length > 0) {
      const rows = Object.entries(body.respostas).map(([pergunta, resposta]) => ({
        id: crypto.randomUUID(),
        lead_id: leadId,
        project_id: body.project_id,
        form_id: body.form_id || `membros:${body.event_type}`,
        step: body.event_type,
        field_key: pergunta,
        question: pergunta,
        answer: String(resposta),
      }));
      await supabase.from("imphq_lead_responses").insert(rows);
    }

    // 3. Log de evento analítico - segregado em imphq_events
    await supabase.from("imphq_events").insert({
      id: crypto.randomUUID(),
      project_id: body.project_id,
      visitor_id: leadId,
      event_name: body.event_type,
      event_data: {
        origem,
        email,
        nome: body.nome,
        form_id: body.form_id,
        form_name: body.form_name,
        ...body.metadata,
      },
      page_url: body.page_url || null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
    });

    // 4. Score do lead
    try {
      await supabase.from("imphq_lead_scores_log").insert({
        lead_id: leadId,
        acao: config.acao,
        pontos: config.pontos,
      });
    } catch (e) {
      console.warn("[membros-webhook] erro score:", e);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        success: true,
        lead_id: leadId,
        is_new: !existing,
        event_type: body.event_type,
        pontos_atribuidos: config.pontos,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[membros-webhook] erro:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
