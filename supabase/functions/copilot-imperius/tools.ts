// Tool definitions + executors para Imperius agente
// Formato OpenAI tool calling — compatível com OpenRouter

export interface ToolCtx {
  supabase: any;
  userId: string;
  projectId: string | null;
}

export const TOOL_SPECS = [
  {
    type: "function",
    function: {
      name: "listarProjetos",
      description: "Lista projetos disponíveis (id, nome, ativo). Use quando o usuário menciona um projeto pelo nome para resolver o id.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "buscarProjeto",
      description: "Busca projeto por nome (fuzzy). Retorna candidatos com id e nome. Use ANTES de qualquer ação que mencione projeto.",
      parameters: {
        type: "object",
        properties: { termo: { type: "string", description: "Nome ou parte do nome do projeto" } },
        required: ["termo"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vendasDoDia",
      description: "Lista vendas aprovadas em uma data específica (default hoje). Retorna produto, valor, lead, plataforma.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          data: { type: "string", description: "ISO YYYY-MM-DD; default hoje" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vendasResumo",
      description: "Resumo de vendas por período (default 30d). Receita, ticket médio, top produtos.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          dias: { type: "number", description: "Janela em dias, default 30" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "leadsTravadosWhatsapp",
      description: "Leads aguardando resposta humana no WhatsApp há > X horas (última msg inbound sem resposta outbound).",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          horas: { type: "number", description: "Horas mínimas de espera, default 2" },
          limite: { type: "number", description: "Max resultados, default 20" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ultimasMensagensWhatsapp",
      description: "Últimas mensagens inbound recebidas no WhatsApp (quem mandou msg recente).",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          limite: { type: "number", description: "default 15" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adsPerformance",
      description: "Performance de ads no período: gasto total, top/pior campanhas, ROAS estimado.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          dias: { type: "number", description: "default 7" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscarLead",
      description: "Busca lead por nome, email ou telefone.",
      parameters: {
        type: "object",
        properties: { termo: { type: "string" }, projeto_id: { type: "string" } },
        required: ["termo"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criarTarefas",
      description: "Cria múltiplas tarefas (kanban cards) em um projeto. Cada tarefa pode ter checklist[]. Auto-executa.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string", description: "id do projeto (resolva com buscarProjeto antes)" },
          tarefas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                titulo: { type: "string" },
                descricao: { type: "string" },
                prioridade: { type: "string", enum: ["baixa", "media", "alta"] },
                prazo: { type: "string", description: "ISO date YYYY-MM-DD" },
                checklist: { type: "array", items: { type: "string" } },
              },
              required: ["titulo"], additionalProperties: false,
            },
          },
        },
        required: ["projeto_id", "tarefas"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adicionarChecklistNaTarefa",
      description: "Adiciona itens de checklist em uma tarefa Kanban existente. Auto-executa.",
      parameters: {
        type: "object",
        properties: {
          tarefa_id: { type: "string", description: "id da tarefa (kanban card)" },
          itens: { type: "array", items: { type: "string" } },
        },
        required: ["tarefa_id", "itens"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moverTarefa",
      description: "Move tarefa para outra coluna do Kanban. Auto-executa.",
      parameters: {
        type: "object",
        properties: {
          tarefa_id: { type: "string" },
          coluna: { type: "string", description: "Nome da coluna destino (ex: 'A Fazer', 'Fazendo', 'Feito', 'Bloqueado')" },
        },
        required: ["tarefa_id", "coluna"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendarLembrete",
      description: "Cria uma tarefa do tipo lembrete com prazo. Auto-executa.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          titulo: { type: "string" },
          quando: { type: "string", description: "ISO date YYYY-MM-DD" },
          descricao: { type: "string" },
        },
        required: ["projeto_id", "titulo", "quando"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "anotarLead",
      description: "Adiciona nota interna na conversa WhatsApp do lead. Auto-executa.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          nota: { type: "string" },
        },
        required: ["lead_id", "nota"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviarWhatsapp",
      description: "Envia mensagem WhatsApp para um lead. SEMPRE entra em fila de aprovação (caixa de ações).",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          mensagem: { type: "string" },
        },
        required: ["lead_id", "mensagem"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviarWhatsappEmMassa",
      description: "Envia mensagem WhatsApp para múltiplos leads. SEMPRE entra em fila de aprovação. Use com cautela.",
      parameters: {
        type: "object",
        properties: {
          lead_ids: { type: "array", items: { type: "string" } },
          mensagem: { type: "string" },
        },
        required: ["lead_ids", "mensagem"], additionalProperties: false,
      },
    },
  },
];

// ===== Executors =====

async function listarProjetos(ctx: ToolCtx) {
  const { data } = await ctx.supabase
    .from("imphq_projects")
    .select("id, name, active, is_archived")
    .eq("is_archived", false)
    .order("name")
    .limit(50);
  return { projetos: (data || []).map((p: any) => ({ id: p.id, nome: p.name, ativo: p.active })) };
}

async function buscarProjeto(ctx: ToolCtx, { termo }: { termo: string }) {
  const t = (termo || "").trim();
  if (!t) return { error: "termo vazio" };
  const { data } = await ctx.supabase
    .from("imphq_projects")
    .select("id, name, active")
    .ilike("name", `%${t}%`)
    .limit(10);
  return { matches: (data || []).map((p: any) => ({ id: p.id, nome: p.name, ativo: p.active })) };
}

function resolveProjectId(ctx: ToolCtx, given?: string) {
  return given || ctx.projectId || null;
}

async function vendasDoDia(ctx: ToolCtx, args: { projeto_id?: string; data?: string }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const dia = args.data || new Date().toISOString().slice(0, 10);
  const start = `${dia}T00:00:00`;
  const end = `${dia}T23:59:59`;
  let q = ctx.supabase
    .from("imphq_vendas")
    .select("id, valor, produto_nome, plataforma, status, data_venda, lead_id, tipo_venda")
    .eq("status", "aprovado")
    .gte("data_venda", start).lte("data_venda", end)
    .order("data_venda", { ascending: false })
    .limit(200);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const total = (data || []).reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
  // enriquecer com nome do lead
  const leadIds = [...new Set((data || []).map((v: any) => v.lead_id).filter(Boolean))];
  let leadsMap: Record<string, string> = {};
  if (leadIds.length) {
    const { data: leads } = await ctx.supabase.from("imphq_leads").select("id, nome, email").in("id", leadIds);
    for (const l of leads || []) leadsMap[l.id] = l.nome || l.email || l.id;
  }
  return {
    data: dia,
    projeto_id: pid,
    total_vendas: data?.length || 0,
    receita_total: total,
    vendas: (data || []).map((v: any) => ({
      produto: v.produto_nome, valor: Number(v.valor || 0), plataforma: v.plataforma,
      tipo: v.tipo_venda, lead: v.lead_id ? leadsMap[v.lead_id] : null, hora: v.data_venda,
    })),
  };
}

async function vendasResumo(ctx: ToolCtx, args: { projeto_id?: string; dias?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const dias = args.dias ?? 30;
  const since = new Date(Date.now() - dias * 86400000).toISOString();
  let q = ctx.supabase.from("imphq_vendas")
    .select("valor, produto_nome").eq("status", "aprovado").gte("data_venda", since).limit(2000);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const total = (data || []).reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
  const map = new Map<string, { receita: number; vendas: number }>();
  for (const v of data || []) {
    const k = v.produto_nome || "—";
    const cur = map.get(k) || { receita: 0, vendas: 0 };
    cur.receita += Number(v.valor || 0); cur.vendas += 1;
    map.set(k, cur);
  }
  const top = [...map.entries()].sort((a, b) => b[1].receita - a[1].receita).slice(0, 8)
    .map(([nome, v]) => ({ produto: nome, receita: v.receita, vendas: v.vendas }));
  return {
    projeto_id: pid, periodo_dias: dias,
    total_vendas: data?.length || 0, receita_total: total,
    ticket_medio: data?.length ? total / data.length : 0,
    top_produtos: top,
  };
}

async function leadsTravadosWhatsapp(ctx: ToolCtx, args: { projeto_id?: string; horas?: number; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const horas = args.horas ?? 2;
  const limite = Math.min(args.limite ?? 20, 50);
  const cutoff = new Date(Date.now() - horas * 3600000).toISOString();
  // Buscar últimas mensagens recentes inbound
  let q = ctx.supabase.from("imphq_wa_messages")
    .select("id, content, conversation_id, phone, direction, created_at, project_id")
    .eq("direction", "inbound")
    .lte("created_at", cutoff)
    .gte("created_at", new Date(Date.now() - 48 * 3600000).toISOString())
    .order("created_at", { ascending: false })
    .limit(200);
  if (pid) q = q.eq("project_id", pid);
  const { data: inbounds, error } = await q;
  if (error) return { error: error.message };
  // Agrupar por conversation_id (mais recente)
  const byConv = new Map<string, any>();
  for (const m of inbounds || []) {
    if (!byConv.has(m.conversation_id)) byConv.set(m.conversation_id, m);
  }
  // Filtrar: sem outbound posterior
  const travados: any[] = [];
  for (const m of byConv.values()) {
    const { data: laterOut } = await ctx.supabase.from("imphq_wa_messages")
      .select("id").eq("conversation_id", m.conversation_id).eq("direction", "outbound")
      .gt("created_at", m.created_at).limit(1);
    if (!laterOut?.length) travados.push(m);
    if (travados.length >= limite) break;
  }
  return {
    projeto_id: pid, horas_min: horas, total: travados.length,
    leads: travados.map((m: any) => ({
      conversation_id: m.conversation_id, phone: m.phone,
      ultima_mensagem: (m.content || "").slice(0, 200),
      horas_aguardando: Math.round((Date.now() - new Date(m.created_at).getTime()) / 3600000),
      ultima_em: m.created_at,
    })),
  };
}

async function ultimasMensagensWhatsapp(ctx: ToolCtx, args: { projeto_id?: string; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const limite = Math.min(args.limite ?? 15, 50);
  let q = ctx.supabase.from("imphq_wa_messages")
    .select("content, phone, conversation_id, created_at, project_id")
    .eq("direction", "inbound").order("created_at", { ascending: false }).limit(limite);
  if (pid) q = q.eq("project_id", pid);
  const { data } = await q;
  return {
    projeto_id: pid,
    mensagens: (data || []).map((m: any) => ({
      phone: m.phone, conteudo: (m.content || "").slice(0, 200), em: m.created_at,
      conversation_id: m.conversation_id,
    })),
  };
}

async function adsPerformance(ctx: ToolCtx, args: { projeto_id?: string; dias?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const dias = args.dias ?? 7;
  const since = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  let q = ctx.supabase.from("imphq_ads_spend")
    .select("valor, campanha, plataforma, data_ref, project_id").gte("data_ref", since).limit(2000);
  if (pid) q = q.eq("project_id", pid);
  const { data } = await q;
  const totalGasto = (data || []).reduce((s: number, a: any) => s + Number(a.valor || 0), 0);
  const map = new Map<string, number>();
  for (const a of data || []) {
    const k = a.campanha || a.plataforma || "—";
    map.set(k, (map.get(k) || 0) + Number(a.valor || 0));
  }
  const ranking = [...map.entries()].sort((a, b) => b[1] - a[1]);
  // ROAS
  let q2 = ctx.supabase.from("imphq_vendas").select("valor").eq("status", "aprovado")
    .gte("data_venda", new Date(Date.now() - dias * 86400000).toISOString()).limit(2000);
  if (pid) q2 = q2.eq("project_id", pid);
  const { data: vendas } = await q2;
  const receita = (vendas || []).reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
  return {
    projeto_id: pid, dias, gasto_total: totalGasto, receita_periodo: receita,
    roas: totalGasto > 0 ? receita / totalGasto : null,
    top_5: ranking.slice(0, 5).map(([nome, v]) => ({ campanha: nome, gasto: v })),
    pior_5: ranking.slice(-5).reverse().map(([nome, v]) => ({ campanha: nome, gasto: v })),
  };
}

async function buscarLead(ctx: ToolCtx, args: { termo: string; projeto_id?: string }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const t = args.termo.trim();
  let q = ctx.supabase.from("imphq_leads")
    .select("id, nome, email, telefone, status, score, project_id, created_at").limit(10);
  q = q.or(`nome.ilike.%${t}%,email.ilike.%${t}%,telefone.ilike.%${t}%`);
  if (pid) q = q.eq("project_id", pid);
  const { data } = await q;
  return { matches: data || [] };
}

async function criarTarefas(ctx: ToolCtx, args: { projeto_id: string; tarefas: any[] }) {
  if (!args.projeto_id || !Array.isArray(args.tarefas) || !args.tarefas.length) {
    return { error: "projeto_id e tarefas[] obrigatórios" };
  }
  // Verificar projeto existe
  const { data: proj } = await ctx.supabase.from("imphq_projects").select("id, name").eq("id", args.projeto_id).single();
  if (!proj) return { error: `projeto ${args.projeto_id} não encontrado` };

  const rows = args.tarefas.map((t: any) => ({
    project_id: args.projeto_id,
    title: t.titulo,
    description: t.descricao || null,
    priority: t.prioridade || "media",
    due_date: t.prazo || null,
    board: "tarefas",
    ai_generated: true,
    metadata: t.checklist?.length ? { checklist: t.checklist.map((c: string) => ({ texto: c, feito: false })), origem: "imperius_chat" } : { origem: "imperius_chat" },
  }));
  const { data, error } = await ctx.supabase.from("imphq_kanban_cards").insert(rows).select("id, title");
  if (error) return { error: error.message };

  // Log ação no Imperius feed
  try {
    await ctx.supabase.from("imphq_ai_actions").insert({
      kind: "createTask", projeto_id: args.projeto_id,
      title: `${data.length} tarefa(s) criada(s) via chat`,
      reason: data.map((d: any) => d.title).join("; ").slice(0, 200),
      status: "executed", auto_executed: true, executed_at: new Date().toISOString(),
      risk_level: "low", confidence: 1.0,
      payload: { task_ids: data.map((d: any) => d.id) },
      result: { task_ids: data.map((d: any) => d.id) },
    });
  } catch (e: any) { console.warn("[criarTarefas] log fail", e?.message); }

  return {
    projeto: proj.name, criadas: data.length,
    tarefas: data.map((d: any) => ({ id: d.id, titulo: d.title })),
  };
}

export async function runTool(name: string, args: any, ctx: ToolCtx): Promise<any> {
  try {
    switch (name) {
      case "listarProjetos": return await listarProjetos(ctx);
      case "buscarProjeto": return await buscarProjeto(ctx, args);
      case "vendasDoDia": return await vendasDoDia(ctx, args);
      case "vendasResumo": return await vendasResumo(ctx, args);
      case "leadsTravadosWhatsapp": return await leadsTravadosWhatsapp(ctx, args);
      case "ultimasMensagensWhatsapp": return await ultimasMensagensWhatsapp(ctx, args);
      case "adsPerformance": return await adsPerformance(ctx, args);
      case "buscarLead": return await buscarLead(ctx, args);
      case "criarTarefas": return await criarTarefas(ctx, args);
      default: return { error: `tool desconhecida: ${name}` };
    }
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}
