import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Validate API key
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const keyHash = btoa(apiKey);
  const { data: keyRecord } = await supabase
    .from("imphq_api_keys")
    .select("id, permissions")
    .eq("key_hash", keyHash)
    .limit(1)
    .single();

  if (!keyRecord) {
    return new Response(JSON.stringify({ error: "Invalid API key" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("imphq_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRecord.id);

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // ═══════════════════════════════════════════
    // GET ACTIONS
    // ═══════════════════════════════════════════

    if (req.method === "GET") {
      // ── list_projects ──
      if (action === "list_projects") {
        const { data, error } = await supabase.from("imphq_projects").select("id,name,category,description,produto,created_at").order("name");
        if (error) throw error;
        return json({ success: true, projects: data });
      }

      // ── project_status ──
      if (action === "project_status") {
        const projectId = url.searchParams.get("project_id");
        if (!projectId) throw new Error("project_id is required");
        const [projRes, leadsRes, cardsRes, revenueRes] = await Promise.all([
          supabase.from("imphq_projects").select("*").eq("id", projectId).single(),
          supabase.from("imphq_leads").select("id, status", { count: "exact" }).eq("project_id", projectId),
          supabase.from("imphq_kanban_cards").select("id, board, priority").contains("tags", [projectId]),
          supabase.from("imphq_project_revenue").select("valor").eq("project_id", projectId),
        ]);
        const totalRevenue = (revenueRes.data || []).reduce((s: number, r: any) => s + (parseFloat(r.valor) || 0), 0);
        const leadsByStatus: Record<string, number> = {};
        (leadsRes.data || []).forEach((l: any) => {
          leadsByStatus[l.status || "lead"] = (leadsByStatus[l.status || "lead"] || 0) + 1;
        });
        return json({
          success: true,
          project: projRes.data,
          summary: { total_leads: leadsRes.count || 0, leads_by_status: leadsByStatus, total_tasks: (cardsRes.data || []).length, total_revenue: totalRevenue },
        });
      }

      // ── export_context ──
      if (action === "export_context") {
        const projectId = url.searchParams.get("project_id");
        if (!projectId) throw new Error("project_id is required");
        const { data: project } = await supabase.from("imphq_projects").select("*").eq("id", projectId).single();
        if (!project) throw new Error("Project not found");
        const d = typeof project.data === "string" ? JSON.parse(project.data) : (project.data || {});
        const context = {
          projeto: { id: project.id, name: project.name, category: project.category, description: project.description },
          expert: d.expert || {},
          briefing: { produtos: d.produtos || [], status: d.status, links: d.links },
          avatar: project.avatar || {},
          brand_kit: project.brand_kit || {},
          kpis: d.kpis || {},
          pipeline: project.pipeline || {},
          integracoes: d.integracoes || {},
        };
        return json({ success: true, context });
      }

      // ── list_products ──
      // Agrega produtos distintos das vendas; aceita ?project_id=... opcional
      if (action === "list_products") {
        const projectId = url.searchParams.get("project_id");
        let q = supabase
          .from("imphq_vendas")
          .select("produto_nome, produto_tipo, valor, status, project_id, data_venda")
          .not("produto_nome", "is", null);
        if (projectId) q = q.eq("project_id", projectId);
        const { data: vendas, error } = await q.limit(10000);
        if (error) throw error;

        // Buscar nomes de projetos para enriquecer resposta
        const projectIds = Array.from(new Set((vendas || []).map((v: any) => v.project_id).filter(Boolean)));
        const projectsMap: Record<string, string> = {};
        if (projectIds.length > 0) {
          const { data: projs } = await supabase.from("imphq_projects").select("id,name").in("id", projectIds);
          (projs || []).forEach((p: any) => { projectsMap[p.id] = p.name; });
        }

        // Agrupar por (project_id, produto_nome)
        const agg: Record<string, any> = {};
        (vendas || []).forEach((v: any) => {
          const key = `${v.project_id || "sem_projeto"}::${v.produto_nome}`;
          if (!agg[key]) {
            agg[key] = {
              project_id: v.project_id,
              project_name: projectsMap[v.project_id] || null,
              produto_nome: v.produto_nome,
              produto_tipo: v.produto_tipo || null,
              total_vendas: 0,
              vendas_aprovadas: 0,
              receita_total: 0,
              ticket_medio: 0,
              ultima_venda: null as string | null,
            };
          }
          const item = agg[key];
          item.total_vendas += 1;
          if (v.status === "aprovado") {
            item.vendas_aprovadas += 1;
            item.receita_total += parseFloat(v.valor) || 0;
          }
          if (!item.ultima_venda || v.data_venda > item.ultima_venda) item.ultima_venda = v.data_venda;
        });

        const products = Object.values(agg).map((p: any) => ({
          ...p,
          receita_total: Math.round(p.receita_total * 100) / 100,
          ticket_medio: p.vendas_aprovadas > 0 ? Math.round((p.receita_total / p.vendas_aprovadas) * 100) / 100 : 0,
        })).sort((a: any, b: any) => b.receita_total - a.receita_total);

        return json({ success: true, total: products.length, products });
      }

      // ── list_columns ──
      if (action === "list_columns") {
        const board = url.searchParams.get("board") || "agentes";
        const { data, error } = await supabase.from("imphq_kanban_columns").select("id,title,board,position").eq("board", board).order("position");
        if (error) throw error;
        return json({ success: true, columns: data });
      }

      // ── list_cards ──
      if (action === "list_cards") {
        let query = supabase.from("imphq_kanban_cards").select("id,title,description,priority,board,column_id,tags,due_date,assigned_to,position,created_at");
        const board = url.searchParams.get("board");
        const columnId = url.searchParams.get("column_id");
        const projectId = url.searchParams.get("project_id");
        const priority = url.searchParams.get("priority");
        if (board) query = query.eq("board", board);
        if (columnId) query = query.eq("column_id", columnId);
        if (projectId) query = query.contains("tags", [projectId]);
        if (priority) query = query.eq("priority", priority);
        const { data, error } = await query.order("position").limit(200);
        if (error) throw error;
        return json({ success: true, cards: data });
      }

      // ── get_card ──
      if (action === "get_card") {
        const cardId = url.searchParams.get("card_id");
        if (!cardId) throw new Error("card_id is required");
        const { data, error } = await supabase.from("imphq_kanban_cards").select("*").eq("id", cardId).single();
        if (error) throw error;
        return json({ success: true, card: data });
      }

      // ── list_leads ──
      if (action === "list_leads") {
        let query = supabase.from("imphq_leads").select("id,nome,email,phone,status,plataforma,project_id,tags,created_at,data");
        const projectId = url.searchParams.get("project_id");
        const status = url.searchParams.get("status");
        const plataforma = url.searchParams.get("plataforma");
        if (projectId) query = query.eq("project_id", projectId);
        if (status) query = query.eq("status", status);
        if (plataforma) query = query.eq("plataforma", plataforma);
        const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
        if (error) throw error;
        return json({ success: true, leads: data });
      }

      // ── list_skills ──
      if (action === "list_skills") {
        const { data, error } = await supabase.from("imphq_skills").select("id,nome,categoria,descricao,status").order("nome");
        if (error) throw error;
        return json({ success: true, skills: data });
      }

      // ── get_skill ──
      if (action === "get_skill") {
        const skillId = url.searchParams.get("skill_id");
        if (!skillId) throw new Error("skill_id is required");
        const { data, error } = await supabase.from("imphq_skills").select("*").eq("id", skillId).single();
        if (error) throw error;
        return json({ success: true, skill: data });
      }
    }

    // ═══════════════════════════════════════════
    // POST ACTIONS
    // ═══════════════════════════════════════════

    if (req.method === "POST") {
      const body = await req.json();

      // ── create_task ──
      if (action === "create_task") {
        const { title, board = "agentes", priority = "medium", due_date, project_id, description } = body;
        if (!title) throw new Error("title is required");
        const { data: cols } = await supabase.from("imphq_kanban_columns").select("id").eq("board", board).eq("title", "backlog").limit(1);
        const columnId = cols?.[0]?.id;
        if (!columnId) throw new Error(`No backlog column found for board: ${board}`);
        const { data, error } = await supabase.from("imphq_kanban_cards").insert({
          column_id: columnId, title, description: description || null, priority, due_date: due_date || null, board, position: 0, tags: project_id ? [project_id] : [],
        }).select().single();
        if (error) throw error;
        return json({ success: true, card: data });
      }

      // ── create_lead ──
      if (action === "create_lead") {
        const { nome, email, phone, plataforma, project_id, tags, data: leadData } = body;
        if (!nome && !email) throw new Error("nome or email is required");
        const { data, error } = await supabase.from("imphq_leads").insert({
          id: crypto.randomUUID(), nome: nome || null, email: email || null, phone: phone || null,
          plataforma: plataforma || null, project_id: project_id || null, tags: tags || [], status: "lead", data: leadData || {},
        }).select().single();
        if (error) throw error;
        return json({ success: true, lead: data });
      }

      // ── create_notification ──
      if (action === "create_notification") {
        const { title, message, type = "info", link } = body;
        if (!title || !message) throw new Error("title and message are required");
        const { data, error } = await supabase.from("imphq_notifications").insert({
          title, message, type, link: link || null, read: false,
        }).select().single();
        if (error) throw error;
        return json({ success: true, notification: data });
      }
    }

    // ═══════════════════════════════════════════
    // PUT ACTIONS
    // ═══════════════════════════════════════════

    if (req.method === "PUT") {
      const body = await req.json();

      // ── update_card ──
      if (action === "update_card") {
        const { card_id, title, description, priority, tags, due_date, assigned_to } = body;
        if (!card_id) throw new Error("card_id is required");
        const payload: any = {};
        if (title !== undefined) payload.title = title;
        if (description !== undefined) payload.description = description;
        if (priority !== undefined) payload.priority = priority;
        if (tags !== undefined) payload.tags = tags;
        if (due_date !== undefined) payload.due_date = due_date;
        if (assigned_to !== undefined) payload.assigned_to = assigned_to;
        const { data, error } = await supabase.from("imphq_kanban_cards").update(payload).eq("id", card_id).select().single();
        if (error) throw error;
        return json({ success: true, card: data });
      }

      // ── move_card ──
      if (action === "move_card") {
        const { card_id, column_id, column_title, board } = body;
        if (!card_id) throw new Error("card_id is required");
        let targetColumnId = column_id;
        if (!targetColumnId && column_title && board) {
          const { data: cols } = await supabase.from("imphq_kanban_columns").select("id").eq("board", board).ilike("title", column_title).limit(1);
          targetColumnId = cols?.[0]?.id;
          if (!targetColumnId) throw new Error(`Column "${column_title}" not found in board "${board}"`);
        }
        if (!targetColumnId) throw new Error("column_id or (column_title + board) is required");
        const { data, error } = await supabase.from("imphq_kanban_cards").update({ column_id: targetColumnId, position: 0 }).eq("id", card_id).select().single();
        if (error) throw error;
        return json({ success: true, card: data });
      }

      // ── update_lead ──
      if (action === "update_lead") {
        const { lead_id, status, tags, nome, email, phone, data: leadData } = body;
        if (!lead_id) throw new Error("lead_id is required");
        const payload: any = {};
        if (status !== undefined) payload.status = status;
        if (tags !== undefined) payload.tags = tags;
        if (nome !== undefined) payload.nome = nome;
        if (email !== undefined) payload.email = email;
        if (phone !== undefined) payload.phone = phone;
        if (leadData !== undefined) payload.data = leadData;
        const { data, error } = await supabase.from("imphq_leads").update(payload).eq("id", lead_id).select().single();
        if (error) throw error;
        return json({ success: true, lead: data });
      }
    }

    // ═══════════════════════════════════════════
    // DELETE ACTIONS
    // ═══════════════════════════════════════════

    if (req.method === "DELETE") {
      // ── delete_card ──
      if (action === "delete_card") {
        const cardId = url.searchParams.get("card_id");
        if (!cardId) throw new Error("card_id is required");
        const { error } = await supabase.from("imphq_kanban_cards").delete().eq("id", cardId);
        if (error) throw error;
        return json({ success: true, deleted: cardId });
      }
    }

    return json({
      error: "Unknown action",
      available_actions: {
        GET: ["list_projects", "project_status", "export_context", "list_columns", "list_cards", "get_card", "list_leads", "list_skills", "get_skill"],
        POST: ["create_task", "create_lead", "create_notification"],
        PUT: ["update_card", "move_card", "update_lead"],
        DELETE: ["delete_card"],
      }
    }, 400);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
