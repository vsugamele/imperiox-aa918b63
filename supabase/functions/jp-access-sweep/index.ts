// JP2.1: varredura de acessos do JP. Toda compra aprovada (principal ou bump) que não virou acesso na área de membros
// é liberada aqui: cria a conta se faltar, grava o acesso com o prazo padrão e registra em "A IA fez".
// Modos: "dry" (só lista), "run" (libera). Anti-loop: até 40 por rodada, para após 3 falhas seguidas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { entitlementFor, sweepActionTitle, type AccessGap } from "../_shared/jp-access-sweep.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_PER_RUN = 40;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const makeClient = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
type Sb = ReturnType<typeof makeClient>;

async function ensureUser(sb: Sb, gap: AccessGap): Promise<string> {
  if (gap.user_id) return gap.user_id;
  const { data, error } = await sb.auth.admin.createUser({ email: gap.email, email_confirm: true, user_metadata: { source: "imperio-sweep" } });
  if (error || !data.user) throw new Error(`conta: ${error?.message ?? "sem usuário"}`);
  await sb.from("areamembrojp_profiles").upsert({ id: data.user.id, email: gap.email, updated_at: new Date().toISOString() }, { onConflict: "id" });
  return data.user.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const modo = String(body?.modo ?? "run");
    const limite = Math.min(MAX_PER_RUN, Math.max(1, Number(body?.limite) || MAX_PER_RUN));
    const sb = makeClient();
    const { data, error } = await sb.rpc("imphq_jp_access_gaps", body?.desde ? { p_since: String(body.desde) } : {});
    if (error) throw error;
    const all = (data ?? []) as AccessGap[];
    const gaps = all.slice(0, limite);
    if (modo === "dry") return json({ ok: true, modo, total: all.length, pendentes: gaps.map((g) => ({ ...g, libera: entitlementFor(g, g.user_id ?? "nova-conta") })) });

    const feitos: Array<Record<string, unknown>> = [];
    let falhas = 0;
    for (const gap of gaps) {
      if (falhas >= 3) { feitos.push({ parou: "3 falhas seguidas" }); break; }
      try {
        if (!entitlementFor(gap, "check")) { feitos.push({ venda_id: gap.venda_id, pulado: "prazo já teria vencido" }); continue; }
        const userId = await ensureUser(sb, gap);
        const row = entitlementFor(gap, userId)!;
        const { error: insErr } = await sb.from("areamembrojp_user_entitlements").insert(row);
        if (insErr) throw new Error(insErr.message);
        await sb.from("imphq_ai_actions").insert({
          kind: "grantAccessSilent", risk_level: "low", status: "executed", confidence: 0.99, auto_executed: true, executed_at: new Date().toISOString(),
          title: sweepActionTitle(gap),
          reason: `Compra aprovada na Ticto em ${gap.data_venda.slice(0, 10)} sem acesso na área de membros${gap.user_id ? "" : " (criei a conta)"}. Liberado até ${row.expires_at.slice(0, 10)}.`,
          payload: { email: gap.email, venda_id: gap.venda_id, produto: gap.produto_nome, tipo_venda: gap.tipo_venda, entitlement: row },
          projeto_id: "jp_freitas", source: "jp-access-sweep",
        });
        feitos.push({ venda_id: gap.venda_id, produto: gap.produto_nome, email: gap.email, conta_criada: !gap.user_id, ate: row.expires_at.slice(0, 10) });
        falhas = 0;
      } catch (e) {
        falhas++;
        feitos.push({ venda_id: gap.venda_id, erro: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ ok: true, modo, total: all.length, processados: feitos.length, resultados: feitos });
  } catch (e) {
    console.error("[jp-access-sweep]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
