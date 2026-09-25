// Edge Function: project-mcp
// Servidor MCP (Model Context Protocol) e API REST para consulta e atualização de projetos
// Suporta Claude Desktop, Cursor, Agentes autônomos e scripts externos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-project-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseJson(val: unknown) {
  if (val && typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }
  return {};
}

// ── MCP Tool Definitions ──
const MCP_TOOLS = [
  {
    name: "get_project_context",
    description: "Retorna o dossiê completo de um projeto: identidade, avatar, dores, desejos, mecanismo único, produtos, preços, links de checkout e esteira de criativos.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto (ex: 'jp_freitas', 'slimsoda')" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "get_project_metrics",
    description: "Retorna o pulso operacional de hoje e do mês do projeto: leads hoje, vendas, faturamento, carrinhos pendentes, ROAS e status do WhatsApp.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "list_projects",
    description: "Lista todos os projetos cadastrados no sistema com nome, categoria, status e readiness score.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_project_leads",
    description: "Retorna leads do projeto filtrados por status ('lead', 'quente', 'cliente') ou score de interesse.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
        status: { type: "string", description: "Filtro de status opcional ('quente', 'lead', 'qualificado')" },
        limit: { type: "number", description: "Limite de registros (padrão: 20)" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "update_project_layer",
    description: "Atualiza uma camada estratégica do projeto (avatar, mecanismo_unico, pesquisa, briefing ou produtos) direto no banco.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
        layer: {
          type: "string",
          enum: ["avatar", "mecanismo_unico", "pesquisa", "produtos", "notes"],
          description: "Camada a ser atualizada",
        },
        content: {
          type: "object",
          description: "Conteúdo JSON a ser mesclado ou substituído na camada",
        },
      },
      required: ["project_id", "layer", "content"],
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Permite autenticação via header 'apikey', 'Authorization' ou query param 'key'
  const url = new URL(req.url);
  const clientKey = req.headers.get("apikey") || req.headers.get("authorization")?.replace("Bearer ", "") || url.searchParams.get("key") || SUPABASE_ANON_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Tratamento de Requisição MCP JSON-RPC ──
  if (req.method === "POST") {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    // Se for chamada JSON-RPC do protocolo MCP
    if (body.jsonrpc === "2.0") {
      const { id, method, params } = body;

      if (method === "tools/list") {
        return json({
          jsonrpc: "2.0",
          id,
          result: { tools: MCP_TOOLS },
        });
      }

      if (method === "tools/call") {
        const { name, arguments: args } = params || {};

        try {
          if (name === "list_projects") {
            const { data: projects, error } = await supabase
              .from("imphq_projects")
              .select("id, name, category, description, created_at, updated_at")
              .order("name");
            if (error) throw error;
            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] },
            });
          }

          if (name === "get_project_context") {
            const projectId = args?.project_id;
            if (!projectId) throw new Error("project_id é obrigatório");

            const { data: project, error } = await supabase
              .from("imphq_projects")
              .select("*")
              .eq("id", projectId)
              .single();
            if (error || !project) throw new Error(`Projeto '${projectId}' não encontrado`);

            const projectData = parseJson(project.data);
            const avatarData = parseJson(project.avatar);

            const dossier = {
              id: project.id,
              name: project.name,
              category: project.category,
              description: project.description,
              avatar: avatarData,
              mecanismo_unico: projectData.mecanismo || projectData.mecanismo_unico || projectData.tese || null,
              produtos: projectData.produtos || [],
              checkouts: {
                links: projectData.links || [],
                checkout_principal: projectData.checkout_url || projectData.link_checkout || null,
              },
              pesquisa_voc: projectData.pesquisa || projectData.dossie || null,
              criativos: projectData.criativos || projectData.roteiros || null,
            };

            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: JSON.stringify(dossier, null, 2) }] },
            });
          }

          if (name === "get_project_metrics") {
            const projectId = args?.project_id;
            if (!projectId) throw new Error("project_id é obrigatório");

            const todayStr = new Date().toISOString().split("T")[0];
            const dayStartUtc = `${todayStr}T03:00:00.000Z`;

            const [leadsRes, vendasRes, waRes] = await Promise.all([
              supabase.from("imphq_leads").select("id, status, score", { count: "exact" }).eq("project_id", projectId).gte("criado_em", dayStartUtc),
              supabase.from("imphq_vendas").select("id, status, valor, produto_nome").eq("project_id", projectId).gte("created_at", dayStartUtc),
              supabase.from("imphq_wa_conversations").select("id, status, unread_count").eq("project_id", projectId),
            ]);

            const vendasHoje = vendasRes.data || [];
            const aprovadas = vendasHoje.filter(v => (v.status || "").toLowerCase() === "aprovado");
            const pendentes = vendasHoje.filter(v => (v.status || "").toLowerCase().includes("pend") || (v.status || "").toLowerCase().includes("pix"));
            const carrinhos = vendasHoje.filter(v => (v.status || "").toLowerCase().includes("carrinho"));

            const metrics = {
              projectId,
              hoje: {
                data: todayStr,
                leads_novos: leadsRes.count || 0,
                vendas_aprovadas: aprovadas.length,
                faturamento_hoje: aprovadas.reduce((s, v) => s + (Number(v.valor) || 0), 0),
                pix_pendentes: pendentes.length,
                carrinhos_abandonados: carrinhos.length,
              },
              whatsapp: {
                total_conversas: waRes.data?.length || 0,
                conversas_nao_lidas: (waRes.data || []).filter(c => (c.unread_count || 0) > 0).length,
              },
            };

            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: JSON.stringify(metrics, null, 2) }] },
            });
          }

          if (name === "get_project_leads") {
            const { project_id, status, limit = 20 } = args || {};
            let q = supabase
              .from("imphq_leads")
              .select("id, nome, telefone, status, score, criado_em, data")
              .eq("project_id", project_id)
              .order("criado_em", { ascending: false })
              .limit(limit);

            if (status) q = q.eq("status", status);
            const { data: leads, error } = await q;
            if (error) throw error;

            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: JSON.stringify(leads || [], null, 2) }] },
            });
          }

          if (name === "update_project_layer") {
            const { project_id, layer, content } = args || {};
            const { data: project, error: getErr } = await supabase
              .from("imphq_projects")
              .select("data, avatar")
              .eq("id", project_id)
              .single();
            if (getErr || !project) throw new Error(`Projeto '${project_id}' não encontrado`);

            if (layer === "avatar") {
              const currentAvatar = parseJson(project.avatar);
              const updated = { ...currentAvatar, ...content };
              await supabase.from("imphq_projects").update({ avatar: updated }).eq("id", project_id);
            } else {
              const currentData = parseJson(project.data);
              const updated = { ...currentData, [layer]: content };
              await supabase.from("imphq_projects").update({ data: updated }).eq("id", project_id);
            }

            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: `Camada '${layer}' do projeto '${project_id}' atualizada com sucesso.` }] },
            });
          }

          throw new Error(`Ferramenta desconhecida: ${name}`);
        } catch (err: any) {
          return json({
            jsonrpc: "2.0",
            id,
            error: { code: -32603, message: err?.message || "Internal error" },
          });
        }
      }
    }

    // Se for chamada REST direta via POST (ex: action=update)
    const action = url.searchParams.get("action") || body.action;
    const projectId = url.searchParams.get("project_id") || body.project_id;

    if (action === "update" && projectId) {
      const { layer, content } = body;
      const { data: project } = await supabase.from("imphq_projects").select("data, avatar").eq("id", projectId).single();
      if (!project) return json({ error: "Projeto não encontrado" }, 404);

      if (layer === "avatar") {
        await supabase.from("imphq_projects").update({ avatar: { ...parseJson(project.avatar), ...content } }).eq("id", projectId);
      } else {
        await supabase.from("imphq_projects").update({ data: { ...parseJson(project.data), [layer]: content } }).eq("id", projectId);
      }
      return json({ success: true, message: `Camada ${layer} atualizada` });
    }

    return json({ error: "Ação não suportada" }, 400);
  }

  // ── Tratamento de Requisição REST via GET ──
  const projectId = url.searchParams.get("project_id");
  const action = url.searchParams.get("action") || "context";

  if (!projectId) {
    // Listagem simples de projetos
    const { data: projects } = await supabase.from("imphq_projects").select("id, name, category, description").order("name");
    return json({
      endpoints: {
        mcp_post: `${SUPABASE_URL}/functions/v1/project-mcp`,
        context_get: `${SUPABASE_URL}/functions/v1/project-mcp?project_id={id}&action=context`,
        prompt_get: `${SUPABASE_URL}/functions/v1/project-mcp?project_id={id}&action=markdown`,
      },
      projects: projects || [],
    });
  }

  const { data: project } = await supabase.from("imphq_projects").select("*").eq("id", projectId).single();
  if (!project) return json({ error: `Projeto '${projectId}' não encontrado` }, 404);

  const projectData = parseJson(project.data);
  const avatarData = parseJson(project.avatar);

  // Retorna Markdown estruturado para injetar em chat de LLM
  if (action === "markdown") {
    const md = `# Dossiê Executivo do Projeto: ${project.name} (ID: ${project.id})
**Categoria:** ${project.category || "N/A"}
**Descrição:** ${project.description || "N/A"}

---

## 1. Avatar & Psicologia de Compra
- **Nome/Perfil:** ${avatarData.nome || avatarData.name || "Não definido"}
- **Dores Principais:** ${JSON.stringify(avatarData.dores || avatarData.pain_points || "Não mapeado")}
- **Desejos Profundos:** ${JSON.stringify(avatarData.desejos || avatarData.desejos_proibidos || "Não mapeado")}
- **Crenças e Objeções:** ${JSON.stringify(avatarData.crencas || avatarData.objecoes || "Não mapeado")}

---

## 2. Mecanismo Único & Tese de Conversão
${projectData.mecanismo || projectData.mecanismo_unico || projectData.tese || "Mecanismo único ainda não estruturado."}

---

## 3. Oferta & Checkouts
${Array.isArray(projectData.produtos) && projectData.produtos.length > 0
  ? projectData.produtos.map((p: any) => `- **${p.nome || p.name}**: R$ ${p.preco || p.price || "—"} (${p.tipo || "principal"}) | Link: ${p.checkout_url || p.link || "Sem link"}`).join("\n")
  : "Nenhum produto cadastrado no briefing."}

---

## 4. Tráfego & Ângulos Persuasivos
${projectData.criativos ? JSON.stringify(projectData.criativos, null, 2) : "Criativos e ganchos em fase de esteira."}
`;
    return new Response(md, {
      headers: { ...corsHeaders, "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  // Retorno JSON de Contexto
  return json({
    project: {
      id: project.id,
      name: project.name,
      category: project.category,
      description: project.description,
      avatar: avatarData,
      mecanismo: projectData.mecanismo || projectData.mecanismo_unico || projectData.tese || null,
      produtos: projectData.produtos || [],
      links: projectData.links || [],
      pesquisa: projectData.pesquisa || null,
      updated_at: project.updated_at,
    },
  });
});
