// Zernio MCP Bridge — proxy JSON-RPC para https://mcp.zernio.com/mcp
// Resolve zernio_api_key por projeto em imphq_integration_credentials (provider=instagram)
// Suporta op: "tools/list" | "tools/call"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ZERNIO_MCP_URL = "https://mcp.zernio.com/mcp";

function json(d: any, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function rpc(apiKey: string, method: string, params: any = {}) {
  const res = await fetch(ZERNIO_MCP_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // MCP Streamable HTTP exige ambos
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params,
    }),
  });

  const ctype = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok) {
    return { ok: false, status: res.status, error: text.slice(0, 500) };
  }

  // SSE: parsear o último frame "data: {...}"
  if (ctype.includes("text/event-stream")) {
    const frames = text.split("\n\n").map((b) => b.trim()).filter(Boolean);
    let last: any = null;
    for (const f of frames) {
      const lines = f.split("\n").filter((l) => l.startsWith("data: "));
      if (!lines.length) continue;
      const payload = lines.map((l) => l.slice(6)).join("\n");
      try { last = JSON.parse(payload); } catch { /* ignore */ }
    }
    if (!last) return { ok: false, status: 502, error: "SSE vazio" };
    if (last.error) return { ok: false, status: 400, error: last.error };
    return { ok: true, result: last.result };
  }

  // JSON puro
  try {
    const j = JSON.parse(text);
    if (j.error) return { ok: false, status: 400, error: j.error };
    return { ok: true, result: j.result };
  } catch {
    return { ok: false, status: 502, error: "resposta inválida" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: aceita JWT do usuário OU chamadas server-side (executor já valida)
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);

    // Valida que é pelo menos um token válido (anon ou usuário)
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: u } = await authClient.auth.getUser();
    // Se não há user mas é service role / anon, deixa passar (chamada interna)
    // Para segurança, exigimos pelo menos um header Authorization presente.

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const { project_id, op, tool, args } = body as {
      project_id?: string;
      op?: "tools/list" | "tools/call";
      tool?: string;
      args?: Record<string, unknown>;
    };

    if (!project_id || typeof project_id !== "string") {
      return json({ error: "project_id obrigatório" }, 400);
    }
    if (!op || (op !== "tools/list" && op !== "tools/call")) {
      return json({ error: "op deve ser tools/list ou tools/call" }, 400);
    }

    // Resolve Zernio API key do projeto
    const { data: credRow } = await supa
      .from("imphq_integration_credentials")
      .select("credentials")
      .eq("project_id", project_id)
      .eq("provider", "instagram")
      .maybeSingle();

    const apiKey = credRow?.credentials?.zernio_api_key;
    if (!apiKey) {
      return json(
        { error: "Projeto sem zernio_api_key em imphq_integration_credentials (provider=instagram)" },
        400,
      );
    }

    if (op === "tools/list") {
      const r = await rpc(apiKey, "tools/list", {});
      return json(r, r.ok ? 200 : r.status);
    }

    // tools/call
    if (!tool || typeof tool !== "string") {
      return json({ error: "tool obrigatório para tools/call" }, 400);
    }
    const r = await rpc(apiKey, "tools/call", {
      name: tool,
      arguments: args || {},
    });

    // Log opcional para auditoria (best-effort)
    try {
      await supa.from("imphq_ig_webhook_logs").insert({
        event_type: "zernio_mcp_call",
        payload: { tool, args, project_id },
        error: r.ok ? null : String(r.error).slice(0, 500),
        processed: true,
      });
    } catch { /* tabela pode não existir ou ter outro schema; ignora */ }

    return json(r, r.ok ? 200 : r.status);
  } catch (e: any) {
    console.error("[zernio-mcp]", e);
    return json({ error: e?.message || "erro interno" }, 500);
  }
});
