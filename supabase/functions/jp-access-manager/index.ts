import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { record, errorText } from "../_shared/value.ts";
import { verifiedMagicLink, jpAccessStatus } from "../_shared/conversation-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CRM_URL = "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/crm-bridge";
const JP_MEMBER_BASE_URL = "https://www.jphaireducation.com.br";

const KNOWN_PROGRAM_NAMES: Record<string, string> = {
  "3c368b42-5b73-4d86-a1cd-35c3022b142d": "O Código dos Cortes Perfeitos - A Mentoria do Zero a Autoridade",
  "3c5551b0-7379-4ade-b306-194d9814f601": "Cortes Descomplicados",
  "164d66e6-8186-4d1a-8303-e2b88bf95f7f": "O Segredo do Corte",
  "8e0ae165-8982-4361-85c9-fa857cf77cd5": "A Arte da Finalização",
  "d2760367-8fd7-4538-8765-10ac0810fb72": "Finalização Express",
  "c060d807-ee9e-407e-a7ff-f73e8dd13b52": "O Poder do Tratamento",
  "f93166f9-e72c-4b66-a4d0-bc4ef7f860b1": "Corte Express",
  "5f0c3eaa-9784-4780-b619-ca47ec02ea60": "Formação JP Hair Education | Racional Módulo II",
};

function getSecret(): string | null {
  return Deno.env.get("JPFREITAS_CRM_BRIDGE_SECRET") || null;
}

async function callBridge(action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const secret = getSecret();
  if (!secret) {
    console.warn("[jp-access-manager] JPFREITAS_CRM_BRIDGE_SECRET not set");
    return { ok: false, error: "secret_missing" };
  }
  try {
    const res = await fetch(CRM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-crm-secret": secret,
      },
      body: JSON.stringify({ action, ...payload }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = text ? record(JSON.parse(text)) : {}; } catch { json = { raw: text }; }
    if (!res.ok) {
      return { ...json, ok: false, status: res.status };
    }
    return { ...json, ok: json.ok !== false && !json.error };
  } catch (e: unknown) {
    console.error(`[jp-access-manager] ${action} fetch error: ${errorText(e)}`);
    return { ok: false, error: errorText(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const action = body.action || "diagnose";
    let email = (body.email || "").trim().toLowerCase();
    let phone = (body.phone || "").replace(/\D/g, "");

    // Se passou lead_id e não email/phone, recupera do banco local
    if (body.lead_id && (!email || !phone)) {
      const { data: lead } = await supabase
        .from("imphq_leads")
        .select("email, phone, nome")
        .eq("id", body.lead_id)
        .maybeSingle();
      if (lead) {
        if (!email && lead.email) email = lead.email.trim().toLowerCase();
        if (!phone && lead.phone) phone = lead.phone.replace(/\D/g, "");
      }
    }

    if (action === "diagnose") {
      let lookupResult: Record<string, unknown> | null = null;
      if (email) {
        lookupResult = await callBridge("lookup_lead", { email });
      }
      if ((!lookupResult || lookupResult.ok === false || !record(lookupResult.data || lookupResult).exists) && phone) {
        lookupResult = await callBridge("lookup_lead", { phone });
      }

      if (!lookupResult || lookupResult.ok === false) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: lookupResult?.error || "Falha na comunicação com a Área de Membros",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rawData = record(lookupResult.data || lookupResult);
      const { hasAccount, hasAccess, programs } = jpAccessStatus(lookupResult);

      const parsedPrograms = programs.map((p: unknown) => {
        const row = record(p);
        const progId = String(row.program_id || row.id || "");
        const title = KNOWN_PROGRAM_NAMES[progId] || String(row.title || row.name || "Curso JP Hair Education");
        const directPath = progId ? `/programs/${progId}` : "/home";
        const directUrl = `${JP_MEMBER_BASE_URL}${directPath}`;
        return {
          program_id: progId,
          title,
          is_active: row.is_active !== false,
          source: row.source || "ticto",
          expires_at: row.expires_at || null,
          directPath,
          directUrl,
        };
      });

      const primary = parsedPrograms[0] || null;
      const directUrl = primary?.directUrl || `${JP_MEMBER_BASE_URL}/programs/3c368b42-5b73-4d86-a1cd-35c3022b142d`;

      return new Response(
        JSON.stringify({
          ok: true,
          exists: hasAccount,
          hasAccess,
          email: rawData.email || email,
          name: rawData.name || null,
          programs: parsedPrograms,
          primaryProgram: primary,
          directUrl,
          rootCauseDiagnosis: hasAccess
            ? "Aluno possui acesso ativo. Se relatou 'Acesso Negado', é porque clicou no banner da Formação de R$ 797 na Home em vez de abrir as aulas do seu curso específico."
            : "Nenhum entitlement ativo encontrado na plataforma para este e-mail/telefone.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "issue_magic_link") {
      if (!email) {
        return new Response(
          JSON.stringify({ ok: false, error: "E-mail do aluno é obrigatório para gerar o Magic Link" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let redirect_path = body.redirect_path;
      if (!redirect_path && body.program_id) {
        redirect_path = `/programs/${body.program_id}`;
      }
      if (!redirect_path) {
        redirect_path = "/programs/3c368b42-5b73-4d86-a1cd-35c3022b142d"; // Fallback para Código dos Cortes
      }

      const res = await callBridge("issue_magic_link", {
        email,
        redirect_path,
        create_if_missing: false,
      });

      const magicLink = verifiedMagicLink(res);
      if (!magicLink) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: res.error || "Não foi possível emitir o Magic Link para este aluno (verifique se possui conta ativa).",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          magic_link: magicLink,
          redirect_path,
          expires_at: res.expires_at || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: `Ação desconhecida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("[jp-access-manager] fatal error:", errorText(err));
    return new Response(
      JSON.stringify({ ok: false, error: errorText(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
