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
      name: "leadsDoDia",
      description: "Conta e lista leads CAPTURADOS em uma data (default hoje). Use quando o usuário perguntar 'quantos leads', 'leads de hoje', 'leads capturados'. NÃO confunda com vendas.",
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
      name: "leadsResumo",
      description: "Resumo de captação de leads por período (default 7d): total, média diária, por dia, por plataforma.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          dias: { type: "number", description: "Janela em dias, default 7" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscarLeads",
      description: "Consulta INVESTIGATIVA de leads com filtros combináveis. Use SEMPRE que o usuário quiser listar/contar leads por período (mês, semana, entre datas), tag, formulário, plataforma, status ou evento (ex: 'preencheram formulário em julho', 'leads com tag X', 'quem respondeu pesquisa esse mês', 'leads sem venda últimos 15 dias'). Prefira esta tool antes de dizer 'não consegui interpretar'.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          desde: { type: "string", description: "ISO YYYY-MM-DD (início do período)" },
          ate: { type: "string", description: "ISO YYYY-MM-DD (fim do período, inclusivo)" },
          tag: { type: "string", description: "Tag exata em imphq_leads.tags" },
          form_id: { type: "string", description: "ID/slug do formulário (form_id ou data->>form_id)" },
          plataforma: { type: "string", description: "hotmart, meta, membros, manychat, etc." },
          status: { type: "string", description: "novo, quente, cliente, perdido..." },
          evento: { type: "string", description: "acao em imphq_lead_scores_log (pesquisa_respondida, membro_cadastrado, prova_enviada, aula_concluida, evento_custom...)" },
          tem_venda: { type: "boolean", description: "true=só com venda aprovada; false=só sem venda" },
          limite: { type: "number", description: "default 50, max 200" },
        },
        additionalProperties: false,
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
      description: "Últimas mensagens recebidas no WhatsApp (quem mandou msg recente). Agrupa por telefone.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          horas: { type: "number", description: "janela em horas (default 24)" },
          limite: { type: "number", description: "default 20" },
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
  // ===== Onda 8: Finanças & Atribuição =====
  {
    type: "function",
    function: {
      name: "lucroDoDia",
      description: "Calcula lucro do dia: receita aprovada (líquida quando disponível) menos gasto em ads. Mostra ROAS e margem.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          data: { type: "string", description: "YYYY-MM-DD (default hoje)" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "roasPorCriativo",
      description: "ROAS por criativo (anúncio) nos últimos N dias. Cruza imphq_ads_spend.anuncio com imphq_vendas.utm_term. Ordena por receita.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          dias: { type: "number", description: "default 7" },
          limite: { type: "number", description: "default 15" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "projecaoLucroMes",
      description: "Projeta lucro do mês corrente: extrapola receita e gasto pelos dias já decorridos vs total do mês.",
      parameters: {
        type: "object",
        properties: { projeto_id: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "alertaQueimaOrcamento",
      description: "Detecta adsets queimando dinheiro: gasto alto sem compras nas últimas 24-72h ou CPA muito acima da média.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          horas: { type: "number", description: "default 48" },
          gasto_minimo: { type: "number", description: "default 50 (R$)" },
        }, additionalProperties: false,
      },
    },
  },
  // ===== Onda 7: Calendário & Operação =====
  {
    type: "function",
    function: {
      name: "proximosEventosCalendario",
      description: "Próximos eventos do calendário (lives, lançamentos, reuniões) nos próximos N dias.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          dias: { type: "number", description: "default 7" },
          limite: { type: "number", description: "default 10" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tarefasAtrasadas",
      description: "Lista cards do Kanban com due_date vencido e ainda não concluídos. Inclui prioridade e responsável.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          limite: { type: "number", description: "default 20" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "statusWebinar",
      description: "Status do próximo webinar/aula: inscritos, cliques, agendamento, templates de pitch/reminder.",
      parameters: {
        type: "object",
        properties: { projeto_id: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "briefingDiario",
      description: "Briefing operacional do dia: vendas, hot leads, tarefas atrasadas, próximos eventos e alertas. Use no início do expediente.",
      parameters: {
        type: "object",
        properties: { projeto_id: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  // ===== Onda 5: Criativos & Inteligência de Mercado =====
  {
    type: "function",
    function: {
      name: "listarBatchesCriativos",
      description: "Lista batches recentes de criativos gerados (imphq_creative_batches) com status e contagem de assets.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          limite: { type: "number", description: "default 10" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "topCriativos",
      description: "Top criativos por performance (CTR/compras) cruzando imphq_creative_assets com imphq_ads_spend nos últimos N dias.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          dias: { type: "number", description: "default 14" },
          limite: { type: "number", description: "default 10" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "oportunidadesMercado",
      description: "Lista oportunidades de mercado detectadas (imphq_mi_opportunities): ângulos, dores, gaps de concorrentes.",
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
      name: "concorrentesAtivos",
      description: "Lista concorrentes monitorados (imphq_competitors) com criativos ativos e estimativa de atividade.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          limite: { type: "number", description: "default 10" },
        }, additionalProperties: false,
      },
    },
  },
  // ===== Onda 10: Equipe & Tarefas Avançadas =====
  {
    type: "function",
    function: {
      name: "listarEquipe",
      description: "Lista membros da equipe (imphq_team_members) ativos, com nome, email, role e department.",
      parameters: { type: "object", properties: { apenas_ativos: { type: "boolean", description: "default true" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "cargaTrabalhoEquipe",
      description: "Carga de trabalho: agrupa tarefas abertas (imphq_kanban_cards não concluídas) por responsável, com count e atrasadas.",
      parameters: { type: "object", properties: { projeto_id: { type: "string" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "tarefasPorResponsavel",
      description: "Lista tarefas abertas de um membro específico (busca por nome ou email).",
      parameters: {
        type: "object",
        properties: {
          responsavel: { type: "string", description: "nome ou email do membro" },
          projeto_id: { type: "string" },
          limite: { type: "number", description: "default 20" },
        },
        required: ["responsavel"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atribuirTarefa",
      description: "Atribui uma tarefa do kanban a um membro da equipe (busca por nome/email).",
      parameters: {
        type: "object",
        properties: {
          tarefa_id: { type: "string" },
          responsavel: { type: "string", description: "nome ou email" },
        },
        required: ["tarefa_id", "responsavel"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estatisticasKanban",
      description: "Distribuição de cards por coluna do kanban de um projeto, com totais e % de progresso.",
      parameters: {
        type: "object",
        properties: { projeto_id: { type: "string" } }, additionalProperties: false,
      },
    },
  },
  // ===== Onda 11: Finanças & Recuperação =====
  {
    type: "function",
    function: {
      name: "vendasPorPlataforma",
      description: "Split de receita aprovada por plataforma (Hotmart/Kiwify/Ticto/etc) nos últimos N dias. Retorna receita, vendas e ticket médio por plataforma.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          dias: { type: "number", description: "default 30" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "chargebacksRecentes",
      description: "Lista vendas com status chargeback, reembolsada ou cancelada nos últimos N dias. Inclui valor perdido total.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          dias: { type: "number", description: "default 30" },
          limite: { type: "number", description: "default 50" },
        }, additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fluxoCaixaMes",
      description: "Fluxo de caixa do mês atual: receita aprovada vs custos (imphq_project_costs + imphq_custos + ads) com margem e projeção até fim do mês.",
      parameters: {
        type: "object",
        properties: { projeto_id: { type: "string" } }, additionalProperties: false,
      },
    },
  },
  // ===== Onda 12: Automações & OpenFlow =====
  {
    type: "function",
    function: {
      name: "automacoesAtivas",
      description: "Lista automações ativas (imphq_automacoes) com contagem de execuções nas últimas 24h e status.",
      parameters: {
        type: "object",
        properties: { projeto_id: { type: "string" }, limite: { type: "number", description: "default 20" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execucoesTravadas",
      description: "Lista execuções de fluxos (imphq_flow_executions) em status 'waiting' ou 'error' há mais de N horas. Detecta automações travadas.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          horas: { type: "number", description: "default 1" },
          limite: { type: "number", description: "default 30" },
        }, additionalProperties: false,
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

  // 1ª tentativa: ilike literal
  const r1 = await ctx.supabase
    .from("imphq_projects")
    .select("id, name, active")
    .ilike("name", `%${t}%`)
    .limit(10);
  if ((r1.data || []).length) {
    return { termo_buscado: t, matches: r1.data!.map((p: any) => ({ id: p.id, nome: p.name, ativo: p.active })) };
  }

  // 2ª tentativa: tokens ≥ 3 chars com OR
  const tokens = t.split(/\s+/).filter((x) => x.length >= 3);
  if (tokens.length) {
    const orExpr = tokens.map((tok) => `name.ilike.%${tok.replace(/[,()]/g, "")}%`).join(",");
    const r2 = await ctx.supabase
      .from("imphq_projects")
      .select("id, name, active")
      .or(orExpr)
      .limit(10);
    if ((r2.data || []).length) {
      return {
        termo_buscado: t,
        fallback: "match_por_token",
        matches: r2.data!.map((p: any) => ({ id: p.id, nome: p.name, ativo: p.active })),
      };
    }
  }

  // 3ª tentativa: devolve candidatos ativos para o modelo perguntar
  const r3 = await ctx.supabase
    .from("imphq_projects")
    .select("id, name, active, is_archived")
    .eq("is_archived", false)
    .order("name")
    .limit(10);
  return {
    termo_buscado: t,
    fallback: "sem_match_exato",
    matches: [],
    candidatos: (r3.data || []).map((p: any) => ({ id: p.id, nome: p.name, ativo: p.active })),
  };
}

function resolveProjectId(ctx: ToolCtx, given?: string) {
  return given || ctx.projectId || null;
}

async function leadsDoDia(ctx: ToolCtx, args: { projeto_id?: string; data?: string }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const dia = args.data || new Date().toISOString().slice(0, 10);
  const start = `${dia}T00:00:00`;
  const end = `${dia}T23:59:59.999`;
  let q = ctx.supabase
    .from("imphq_leads")
    .select("id, nome, email, phone, plataforma, status, created_at")
    .gte("created_at", start).lte("created_at", end)
    .order("created_at", { ascending: false })
    .limit(500);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const porPlataforma: Record<string, number> = {};
  for (const l of data || []) {
    const k = l.plataforma || "—";
    porPlataforma[k] = (porPlataforma[k] || 0) + 1;
  }
  return {
    data: dia,
    projeto_id: pid,
    total: data?.length || 0,
    por_plataforma: porPlataforma,
    ultimos: (data || []).slice(0, 10).map((l: any) => ({
      nome: l.nome, email: l.email, phone: l.phone, plataforma: l.plataforma, hora: l.created_at,
    })),
  };
}

async function leadsResumo(ctx: ToolCtx, args: { projeto_id?: string; dias?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const dias = args.dias ?? 7;
  const since = new Date(Date.now() - dias * 86400000).toISOString();
  let q = ctx.supabase.from("imphq_leads")
    .select("plataforma, created_at").gte("created_at", since).limit(5000);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const porDia: Record<string, number> = {};
  const porPlat: Record<string, number> = {};
  for (const l of data || []) {
    const d = (l.created_at || "").slice(0, 10);
    porDia[d] = (porDia[d] || 0) + 1;
    const k = l.plataforma || "—";
    porPlat[k] = (porPlat[k] || 0) + 1;
  }
  const total = data?.length || 0;
  return {
    projeto_id: pid,
    dias,
    total_periodo: total,
    media_diaria: Number((total / dias).toFixed(1)),
    por_dia: Object.entries(porDia).sort((a, b) => a[0].localeCompare(b[0])).map(([data, count]) => ({ data, count })),
    top_plataformas: Object.entries(porPlat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([plataforma, count]) => ({ plataforma, count })),
  };
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
    .eq("direction", "incoming")
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
      .select("id").eq("conversation_id", m.conversation_id).eq("direction", "outgoing")
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

async function ultimasMensagensWhatsapp(ctx: ToolCtx, args: { projeto_id?: string; limite?: number; horas?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const horas = Math.max(1, Math.min(args.horas ?? 24, 168));
  const limite = Math.min(args.limite ?? 20, 50);
  const since = new Date(Date.now() - horas * 3600000).toISOString();
  let q = ctx.supabase.from("imphq_wa_messages")
    .select("content, phone, conversation_id, created_at, project_id")
    .eq("direction", "incoming")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message, projeto_id: pid, horas, leads: [] };
  // Agrupar por phone
  const byPhone = new Map<string, { phone: string; conversation_id: string; qtd: number; ultima: string; em: string }>();
  for (const m of data || []) {
    const ph = m.phone || "";
    if (!ph) continue;
    const cur = byPhone.get(ph);
    if (!cur) {
      byPhone.set(ph, {
        phone: ph, conversation_id: m.conversation_id, qtd: 1,
        ultima: (m.content || "").slice(0, 160), em: m.created_at,
      });
    } else {
      cur.qtd += 1;
    }
  }
  // Enriquecer com nomes dos leads
  const phones = Array.from(byPhone.keys());
  if (phones.length > 0) {
    const { data: leads } = await ctx.supabase.from("imphq_leads")
      .select("nome, telefone, phone").or(`phone.in.(${phones.map((p) => `"${p}"`).join(",")}),telefone.in.(${phones.map((p) => `"${p}"`).join(",")})`)
      .limit(500);
    const nomeMap = new Map<string, string>();
    for (const l of leads || []) {
      const k = (l.phone || l.telefone || "").replace(/\D/g, "");
      if (k && l.nome) nomeMap.set(k, l.nome);
    }
    for (const v of byPhone.values()) {
      const k = (v.phone || "").replace(/\D/g, "");
      (v as any).nome = nomeMap.get(k) || null;
    }
  }
  const leads = Array.from(byPhone.values())
    .sort((a, b) => new Date(b.em).getTime() - new Date(a.em).getTime())
    .slice(0, limite);
  return {
    projeto_id: pid, horas, total: leads.length,
    mensagens: leads, // mantém chave usada pelo card
    leads,
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

// ===== Onda 8: Finanças & Atribuição =====

async function lucroDoDia(ctx: ToolCtx, args: { projeto_id?: string; data?: string }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const dia = args.data || new Date().toISOString().slice(0, 10);
  const start = `${dia}T00:00:00`;
  const end = `${dia}T23:59:59`;

  let qv = ctx.supabase.from("imphq_vendas")
    .select("valor, valor_liquido, status")
    .eq("status", "aprovado")
    .gte("data_venda", start).lte("data_venda", end).limit(2000);
  if (pid) qv = qv.eq("project_id", pid);
  const { data: vendas } = await qv;
  const receita_bruta = (vendas || []).reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
  const receita_liquida = (vendas || []).reduce((s: number, v: any) => s + Number(v.valor_liquido || v.valor || 0), 0);

  let qa = ctx.supabase.from("imphq_ads_spend")
    .select("valor").eq("data_ref", dia).limit(2000);
  if (pid) qa = qa.eq("project_id", pid);
  const { data: ads } = await qa;
  const gasto_ads = (ads || []).reduce((s: number, a: any) => s + Number(a.valor || 0), 0);

  const lucro = receita_liquida - gasto_ads;
  return {
    projeto_id: pid, data: dia,
    receita_bruta, receita_liquida, gasto_ads,
    lucro_estimado: lucro,
    roas: gasto_ads > 0 ? receita_bruta / gasto_ads : null,
    margem_pct: receita_liquida > 0 ? (lucro / receita_liquida) * 100 : null,
    vendas_count: vendas?.length || 0,
  };
}

async function roasPorCriativo(ctx: ToolCtx, args: { projeto_id?: string; dias?: number; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const dias = args.dias ?? 7;
  const limite = Math.min(args.limite ?? 15, 50);
  const sinceDate = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const sinceTs = new Date(Date.now() - dias * 86400000).toISOString();

  let qa = ctx.supabase.from("imphq_ads_spend")
    .select("anuncio, ad_id, valor, compras").gte("data_ref", sinceDate).limit(5000);
  if (pid) qa = qa.eq("project_id", pid);
  const { data: ads } = await qa;

  const adMap = new Map<string, { gasto: number; compras: number }>();
  for (const a of ads || []) {
    const k = (a.anuncio || a.ad_id || "—").toString().trim();
    if (!k || k === "—") continue;
    const cur = adMap.get(k) || { gasto: 0, compras: 0 };
    cur.gasto += Number(a.valor || 0);
    cur.compras += Number(a.compras || 0);
    adMap.set(k, cur);
  }

  let qv = ctx.supabase.from("imphq_vendas")
    .select("valor, utm_term").eq("status", "aprovado").gte("data_venda", sinceTs).limit(5000);
  if (pid) qv = qv.eq("project_id", pid);
  const { data: vendas } = await qv;

  const revMap = new Map<string, { receita: number; vendas: number }>();
  for (const v of vendas || []) {
    const k = (v.utm_term || "").toString().trim();
    if (!k) continue;
    const cur = revMap.get(k) || { receita: 0, vendas: 0 };
    cur.receita += Number(v.valor || 0);
    cur.vendas += 1;
    revMap.set(k, cur);
  }

  const rows = [...adMap.entries()].map(([anuncio, a]) => {
    const r = revMap.get(anuncio) || { receita: 0, vendas: 0 };
    return {
      anuncio,
      gasto: Number(a.gasto.toFixed(2)),
      compras_pixel: a.compras,
      vendas_atribuidas: r.vendas,
      receita_atribuida: Number(r.receita.toFixed(2)),
      roas: a.gasto > 0 ? Number((r.receita / a.gasto).toFixed(2)) : null,
      cpa: a.compras > 0 ? Number((a.gasto / a.compras).toFixed(2)) : null,
    };
  }).sort((a, b) => (b.receita_atribuida || 0) - (a.receita_atribuida || 0));

  return {
    projeto_id: pid, dias,
    total_criativos: rows.length,
    top: rows.slice(0, limite),
    sem_atribuicao_utm: rows.filter(r => r.vendas_atribuidas === 0 && r.gasto > 50).slice(0, 10),
  };
}

async function projecaoLucroMes(ctx: ToolCtx, args: { projeto_id?: string }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const now = new Date();
  const ano = now.getUTCFullYear();
  const mes = now.getUTCMonth();
  const inicioMes = new Date(Date.UTC(ano, mes, 1)).toISOString();
  const inicioMesDate = inicioMes.slice(0, 10);
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const diaAtual = now.getUTCDate();

  let qv = ctx.supabase.from("imphq_vendas")
    .select("valor, valor_liquido").eq("status", "aprovado").gte("data_venda", inicioMes).limit(10000);
  if (pid) qv = qv.eq("project_id", pid);
  const { data: vendas } = await qv;
  const receita_bruta = (vendas || []).reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
  const receita_liquida = (vendas || []).reduce((s: number, v: any) => s + Number(v.valor_liquido || v.valor || 0), 0);

  let qa = ctx.supabase.from("imphq_ads_spend")
    .select("valor").gte("data_ref", inicioMesDate).limit(10000);
  if (pid) qa = qa.eq("project_id", pid);
  const { data: ads } = await qa;
  const gasto = (ads || []).reduce((s: number, a: any) => s + Number(a.valor || 0), 0);

  const fator = diaAtual > 0 ? diasNoMes / diaAtual : 1;
  return {
    projeto_id: pid,
    dia_atual: diaAtual, dias_no_mes: diasNoMes,
    realizado: {
      receita_bruta, receita_liquida, gasto_ads: gasto,
      lucro: receita_liquida - gasto,
      roas: gasto > 0 ? receita_bruta / gasto : null,
    },
    projecao_fim_mes: {
      receita_bruta: receita_bruta * fator,
      receita_liquida: receita_liquida * fator,
      gasto_ads: gasto * fator,
      lucro: (receita_liquida - gasto) * fator,
    },
    vendas_count: vendas?.length || 0,
  };
}

async function alertaQueimaOrcamento(ctx: ToolCtx, args: { projeto_id?: string; horas?: number; gasto_minimo?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const horas = args.horas ?? 48;
  const gastoMin = args.gasto_minimo ?? 50;
  const dias = Math.max(1, Math.ceil(horas / 24));
  const since = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

  let qa = ctx.supabase.from("imphq_ads_spend")
    .select("anuncio, conjunto_anuncios, adset_id, ad_id, valor, compras, custo_por_compra, data_ref, project_id")
    .gte("data_ref", since).limit(5000);
  if (pid) qa = qa.eq("project_id", pid);
  const { data: ads } = await qa;

  const adsetMap = new Map<string, { adset_id: string; nome: string; gasto: number; compras: number }>();
  for (const a of ads || []) {
    const key = a.adset_id || a.conjunto_anuncios || a.anuncio || a.ad_id;
    if (!key) continue;
    const cur = adsetMap.get(key) || { adset_id: a.adset_id, nome: a.conjunto_anuncios || a.anuncio || key, gasto: 0, compras: 0 };
    cur.gasto += Number(a.valor || 0);
    cur.compras += Number(a.compras || 0);
    adsetMap.set(key, cur);
  }

  // CPA médio para referência
  const cpas = [...adsetMap.values()].filter(a => a.compras > 0).map(a => a.gasto / a.compras);
  const cpaMedio = cpas.length ? cpas.reduce((s, x) => s + x, 0) / cpas.length : 0;
  const cpaAlvo = cpaMedio * 1.8; // 80% acima da média

  const alertas = [...adsetMap.values()].map(a => {
    const cpa = a.compras > 0 ? a.gasto / a.compras : null;
    let motivo: string | null = null;
    if (a.gasto >= gastoMin && a.compras === 0) motivo = "sem_compras";
    else if (cpaAlvo > 0 && cpa && cpa > cpaAlvo) motivo = "cpa_alto";
    return { adset: a.nome, adset_id: a.adset_id, gasto: Number(a.gasto.toFixed(2)), compras: a.compras, cpa: cpa ? Number(cpa.toFixed(2)) : null, motivo };
  }).filter(a => a.motivo)
    .sort((a, b) => b.gasto - a.gasto);

  return {
    projeto_id: pid, horas, gasto_minimo: gastoMin,
    cpa_medio: Number(cpaMedio.toFixed(2)),
    cpa_alvo_alerta: Number(cpaAlvo.toFixed(2)),
    total_alertas: alertas.length,
    queimando: alertas.slice(0, 15),
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

// ===== Onda 7: Calendário & Operação =====

async function proximosEventosCalendario(ctx: ToolCtx, args: { projeto_id?: string; dias?: number; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const dias = args.dias ?? 7;
  const limite = args.limite ?? 10;
  const agora = new Date().toISOString();
  const ate = new Date(Date.now() + dias * 86400000).toISOString();
  let q = ctx.supabase
    .from("imphq_calendar_events")
    .select("id, title, event_date, end_date, event_type, all_day, project_id")
    .gte("event_date", agora).lte("event_date", ate)
    .order("event_date", { ascending: true }).limit(limite);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, eventos: data || [] };
}

async function tarefasAtrasadas(ctx: ToolCtx, args: { projeto_id?: string; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const limite = args.limite ?? 20;
  const hoje = new Date().toISOString().slice(0, 10);
  // pega colunas que NÃO são done/concluído
  let colsQ = ctx.supabase.from("imphq_kanban_columns").select("id, title, project_id");
  if (pid) colsQ = colsQ.eq("project_id", pid);
  const { data: cols } = await colsQ;
  const colsAbertas = (cols || []).filter((c: any) => !/conclu|done|finaliz/i.test(c.title || ""));
  const colIds = colsAbertas.map((c: any) => c.id);
  if (colIds.length === 0) return { count: 0, tarefas: [] };
  const { data, error } = await ctx.supabase
    .from("imphq_kanban_cards")
    .select("id, title, due_date, priority, assignee_id, project_id, column_id")
    .in("column_id", colIds)
    .lt("due_date", hoje)
    .not("due_date", "is", null)
    .order("due_date", { ascending: true }).limit(limite);
  if (error) return { error: error.message };
  return { count: data?.length || 0, tarefas: data || [] };
}

async function statusWebinar(ctx: ToolCtx, args: { projeto_id?: string }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  let q = ctx.supabase
    .from("imphq_webinar_sessions")
    .select("id, nome, scheduled_at, checkout_url, pitch_label, project_id")
    .gte("scheduled_at", new Date(Date.now() - 86400000).toISOString())
    .order("scheduled_at", { ascending: true }).limit(1);
  if (pid) q = q.eq("project_id", pid);
  const { data: sessions } = await q;
  const sess = sessions?.[0];
  if (!sess) return { aviso: "Nenhum webinar futuro agendado." };
  const [{ count: inscritos }, { count: cliques }] = await Promise.all([
    ctx.supabase.from("imphq_webinar_registrations").select("id", { count: "exact", head: true }).eq("session_id", sess.id),
    ctx.supabase.from("imphq_webinar_clicks").select("id", { count: "exact", head: true }).eq("session_id", sess.id),
  ]);
  return { webinar: sess, inscritos: inscritos || 0, cliques: cliques || 0 };
}

async function briefingDiario(ctx: ToolCtx, args: { projeto_id?: string }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const [vendas, hot, tarefas, eventos] = await Promise.all([
    vendasDoDia(ctx, { projeto_id: pid || undefined }),
    leadsQuentes(ctx, { projeto_id: pid || undefined, horas: 2, limite: 10 }),
    tarefasAtrasadas(ctx, { projeto_id: pid || undefined, limite: 10 }),
    proximosEventosCalendario(ctx, { projeto_id: pid || undefined, dias: 3, limite: 5 }),
  ]);
  return {
    vendas_hoje: { count: (vendas as any)?.count || 0, receita: (vendas as any)?.receita_total || 0 },
    hot_leads: { count: (hot as any)?.count || 0, leads: (hot as any)?.leads?.slice(0, 5) || [] },
    tarefas_atrasadas: { count: (tarefas as any)?.count || 0 },
    proximos_eventos: { count: (eventos as any)?.count || 0, eventos: (eventos as any)?.eventos || [] },
  };
}



// ===== Onda 5: Criativos & Inteligência de Mercado =====

async function listarBatchesCriativos(ctx: ToolCtx, args: { projeto_id?: string; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const limite = args.limite ?? 10;
  let q = ctx.supabase
    .from("imphq_creative_batches")
    .select("id, name, status, created_at, project_id, total_assets, completed_assets")
    .order("created_at", { ascending: false }).limit(limite);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, batches: data || [] };
}

async function topCriativos(ctx: ToolCtx, args: { projeto_id?: string; dias?: number; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const dias = args.dias ?? 14;
  const limite = args.limite ?? 10;
  const since = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  let q = ctx.supabase
    .from("imphq_ads_spend")
    .select("anuncio, ad_id, gasto, compras, cliques, impressoes, valor_conversao")
    .gte("data_ref", since);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q.limit(2000);
  if (error) return { error: error.message };
  const agg = new Map<string, any>();
  for (const r of (data || [])) {
    const key = r.ad_id || r.anuncio || "—";
    const cur = agg.get(key) || { criativo: r.anuncio || key, gasto: 0, compras: 0, cliques: 0, impressoes: 0, receita: 0 };
    cur.gasto += Number(r.gasto || 0);
    cur.compras += Number(r.compras || 0);
    cur.cliques += Number(r.cliques || 0);
    cur.impressoes += Number(r.impressoes || 0);
    cur.receita += Number(r.valor_conversao || 0);
    agg.set(key, cur);
  }
  const rows = [...agg.values()].map((r) => ({
    ...r,
    ctr: r.impressoes ? +(r.cliques / r.impressoes * 100).toFixed(2) : 0,
    cpa: r.compras ? +(r.gasto / r.compras).toFixed(2) : null,
    roas: r.gasto ? +(r.receita / r.gasto).toFixed(2) : 0,
  })).sort((a, b) => b.compras - a.compras || b.receita - a.receita).slice(0, limite);
  return { dias, count: rows.length, criativos: rows };
}

async function oportunidadesMercado(ctx: ToolCtx, args: { projeto_id?: string; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const limite = args.limite ?? 15;
  let q = ctx.supabase
    .from("imphq_mi_opportunities")
    .select("id, titulo, descricao, tipo, score, created_at, project_id")
    .order("score", { ascending: false }).limit(limite);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, oportunidades: data || [] };
}

// ===== Onda 10: Equipe & Tarefas Avançadas =====

async function listarEquipe(ctx: ToolCtx, args: { apenas_ativos?: boolean }) {
  const apenas = args.apenas_ativos !== false;
  let q = ctx.supabase.from("imphq_team_members")
    .select("id, user_id, name, email, role, department, is_active")
    .order("name", { ascending: true });
  if (apenas) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, membros: data || [] };
}

async function cargaTrabalhoEquipe(ctx: ToolCtx, args: { projeto_id?: string }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const { data: cols } = await ctx.supabase.from("imphq_kanban_columns").select("id, title");
  const closedIds = new Set((cols || []).filter((c: any) => /conclu|done|finaliz/i.test(c.title || "")).map((c: any) => c.id));
  let q = ctx.supabase.from("imphq_kanban_cards").select("id, assignee_id, due_date, column_id, project_id").limit(2000);
  if (pid) q = q.eq("project_id", pid);
  const { data: cards, error } = await q;
  if (error) return { error: error.message };
  const open = (cards || []).filter((c: any) => !closedIds.has(c.column_id));
  const { data: team } = await ctx.supabase.from("imphq_team_members").select("user_id, name, email");
  const nameMap = new Map<string, string>();
  (team || []).forEach((t: any) => { if (t.user_id) nameMap.set(t.user_id, t.name || t.email || t.user_id); });
  const agg = new Map<string, { responsavel: string; abertas: number; atrasadas: number }>();
  const hoje = new Date().toISOString().slice(0, 10);
  for (const c of open) {
    const key = c.assignee_id || "sem_responsavel";
    const nome = c.assignee_id ? (nameMap.get(c.assignee_id) || "—") : "Sem responsável";
    const cur = agg.get(key) || { responsavel: nome, abertas: 0, atrasadas: 0 };
    cur.abertas += 1;
    if (c.due_date && c.due_date < hoje) cur.atrasadas += 1;
    agg.set(key, cur);
  }
  const rows = [...agg.values()].sort((a, b) => b.abertas - a.abertas);
  return { total_abertas: open.length, por_responsavel: rows };
}

async function tarefasPorResponsavel(ctx: ToolCtx, args: { responsavel: string; projeto_id?: string; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const limite = args.limite ?? 20;
  const term = `%${args.responsavel}%`;
  const { data: team } = await ctx.supabase.from("imphq_team_members")
    .select("user_id, name, email").or(`name.ilike.${term},email.ilike.${term}`);
  if (!team?.length) return { error: `Nenhum membro encontrado para "${args.responsavel}"` };
  if (team.length > 1) return { ambiguo: true, candidatos: team.map((t: any) => ({ nome: t.name, email: t.email })) };
  const userId = team[0].user_id;
  if (!userId) return { error: "Membro sem user_id vinculado" };
  const { data: cols } = await ctx.supabase.from("imphq_kanban_columns").select("id, title");
  const closedIds = new Set((cols || []).filter((c: any) => /conclu|done|finaliz/i.test(c.title || "")).map((c: any) => c.id));
  const colMap = new Map((cols || []).map((c: any) => [c.id, c.title]));
  let q = ctx.supabase.from("imphq_kanban_cards")
    .select("id, title, due_date, priority, column_id, project_id, created_at")
    .eq("assignee_id", userId).order("due_date", { ascending: true, nullsFirst: false }).limit(limite);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const rows = (data || []).filter((c: any) => !closedIds.has(c.column_id))
    .map((c: any) => ({ ...c, coluna: colMap.get(c.column_id) || "—" }));
  return { responsavel: team[0].name || team[0].email, count: rows.length, tarefas: rows };
}

async function atribuirTarefa(ctx: ToolCtx, args: { tarefa_id: string; responsavel: string }) {
  const term = `%${args.responsavel}%`;
  const { data: team } = await ctx.supabase.from("imphq_team_members")
    .select("user_id, name, email").or(`name.ilike.${term},email.ilike.${term}`);
  if (!team?.length) return { error: `Membro "${args.responsavel}" não encontrado` };
  if (team.length > 1) return { ambiguo: true, candidatos: team.map((t: any) => ({ nome: t.name, email: t.email })) };
  const userId = team[0].user_id;
  if (!userId) return { error: "Membro sem user_id vinculado" };
  const { data, error } = await ctx.supabase.from("imphq_kanban_cards")
    .update({ assignee_id: userId, updated_at: new Date().toISOString() })
    .eq("id", args.tarefa_id).select("id, title").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Tarefa não encontrada" };
  return { ok: true, tarefa: data.title, atribuida_a: team[0].name || team[0].email };
}

async function estatisticasKanban(ctx: ToolCtx, args: { projeto_id?: string }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  if (!pid) return { error: "projeto_id é obrigatório" };
  const { data: cols } = await ctx.supabase.from("imphq_kanban_columns")
    .select("id, title, position").eq("project_id", pid).order("position");
  const { data: cards } = await ctx.supabase.from("imphq_kanban_cards")
    .select("column_id, due_date").eq("project_id", pid).limit(2000);
  const hoje = new Date().toISOString().slice(0, 10);
  const colCount = new Map<string, { abertas: number; atrasadas: number }>();
  for (const c of cards || []) {
    const cur = colCount.get(c.column_id) || { abertas: 0, atrasadas: 0 };
    cur.abertas += 1;
    if (c.due_date && c.due_date < hoje) cur.atrasadas += 1;
    colCount.set(c.column_id, cur);
  }
  const total = cards?.length || 0;
  const colunas = (cols || []).map((c: any) => {
    const st = colCount.get(c.id) || { abertas: 0, atrasadas: 0 };
    const isDone = /conclu|done|finaliz/i.test(c.title || "");
    return { coluna: c.title, cards: st.abertas, atrasadas: st.atrasadas, pct: total ? +(st.abertas / total * 100).toFixed(1) : 0, concluida: isDone };
  });
  const concluidas = colunas.filter((c) => c.concluida).reduce((s, c) => s + c.cards, 0);
  return { total_cards: total, concluidas, em_aberto: total - concluidas, progresso_pct: total ? +(concluidas / total * 100).toFixed(1) : 0, colunas };
}

async function concorrentesAtivos(ctx: ToolCtx, args: { projeto_id?: string; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const limite = args.limite ?? 10;
  let q = ctx.supabase
    .from("imphq_competitors")
    .select("id, nome, dominio, ads_ativos, ultima_analise, project_id")
    .order("ads_ativos", { ascending: false, nullsFirst: false }).limit(limite);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, concorrentes: data || [] };
}


// ===== Onda 11: Finanças & Recuperação =====
async function vendasPorPlataforma(ctx: ToolCtx, args: { projeto_id?: string; dias?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const dias = args.dias ?? 30;
  const since = new Date(Date.now() - dias * 86400000).toISOString();
  let q = ctx.supabase.from("imphq_vendas")
    .select("valor, plataforma").eq("status", "aprovado").gte("data_venda", since).limit(5000);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const map = new Map<string, { receita: number; vendas: number }>();
  for (const v of data || []) {
    const k = v.plataforma || "outro";
    const cur = map.get(k) || { receita: 0, vendas: 0 };
    cur.receita += Number(v.valor || 0); cur.vendas += 1;
    map.set(k, cur);
  }
  const plataformas = Array.from(map.entries()).map(([nome, v]) => ({
    plataforma: nome, receita: +v.receita.toFixed(2), vendas: v.vendas,
    ticket_medio: v.vendas ? +(v.receita / v.vendas).toFixed(2) : 0,
  })).sort((a, b) => b.receita - a.receita);
  const total = plataformas.reduce((s, p) => s + p.receita, 0);
  return { dias, projeto_id: pid, receita_total: +total.toFixed(2), plataformas };
}

async function chargebacksRecentes(ctx: ToolCtx, args: { projeto_id?: string; dias?: number; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const dias = args.dias ?? 30;
  const limite = args.limite ?? 50;
  const since = new Date(Date.now() - dias * 86400000).toISOString();
  let q = ctx.supabase.from("imphq_vendas")
    .select("id, valor, produto_nome, status, plataforma, data_venda, lead_id")
    .in("status", ["chargeback", "reembolsada", "cancelada"])
    .gte("data_venda", since)
    .order("data_venda", { ascending: false }).limit(limite);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const perdido = (data || []).reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
  const porStatus = new Map<string, number>();
  for (const v of data || []) porStatus.set(v.status, (porStatus.get(v.status) || 0) + 1);
  return {
    dias, count: data?.length || 0, valor_perdido: +perdido.toFixed(2),
    por_status: Object.fromEntries(porStatus),
    vendas: (data || []).map((v: any) => ({
      id: v.id, produto: v.produto_nome, valor: Number(v.valor || 0),
      status: v.status, plataforma: v.plataforma, em: v.data_venda,
    })),
  };
}

async function fluxoCaixaMes(ctx: ToolCtx, args: { projeto_id?: string }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const diaAtual = now.getDate();
  let qv = ctx.supabase.from("imphq_vendas").select("valor")
    .eq("status", "aprovado").gte("data_venda", inicioMes).limit(5000);
  if (pid) qv = qv.eq("project_id", pid);
  let qc = ctx.supabase.from("imphq_project_costs").select("valor, created_at").gte("created_at", inicioMes).limit(2000);
  if (pid) qc = qc.eq("project_id", pid);
  let qa = ctx.supabase.from("imphq_ads_spend").select("valor").gte("data_ref", inicioMes.slice(0, 10)).limit(5000);
  if (pid) qa = qa.eq("project_id", pid);
  const [{ data: vendas }, { data: custos }, { data: ads }] = await Promise.all([qv, qc, qa] as PromiseLike<any>[]);
  const receita = (vendas || []).reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
  const custoFixo = (custos || []).reduce((s: number, c: any) => s + Number(c.valor || 0), 0);
  const custoAds = (ads || []).reduce((s: number, a: any) => s + Number(a.valor || 0), 0);
  const custoTotal = custoFixo + custoAds;
  const margem = receita - custoTotal;
  return {
    projeto_id: pid, dia_atual: diaAtual, dias_no_mes: diasNoMes,
    receita: +receita.toFixed(2), custo_ads: +custoAds.toFixed(2), custo_fixo: +custoFixo.toFixed(2),
    custo_total: +custoTotal.toFixed(2), margem: +margem.toFixed(2),
    margem_pct: receita > 0 ? +(margem / receita * 100).toFixed(1) : 0,
    projecao_receita_fim_mes: diaAtual ? +(receita / diaAtual * diasNoMes).toFixed(2) : 0,
    projecao_margem_fim_mes: diaAtual ? +(margem / diaAtual * diasNoMes).toFixed(2) : 0,
  };
}

// ===== Onda 12: Automações & OpenFlow =====
async function automacoesAtivas(ctx: ToolCtx, args: { projeto_id?: string; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const limite = args.limite ?? 20;
  let q = ctx.supabase.from("imphq_automacoes")
    .select("id, nome, trigger_tipo, ativo, project_id, updated_at")
    .eq("ativo", true).order("updated_at", { ascending: false }).limit(limite);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const ids = (data || []).map((a: any) => a.id);
  const since = new Date(Date.now() - 86400000).toISOString();
  const runMap: Record<string, number> = {};
  if (ids.length) {
    const { data: runs } = await ctx.supabase.from("imphq_flow_executions")
      .select("automacao_id").in("automacao_id", ids).gte("created_at", since).limit(5000);
    for (const r of runs || []) runMap[r.automacao_id] = (runMap[r.automacao_id] || 0) + 1;
  }
  return {
    count: data?.length || 0,
    automacoes: (data || []).map((a: any) => ({
      id: a.id, nome: a.nome, trigger: a.trigger_tipo,
      execucoes_24h: runMap[a.id] || 0, atualizado: a.updated_at,
    })),
  };
}

async function execucoesTravadas(ctx: ToolCtx, args: { projeto_id?: string; horas?: number; limite?: number }) {
  const pid = resolveProjectId(ctx, args.projeto_id);
  const horas = args.horas ?? 1;
  const limite = args.limite ?? 30;
  const cutoff = new Date(Date.now() - horas * 3600000).toISOString();
  let q = ctx.supabase.from("imphq_flow_executions")
    .select("id, automacao_id, lead_id, status, current_step, error_message, next_run_at, updated_at, project_id")
    .in("status", ["waiting", "error"])
    .lte("updated_at", cutoff)
    .order("updated_at", { ascending: true }).limit(limite);
  if (pid) q = q.eq("project_id", pid);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const waiting = (data || []).filter((e: any) => e.status === "waiting").length;
  const errored = (data || []).filter((e: any) => e.status === "error").length;
  return {
    count: data?.length || 0, waiting, errored, horas_min: horas,
    execucoes: (data || []).map((e: any) => ({
      id: e.id, automacao_id: e.automacao_id, lead_id: e.lead_id,
      status: e.status, step: e.current_step, erro: e.error_message,
      proxima_execucao: e.next_run_at, ultimo_update: e.updated_at,
    })),
  };
}


export async function runTool(name: string, args: any, ctx: ToolCtx): Promise<any> {


  try {
    switch (name) {
      case "listarProjetos": return await listarProjetos(ctx);
      case "buscarProjeto": return await buscarProjeto(ctx, args);
      case "vendasDoDia": return await vendasDoDia(ctx, args);
      case "leadsDoDia": return await leadsDoDia(ctx, args);
      case "leadsResumo": return await leadsResumo(ctx, args);
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
      case "lucroDoDia": return await lucroDoDia(ctx, args);
      case "roasPorCriativo": return await roasPorCriativo(ctx, args);
      case "projecaoLucroMes": return await projecaoLucroMes(ctx, args);
      case "alertaQueimaOrcamento": return await alertaQueimaOrcamento(ctx, args);
      case "proximosEventosCalendario": return await proximosEventosCalendario(ctx, args);
      case "tarefasAtrasadas": return await tarefasAtrasadas(ctx, args);
      case "statusWebinar": return await statusWebinar(ctx, args);
      case "briefingDiario": return await briefingDiario(ctx, args);
      case "listarBatchesCriativos": return await listarBatchesCriativos(ctx, args);
      case "topCriativos": return await topCriativos(ctx, args);
      case "oportunidadesMercado": return await oportunidadesMercado(ctx, args);
      case "concorrentesAtivos": return await concorrentesAtivos(ctx, args);
      case "listarEquipe": return await listarEquipe(ctx, args);
      case "cargaTrabalhoEquipe": return await cargaTrabalhoEquipe(ctx, args);
      case "tarefasPorResponsavel": return await tarefasPorResponsavel(ctx, args);
      case "atribuirTarefa": return await atribuirTarefa(ctx, args);
      case "estatisticasKanban": return await estatisticasKanban(ctx, args);
      case "vendasPorPlataforma": return await vendasPorPlataforma(ctx, args);
      case "chargebacksRecentes": return await chargebacksRecentes(ctx, args);
      case "fluxoCaixaMes": return await fluxoCaixaMes(ctx, args);
      case "automacoesAtivas": return await automacoesAtivas(ctx, args);
      case "execucoesTravadas": return await execucoesTravadas(ctx, args);
      default: return { error: `tool desconhecida: ${name}` };


    }
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}
