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
  {
    type: "function",
    function: {
      name: "listarAnunciosAtivos",
      description: "Lista anúncios ativos do projeto com CTR, CPA, gasto e categoria (Top/Mid/Low). Use para diagnosticar quais pausar/escalar.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          dias: { type: "number", description: "Janela em dias, default 7" },
          limite: { type: "number", description: "default 30" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pausarAnuncio",
      description: "Pausa um anúncio no Facebook Ads (chama facebook-ads-toggle). Auto-executa (low-risk reversível). Use ad_id da listarAnunciosAtivos.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          ad_id: { type: "string", description: "ID do anúncio no Facebook (não confundir com adset/campaign)" },
          motivo: { type: "string", description: "Por que está pausando (vai pro log)" },
        },
        required: ["projeto_id", "ad_id"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ativarAnuncio",
      description: "Reativa um anúncio pausado no Facebook Ads. Auto-executa.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          ad_id: { type: "string" },
          motivo: { type: "string" },
        },
        required: ["projeto_id", "ad_id"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ajustarOrcamentoAdset",
      description: "Ajusta o orçamento diário (em R$) de um conjunto de anúncios. SEMPRE entra em fila de aprovação (mexe em dinheiro).",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          adset_id: { type: "string" },
          novo_orcamento: { type: "number", description: "Novo budget diário em reais (ex: 150.00)" },
          orcamento_anterior: { type: "number" },
          motivo: { type: "string" },
        },
        required: ["projeto_id", "adset_id", "novo_orcamento"], additionalProperties: false,
      },
    },
  },
  // ===== ONDA 2: WhatsApp Operacional =====
  {
    type: "function",
    function: {
      name: "agendarMensagemWhatsapp",
      description: "Agenda envio de mensagem WhatsApp para um lead em data/hora futura. Auto-executa (insere em imphq_wa_scheduled).",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          mensagem: { type: "string" },
          quando: { type: "string", description: "ISO datetime YYYY-MM-DDTHH:mm" },
        },
        required: ["lead_id", "mensagem", "quando"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listarAgendamentosWhatsapp",
      description: "Lista mensagens WhatsApp agendadas (status pending) do projeto.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          limite: { type: "number", description: "default 30" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelarAgendamentoWhatsapp",
      description: "Cancela um envio WhatsApp agendado. Auto-executa.",
      parameters: {
        type: "object",
        properties: { scheduled_id: { type: "string" } },
        required: ["scheduled_id"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "statusChipsWhatsapp",
      description: "Saúde dos chips/providers WhatsApp do projeto (ativo, último visto, alertas).",
      parameters: {
        type: "object",
        properties: { projeto_id: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  // ===== ONDA 3: Diagnóstico & Previsão =====
  {
    type: "function",
    function: {
      name: "diagnosticoYoshitani",
      description: "Diagnóstico Yoshitani 7/5/3 do projeto: CPA, Checkout rate, LP rate. Retorna pontuação e gargalo.",
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
      name: "previsaoReceita",
      description: "Projeção de receita do mês via extrapolação linear sobre vendas diárias.",
      parameters: {
        type: "object",
        properties: { projeto_id: { type: "string" } }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "leadsQuentes",
      description: "Leads que geraram Pix/Boleto nas últimas N horas e ainda não pagaram. Use para campanhas de recuperação.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          horas: { type: "number", description: "default 2" },
          limite: { type: "number", description: "default 30" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "funilPorEtapa",
      description: "Conta eventos do funil por etapa (Aquisição→Conversão→Maximização→Retenção) no período.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          dias: { type: "number", description: "default 7" },
        }, additionalProperties: false,
      },
    },
  },
  // ===== Onda 4: Recuperação & Hot Leads =====
  {
    type: "function",
    function: {
      name: "listarRecuperaveis",
      description: "Lista vendas em pix_gerado/boleto_gerado/aguardando_pagamento nas últimas N horas (default 24h). Carrinhos abandonados prontos para recuperação.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          horas: { type: "number", description: "default 24" },
          limite: { type: "number", description: "default 30" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recuperarVendaPix",
      description: "Dispara hot-lead-responder para venda com Pix/Boleto pendente. Auto-executa (low-risk). Use após listarRecuperaveis.",
      parameters: {
        type: "object",
        properties: {
          venda_id: { type: "string", description: "id da venda em imphq_vendas" },
        }, required: ["venda_id"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listarTemplatesRecuperacao",
      description: "Lista templates ativos de recuperação (imphq_recovery_templates) por projeto/canal.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          canal: { type: "string", description: "whatsapp|email|sms (opcional)" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pontuarLead",
      description: "Retorna score atual + breakdown do lead. Útil antes de decidir ação de recuperação.",
      parameters: {
        type: "object",
        properties: { lead_id: { type: "string" } },
        required: ["lead_id"], additionalProperties: false,
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

async function adicionarChecklistNaTarefa(ctx: ToolCtx, args: { tarefa_id: string; itens: string[] }) {
  const { data: card } = await ctx.supabase.from("imphq_kanban_cards").select("id, title, project_id").eq("id", args.tarefa_id).maybeSingle();
  if (!card) return { error: "tarefa não encontrada" };
  const rows = args.itens.map((titulo, i) => ({ card_id: args.tarefa_id, title: titulo, is_done: false, position: i }));
  const { error } = await ctx.supabase.from("imphq_card_checklists").insert(rows);
  if (error) return { error: error.message };
  await ctx.supabase.from("imphq_ai_actions").insert({
    kind: "createTask", projeto_id: card.project_id, title: `Checklist adicionado em "${card.title}"`,
    reason: args.itens.join("; ").slice(0, 200),
    status: "executed", auto_executed: true, executed_at: new Date().toISOString(),
    risk_level: "low", confidence: 1.0, payload: { tarefa_id: args.tarefa_id, itens: args.itens },
  });
  return { tarefa: card.title, adicionados: rows.length };
}

async function moverTarefa(ctx: ToolCtx, args: { tarefa_id: string; coluna: string }) {
  const { data: card } = await ctx.supabase.from("imphq_kanban_cards").select("id, title, project_id, column_id").eq("id", args.tarefa_id).maybeSingle();
  if (!card) return { error: "tarefa não encontrada" };
  const { data: cols } = await ctx.supabase.from("imphq_kanban_columns").select("id, title").eq("project_id", card.project_id);
  const target = (cols || []).find((c: any) => (c.title || "").toLowerCase().includes(args.coluna.toLowerCase()));
  if (!target) return { error: `coluna "${args.coluna}" não encontrada`, disponiveis: (cols || []).map((c: any) => c.title) };
  const { error } = await ctx.supabase.from("imphq_kanban_cards").update({ column_id: target.id }).eq("id", args.tarefa_id);
  if (error) return { error: error.message };
  await ctx.supabase.from("imphq_ai_actions").insert({
    kind: "updateLead", projeto_id: card.project_id, title: `Tarefa "${card.title}" → ${target.title}`,
    status: "executed", auto_executed: true, executed_at: new Date().toISOString(),
    risk_level: "low", confidence: 1.0, payload: { tarefa_id: args.tarefa_id, coluna: target.title },
  });
  return { tarefa: card.title, novaColuna: target.title };
}

async function agendarLembrete(ctx: ToolCtx, args: { projeto_id: string; titulo: string; quando: string; descricao?: string }) {
  const { data: proj } = await ctx.supabase.from("imphq_projects").select("id, name").eq("id", args.projeto_id).maybeSingle();
  if (!proj) return { error: "projeto não encontrado" };
  const { data, error } = await ctx.supabase.from("imphq_kanban_cards").insert({
    project_id: args.projeto_id, title: `🔔 ${args.titulo}`, description: args.descricao || null,
    due_date: args.quando.slice(0, 10), board: "tarefas", priority: "media", ai_generated: true,
    metadata: { tipo: "lembrete", origem: "imperius_chat" },
  }).select("id, title").single();
  if (error) return { error: error.message };
  await ctx.supabase.from("imphq_ai_actions").insert({
    kind: "createTask", projeto_id: args.projeto_id, title: `Lembrete: ${args.titulo}`,
    reason: `Para ${args.quando}`, status: "executed", auto_executed: true, executed_at: new Date().toISOString(),
    risk_level: "low", confidence: 1.0, payload: { tarefa_id: data.id, quando: args.quando },
  });
  return { projeto: proj.name, lembrete: data.title, quando: args.quando };
}

async function anotarLead(ctx: ToolCtx, args: { lead_id: string; nota: string }) {
  const { data: lead } = await ctx.supabase.from("imphq_leads").select("id, nome, phone, project_id").eq("id", args.lead_id).maybeSingle();
  if (!lead) return { error: "lead não encontrado" };
  const { data: conv } = await ctx.supabase.from("imphq_wa_conversations").select("id").eq("project_id", lead.project_id).eq("phone", lead.phone).maybeSingle();
  if (!conv) return { error: "sem conversa WhatsApp para este lead" };
  const { error } = await ctx.supabase.from("imphq_wa_internal_notes").insert({
    conversation_id: conv.id, author_id: ctx.userId, author_name: "Imperius IA", content: args.nota,
  });
  if (error) return { error: error.message };
  await ctx.supabase.from("imphq_ai_actions").insert({
    kind: "notify", projeto_id: lead.project_id, title: `Nota em ${lead.nome || lead.phone}`,
    reason: args.nota.slice(0, 200), status: "executed", auto_executed: true, executed_at: new Date().toISOString(),
    risk_level: "low", confidence: 1.0, payload: { lead_id: lead.id, nota: args.nota },
  });
  return { lead: lead.nome || lead.phone, ok: true };
}

async function resolveProviderForProject(ctx: ToolCtx, projectId: string) {
  const { data } = await ctx.supabase.from("imphq_wa_providers")
    .select("id, instance_name, provider").eq("project_id", projectId).eq("is_active", true).limit(1).maybeSingle();
  return data;
}

async function enviarWhatsapp(ctx: ToolCtx, args: { lead_id: string; mensagem: string }) {
  const { data: lead } = await ctx.supabase.from("imphq_leads").select("id, nome, phone, project_id").eq("id", args.lead_id).maybeSingle();
  if (!lead) return { error: "lead não encontrado" };
  if (!lead.phone) return { error: "lead sem telefone" };
  const prov = await resolveProviderForProject(ctx, lead.project_id);
  if (!prov) return { error: "nenhum provider WhatsApp ativo para o projeto" };
  const { data: act, error } = await ctx.supabase.from("imphq_ai_actions").insert({
    kind: "sendWhatsApp", projeto_id: lead.project_id,
    title: `Enviar WhatsApp para ${lead.nome || lead.phone}`,
    reason: args.mensagem.slice(0, 240),
    status: "proposed", auto_executed: false, risk_level: "medium", confidence: 0.9,
    source: "imperius_chat", created_by: ctx.userId,
    payload: { instance: prov.instance_name, number: lead.phone, text: args.mensagem, lead_id: lead.id },
  }).select("id").single();
  if (error) return { error: error.message };
  return {
    status: "pending_approval", action_id: act.id,
    lead: lead.nome || lead.phone,
    aviso: "Ação enviada para a Caixa de Ações — aprove no header (ícone Imperius) para enviar.",
  };
}

async function enviarWhatsappEmMassa(ctx: ToolCtx, args: { lead_ids: string[]; mensagem: string }) {
  if (!args.lead_ids?.length) return { error: "lead_ids vazio" };
  const { data: leads } = await ctx.supabase.from("imphq_leads")
    .select("id, nome, phone, project_id").in("id", args.lead_ids);
  const valid = (leads || []).filter((l: any) => l.phone);
  if (!valid.length) return { error: "nenhum lead com telefone" };
  const byProject = new Map<string, any[]>();
  for (const l of valid) {
    const arr = byProject.get(l.project_id) || [];
    arr.push(l); byProject.set(l.project_id, arr);
  }
  const actions: any[] = [];
  for (const [pid, ls] of byProject.entries()) {
    const prov = await resolveProviderForProject(ctx, pid);
    if (!prov) continue;
    for (const l of ls) {
      actions.push({
        kind: "sendWhatsApp", projeto_id: pid,
        title: `Massa: ${l.nome || l.phone}`,
        reason: args.mensagem.slice(0, 240),
        status: "proposed", auto_executed: false, risk_level: "high", confidence: 0.85,
        source: "imperius_chat", created_by: ctx.userId,
        payload: { instance: prov.instance_name, number: l.phone, text: args.mensagem, lead_id: l.id },
      });
    }
  }
  if (!actions.length) return { error: "nenhum projeto com provider ativo" };
  const { error } = await ctx.supabase.from("imphq_ai_actions").insert(actions);
  if (error) return { error: error.message };
  return {
    status: "pending_approval", total: actions.length,
    aviso: `${actions.length} envios criados na Caixa de Ações — aprove um a um ou em lote.`,
  };
}

// ===== ADS EXECUTORS =====

async function listarAnunciosAtivos(ctx: ToolCtx, args: { projeto_id?: string; dias?: number; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  if (!pid) return { error: "projeto_id obrigatório" };
  const dias = args.dias ?? 7;
  const limite = Math.min(args.limite ?? 30, 100);
  const since = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

  const { data, error } = await ctx.supabase
    .from("imphq_ads_spend")
    .select("ad_id, adset_id, campaign_id, anuncio, conjunto_anuncios, campanha, valor, ctr, custo_por_compra, compras, link_clicks, impressoes, effective_status, daily_budget, data_ref")
    .eq("project_id", pid)
    .gte("data_ref", since)
    .not("ad_id", "is", null)
    .not("ad_id", "ilike", "CAMP:%")
    .limit(2000);
  if (error) return { error: error.message };

  // Agregar por ad_id
  const map = new Map<string, any>();
  for (const r of data || []) {
    const k = r.ad_id;
    if (!k) continue;
    const cur = map.get(k) || {
      ad_id: k, adset_id: r.adset_id, campaign_id: r.campaign_id,
      anuncio: r.anuncio, conjunto: r.conjunto_anuncios, campanha: r.campanha,
      gasto: 0, cliques: 0, impressoes: 0, compras: 0,
      effective_status: r.effective_status, daily_budget: r.daily_budget,
    };
    cur.gasto += Number(r.valor || 0);
    cur.cliques += Number(r.link_clicks || 0);
    cur.impressoes += Number(r.impressoes || 0);
    cur.compras += Number(r.compras || 0);
    map.set(k, cur);
  }
  const ads = [...map.values()]
    .filter((a: any) => (a.effective_status || "").toUpperCase() === "ACTIVE")
    .map((a: any) => {
      const ctr = a.impressoes > 0 ? (a.cliques / a.impressoes) * 100 : 0;
      const cpa = a.compras > 0 ? a.gasto / a.compras : null;
      const categoria = ctr > 2 ? "Top" : ctr >= 1 ? "Mid" : "Low";
      return { ...a, ctr_pct: Number(ctr.toFixed(2)), cpa, categoria };
    })
    .sort((a, b) => b.gasto - a.gasto)
    .slice(0, limite);
  return { projeto_id: pid, dias, total: ads.length, anuncios: ads };
}

async function invokeAdsToggle(ctx: ToolCtx, payload: any) {
  const { data, error } = await ctx.supabase.functions.invoke("facebook-ads-toggle", { body: payload });
  if (error) return { error: error.message || String(error) };
  return data;
}

async function pausarAnuncio(ctx: ToolCtx, args: { projeto_id: string; ad_id: string; motivo?: string }) {
  if (!args.projeto_id || !args.ad_id) return { error: "projeto_id e ad_id obrigatórios" };
  const result = await invokeAdsToggle(ctx, {
    project_id: args.projeto_id,
    entity_type: "ad", entity_id: args.ad_id,
    action: "PAUSED", previous_status: "ACTIVE",
  });
  if (result?.error) return { error: result.error };
  await ctx.supabase.from("imphq_ai_actions").insert({
    kind: "pauseAd", projeto_id: args.projeto_id,
    title: `Anúncio pausado (${args.ad_id})`,
    reason: args.motivo || "Pausado via Imperius chat",
    status: "executed", auto_executed: true, executed_at: new Date().toISOString(),
    risk_level: "low", confidence: 0.95, source: "imperius_chat", created_by: ctx.userId,
    payload: { ad_id: args.ad_id }, result,
  });
  return { ok: true, ad_id: args.ad_id, acao: "PAUSED", result };
}

async function ativarAnuncio(ctx: ToolCtx, args: { projeto_id: string; ad_id: string; motivo?: string }) {
  if (!args.projeto_id || !args.ad_id) return { error: "projeto_id e ad_id obrigatórios" };
  const result = await invokeAdsToggle(ctx, {
    project_id: args.projeto_id,
    entity_type: "ad", entity_id: args.ad_id,
    action: "ACTIVE", previous_status: "PAUSED",
  });
  if (result?.error) return { error: result.error };
  await ctx.supabase.from("imphq_ai_actions").insert({
    kind: "activateAd", projeto_id: args.projeto_id,
    title: `Anúncio ativado (${args.ad_id})`,
    reason: args.motivo || "Ativado via Imperius chat",
    status: "executed", auto_executed: true, executed_at: new Date().toISOString(),
    risk_level: "low", confidence: 0.9, source: "imperius_chat", created_by: ctx.userId,
    payload: { ad_id: args.ad_id }, result,
  });
  return { ok: true, ad_id: args.ad_id, acao: "ACTIVE", result };
}

async function ajustarOrcamentoAdset(ctx: ToolCtx, args: { projeto_id: string; adset_id: string; novo_orcamento: number; orcamento_anterior?: number; motivo?: string }) {
  if (!args.projeto_id || !args.adset_id || !args.novo_orcamento) {
    return { error: "projeto_id, adset_id e novo_orcamento obrigatórios" };
  }
  const { data: act, error } = await ctx.supabase.from("imphq_ai_actions").insert({
    kind: "adjustBudget", projeto_id: args.projeto_id,
    title: `Ajustar orçamento adset ${args.adset_id} → R$ ${args.novo_orcamento.toFixed(2)}/dia`,
    reason: args.motivo || "Ajuste proposto via Imperius chat",
    status: "proposed", auto_executed: false,
    risk_level: "medium", confidence: 0.85,
    source: "imperius_chat", created_by: ctx.userId,
    payload: {
      project_id: args.projeto_id, entity_type: "adset", entity_id: args.adset_id,
      action: "UPDATE_BUDGET",
      daily_budget: args.novo_orcamento,
      previous_budget: args.orcamento_anterior,
    },
  }).select("id").single();
  if (error) return { error: error.message };
  return {
    status: "pending_approval", action_id: act.id,
    adset_id: args.adset_id, novo_orcamento: args.novo_orcamento,
    aviso: "Ajuste de orçamento enviado para a Caixa de Ações — aprove no header para aplicar.",
  };
}


// ===== ONDA 2: WhatsApp =====

async function agendarMensagemWhatsapp(ctx: ToolCtx, args: { lead_id: string; mensagem: string; quando: string }) {
  const { data: lead } = await ctx.supabase.from("imphq_leads").select("id, nome, phone, project_id").eq("id", args.lead_id).maybeSingle();
  if (!lead) return { error: "lead não encontrado" };
  if (!lead.phone) return { error: "lead sem telefone" };
  const prov = await resolveProviderForProject(ctx, lead.project_id);
  if (!prov) return { error: "nenhum provider WhatsApp ativo" };
  const when = new Date(args.quando);
  if (isNaN(when.getTime()) || when.getTime() < Date.now()) return { error: "quando inválido ou no passado" };
  const { data, error } = await ctx.supabase.from("imphq_wa_scheduled").insert({
    project_id: lead.project_id, provider_id: prov.id, phone: lead.phone,
    content: args.mensagem, scheduled_at: when.toISOString(), status: "pending",
    created_by: ctx.userId,
  }).select("id").single();
  if (error) return { error: error.message };
  await ctx.supabase.from("imphq_ai_actions").insert({
    kind: "sendWhatsApp", projeto_id: lead.project_id,
    title: `Agendado WhatsApp para ${lead.nome || lead.phone} em ${when.toISOString()}`,
    reason: args.mensagem.slice(0, 200),
    status: "executed", auto_executed: true, executed_at: new Date().toISOString(),
    risk_level: "low", confidence: 0.95, source: "imperius_chat", created_by: ctx.userId,
    payload: { scheduled_id: data.id, lead_id: lead.id, quando: when.toISOString() },
  });
  return { ok: true, scheduled_id: data.id, lead: lead.nome || lead.phone, quando: when.toISOString() };
}

async function listarAgendamentosWhatsapp(ctx: ToolCtx, args: { projeto_id?: string; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const limite = Math.min(args.limite ?? 30, 100);
  let q = ctx.supabase.from("imphq_wa_scheduled")
    .select("id, phone, content, scheduled_at, status, project_id")
    .eq("status", "pending").order("scheduled_at").limit(limite);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return {
    projeto_id: pid, total: data?.length || 0,
    agendamentos: (data || []).map((s: any) => ({
      id: s.id, phone: s.phone, mensagem: (s.content || "").slice(0, 120),
      quando: s.scheduled_at,
    })),
  };
}

async function cancelarAgendamentoWhatsapp(ctx: ToolCtx, args: { scheduled_id: string }) {
  const { data: sched } = await ctx.supabase.from("imphq_wa_scheduled")
    .select("id, project_id, phone").eq("id", args.scheduled_id).maybeSingle();
  if (!sched) return { error: "agendamento não encontrado" };
  const { error } = await ctx.supabase.from("imphq_wa_scheduled")
    .update({ status: "cancelled" }).eq("id", args.scheduled_id);
  if (error) return { error: error.message };
  await ctx.supabase.from("imphq_ai_actions").insert({
    kind: "notify", projeto_id: sched.project_id,
    title: `Agendamento WhatsApp cancelado (${sched.phone})`,
    status: "executed", auto_executed: true, executed_at: new Date().toISOString(),
    risk_level: "low", confidence: 1.0, source: "imperius_chat", created_by: ctx.userId,
    payload: { scheduled_id: args.scheduled_id },
  });
  return { ok: true, scheduled_id: args.scheduled_id };
}

async function statusChipsWhatsapp(ctx: ToolCtx, args: { projeto_id?: string }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  if (!pid) return { error: "projeto_id obrigatório" };
  const { data, error } = await ctx.supabase.from("imphq_wa_providers")
    .select("id, instance_name, display_name, provider, is_active, last_seen_at, health_alerts_enabled, health_alerts_muted_until")
    .eq("project_id", pid).order("is_active", { ascending: false });
  if (error) return { error: error.message };
  const now = Date.now();
  return {
    projeto_id: pid, total: data?.length || 0,
    chips: (data || []).map((p: any) => {
      const lastSeenMin = p.last_seen_at ? Math.round((now - new Date(p.last_seen_at).getTime()) / 60000) : null;
      let saude = "desconhecida";
      if (!p.is_active) saude = "inativo";
      else if (lastSeenMin == null) saude = "sem_sinal";
      else if (lastSeenMin < 15) saude = "ok";
      else if (lastSeenMin < 60) saude = "atrasado";
      else saude = "offline";
      return {
        id: p.id, nome: p.display_name || p.instance_name, provider: p.provider,
        ativo: p.is_active, ultimo_sinal_min: lastSeenMin, saude,
        alertas_mutados_ate: p.health_alerts_muted_until,
      };
    }),
  };
}

// ===== ONDA 3: Diagnóstico & Previsão =====

async function diagnosticoYoshitani(ctx: ToolCtx, args: { projeto_id?: string; dias?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  if (!pid) return { error: "projeto_id obrigatório" };
  const dias = args.dias ?? 7;
  const sinceDate = new Date(Date.now() - dias * 86400000);
  const sinceISO = sinceDate.toISOString();
  const sinceDay = sinceISO.slice(0, 10);

  const [adsRes, vendasRes, eventsRes] = await Promise.all([
    ctx.supabase.from("imphq_ads_spend").select("valor, custo_por_compra, compras, landing_page_views, link_clicks, checkouts_iniciados, impressoes")
      .eq("project_id", pid).gte("data_ref", sinceDay).limit(2000),
    ctx.supabase.from("imphq_vendas").select("valor").eq("project_id", pid).eq("status", "aprovado").gte("data_venda", sinceISO).limit(2000),
    ctx.supabase.from("imphq_funnel_events").select("step").eq("project_id", pid).gte("created_at", sinceISO).limit(5000),
  ]);

  const ads = adsRes.data || [];
  const gasto = ads.reduce((s: number, a: any) => s + Number(a.valor || 0), 0);
  const compras = ads.reduce((s: number, a: any) => s + Number(a.compras || 0), 0);
  const lpv = ads.reduce((s: number, a: any) => s + Number(a.landing_page_views || 0), 0);
  const clicks = ads.reduce((s: number, a: any) => s + Number(a.link_clicks || 0), 0);
  const checkouts = ads.reduce((s: number, a: any) => s + Number(a.checkouts_iniciados || 0), 0);

  const vendasCount = vendasRes.data?.length || 0;
  const cpa = (compras || vendasCount) > 0 ? gasto / (compras || vendasCount) : null;

  // Yoshitani: meta CPA <= 7x ticket? Sem ticket alvo, usar regras CTR/LP/Checkout
  const lpRate = clicks > 0 ? (lpv / clicks) * 100 : 0;     // alvo: >70%
  const checkoutRate = lpv > 0 ? (checkouts / lpv) * 100 : 0; // alvo: >5%
  const compraRate = checkouts > 0 ? (compras / checkouts) * 100 : 0; // alvo: >30%

  const score = {
    lp: lpRate >= 70 ? 7 : lpRate >= 50 ? 5 : 3,
    checkout: checkoutRate >= 5 ? 7 : checkoutRate >= 3 ? 5 : 3,
    compra: compraRate >= 30 ? 7 : compraRate >= 15 ? 5 : 3,
  };
  const gargalo = Object.entries(score).sort((a, b) => a[1] - b[1])[0][0];

  return {
    projeto_id: pid, dias,
    gasto_total: gasto, vendas_aprovadas: vendasCount, cpa,
    lp_rate_pct: Number(lpRate.toFixed(2)),
    checkout_rate_pct: Number(checkoutRate.toFixed(2)),
    compra_rate_pct: Number(compraRate.toFixed(2)),
    score, gargalo,
    eventos_funil: eventsRes.data?.length || 0,
  };
}

async function previsaoReceita(ctx: ToolCtx, args: { projeto_id?: string }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  if (!pid) return { error: "projeto_id obrigatório" };
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
  const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const diasPassados = Math.max(1, Math.ceil((now.getTime() - inicioMes.getTime()) / 86400000));
  const diasTotal = fimMes.getDate();

  const { data, error } = await ctx.supabase.from("imphq_vendas")
    .select("valor").eq("project_id", pid).eq("status", "aprovado")
    .gte("data_venda", inicioMes.toISOString()).limit(5000);
  if (error) return { error: error.message };
  const receitaAtual = (data || []).reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
  const mediaDiaria = receitaAtual / diasPassados;
  const projecao = mediaDiaria * diasTotal;
  return {
    projeto_id: pid,
    receita_atual: Number(receitaAtual.toFixed(2)),
    media_diaria: Number(mediaDiaria.toFixed(2)),
    dias_passados: diasPassados, dias_total: diasTotal,
    projecao_mes: Number(projecao.toFixed(2)),
    falta_para_projecao: Number((projecao - receitaAtual).toFixed(2)),
  };
}

async function leadsQuentes(ctx: ToolCtx, args: { projeto_id?: string; horas?: number; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const horas = args.horas ?? 2;
  const limite = Math.min(args.limite ?? 30, 100);
  const since = new Date(Date.now() - horas * 3600000).toISOString();

  let q = ctx.supabase.from("imphq_vendas")
    .select("id, lead_id, produto_nome, valor, status, data_venda, plataforma")
    .in("status", ["pix_gerado", "boleto_gerado", "aguardando_pagamento"])
    .gte("data_venda", since).order("data_venda", { ascending: false }).limit(limite);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };

  const leadIds = [...new Set((data || []).map((v: any) => v.lead_id).filter(Boolean))];
  const leadsMap: Record<string, any> = {};
  if (leadIds.length) {
    const { data: leads } = await ctx.supabase.from("imphq_leads").select("id, nome, phone, email").in("id", leadIds);
    for (const l of leads || []) leadsMap[l.id] = l;
  }
  return {
    projeto_id: pid, horas, total: data?.length || 0,
    leads: (data || []).map((v: any) => ({
      venda_id: v.id, lead_id: v.lead_id,
      lead: v.lead_id ? leadsMap[v.lead_id] : null,
      produto: v.produto_nome, valor: Number(v.valor || 0),
      status: v.status, plataforma: v.plataforma, em: v.data_venda,
    })),
  };
}

async function funilPorEtapa(ctx: ToolCtx, args: { projeto_id?: string; dias?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  if (!pid) return { error: "projeto_id obrigatório" };
  const dias = args.dias ?? 7;
  const since = new Date(Date.now() - dias * 86400000).toISOString();
  const { data, error } = await ctx.supabase.from("imphq_funnel_events")
    .select("step").eq("project_id", pid).gte("created_at", since).limit(10000);
  if (error) return { error: error.message };
  const counts = new Map<string, number>();
  for (const e of data || []) {
    const s = e.step || "—";
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  // classificar em etapas macro
  const macro = { aquisicao: 0, conversao: 0, maximizacao: 0, retencao: 0, outros: 0 };
  for (const [step, n] of counts.entries()) {
    const k = step.toLowerCase();
    if (/(page_view|lp_view|click|impressao|view)/.test(k)) macro.aquisicao += n;
    else if (/(checkout|pix|boleto|cart|lead|form)/.test(k)) macro.conversao += n;
    else if (/(upsell|orderbump|downsell)/.test(k)) macro.maximizacao += n;
    else if (/(login|return|retain|engage)/.test(k)) macro.retencao += n;
    else macro.outros += n;
  }
  const detalhe = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([step, n]) => ({ step, eventos: n }));
  return { projeto_id: pid, dias, total: data?.length || 0, macro, detalhe };
}

// ===== Onda 4: Recuperação & Hot Leads =====

async function listarRecuperaveis(ctx: ToolCtx, args: { projeto_id?: string; horas?: number; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const horas = args.horas ?? 24;
  const limite = args.limite ?? 30;
  const since = new Date(Date.now() - horas * 3600000).toISOString();
  let q = ctx.supabase
    .from("imphq_vendas")
    .select("id, valor, produto_nome, status, plataforma, data_venda, lead_id, projeto_id")
    .in("status", ["pix_gerado", "boleto_gerado", "aguardando_pagamento"])
    .gte("data_venda", since)
    .order("data_venda", { ascending: false })
    .limit(limite);
  if (pid) q = q.eq("projeto_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const total = (data || []).reduce((s: number, v: any) => s + (parseFloat(v.valor) || 0), 0);
  return {
    horas, total_recuperavel: total, count: data?.length || 0,
    vendas: (data || []).map((v: any) => ({
      venda_id: v.id, lead_id: v.lead_id, produto: v.produto_nome,
      valor: v.valor, status: v.status, plataforma: v.plataforma, em: v.data_venda,
    })),
  };
}

async function recuperarVendaPix(ctx: ToolCtx, args: { venda_id: string }) {
  if (!args.venda_id) return { error: "venda_id obrigatório" };
  const { data: venda, error: vErr } = await ctx.supabase
    .from("imphq_vendas").select("id, lead_id, projeto_id, status, valor, produto_nome")
    .eq("id", args.venda_id).maybeSingle();
  if (vErr || !venda) return { error: "venda não encontrada" };

  const { data, error } = await ctx.supabase.functions.invoke("hot-lead-responder", {
    body: { venda_id: venda.id, lead_id: venda.lead_id, projeto_id: venda.projeto_id, source: "imperius" },
  });
  if (error) return { error: error.message };

  await ctx.supabase.from("imphq_ai_actions").insert({
    user_id: ctx.userId, projeto_id: venda.projeto_id, kind: "recoverPix",
    title: `Recuperação Pix: ${venda.produto_nome}`, status: "executed",
    auto_executed: true, risk_level: "low", confidence: 0.9,
    impact_brl: venda.valor, payload: { venda_id: venda.id, lead_id: venda.lead_id },
  });
  return { ok: true, venda_id: venda.id, resposta: data };
}

async function listarTemplatesRecuperacao(ctx: ToolCtx, args: { projeto_id?: string; canal?: string }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  let q = ctx.supabase
    .from("imphq_recovery_templates")
    .select("id, tipo, canal, assunto, ativo, project_id")
    .eq("ativo", true).limit(50);
  if (pid) q = q.eq("project_id", pid);
  if (args.canal) q = q.eq("canal", args.canal);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, templates: data || [] };
}

async function pontuarLead(ctx: ToolCtx, args: { lead_id: string }) {
  if (!args.lead_id) return { error: "lead_id obrigatório" };
  const { data: lead } = await ctx.supabase
    .from("imphq_leads")
    .select("id, nome, score, ultimo_evento, ultimo_produto, projeto_id, status")
    .eq("id", args.lead_id).maybeSingle();
  if (!lead) return { error: "lead não encontrado" };
  const { data: logs } = await ctx.supabase
    .from("imphq_lead_scores_log")
    .select("delta, motivo, created_at")
    .eq("lead_id", args.lead_id)
    .order("created_at", { ascending: false }).limit(10);
  return { lead, breakdown_recente: logs || [] };
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
      case "adicionarChecklistNaTarefa": return await adicionarChecklistNaTarefa(ctx, args);
      case "moverTarefa": return await moverTarefa(ctx, args);
      case "agendarLembrete": return await agendarLembrete(ctx, args);
      case "anotarLead": return await anotarLead(ctx, args);
      case "enviarWhatsapp": return await enviarWhatsapp(ctx, args);
      case "enviarWhatsappEmMassa": return await enviarWhatsappEmMassa(ctx, args);
      case "listarAnunciosAtivos": return await listarAnunciosAtivos(ctx, args);
      case "pausarAnuncio": return await pausarAnuncio(ctx, args);
      case "ativarAnuncio": return await ativarAnuncio(ctx, args);
      case "ajustarOrcamentoAdset": return await ajustarOrcamentoAdset(ctx, args);
      case "agendarMensagemWhatsapp": return await agendarMensagemWhatsapp(ctx, args);
      case "listarAgendamentosWhatsapp": return await listarAgendamentosWhatsapp(ctx, args);
      case "cancelarAgendamentoWhatsapp": return await cancelarAgendamentoWhatsapp(ctx, args);
      case "statusChipsWhatsapp": return await statusChipsWhatsapp(ctx, args);
      case "diagnosticoYoshitani": return await diagnosticoYoshitani(ctx, args);
      case "previsaoReceita": return await previsaoReceita(ctx, args);
      case "leadsQuentes": return await leadsQuentes(ctx, args);
      case "funilPorEtapa": return await funilPorEtapa(ctx, args);
      case "listarRecuperaveis": return await listarRecuperaveis(ctx, args);
      case "recuperarVendaPix": return await recuperarVendaPix(ctx, args);
      case "listarTemplatesRecuperacao": return await listarTemplatesRecuperacao(ctx, args);
      case "pontuarLead": return await pontuarLead(ctx, args);
      default: return { error: `tool desconhecida: ${name}` };


    }
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}
