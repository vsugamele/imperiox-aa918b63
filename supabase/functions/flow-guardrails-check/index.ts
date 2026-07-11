// Guardrails check: rate limit per lead, quiet hours, circuit breaker status.
// Returns { allowed: boolean, reason?: string }. Called by openflow-executor before sending.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { automacao_id, lead_id } = await req.json();
    if (!automacao_id) throw new Error("automacao_id required");
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: auto } = await supa
      .from("imphq_automacoes")
      .select("quiet_start,quiet_end,rate_limit_per_lead_24h,circuit_breaker_error_pct,circuit_breaker_window_min,circuit_breaker_paused_at,circuit_breaker_reason")
      .eq("id", automacao_id)
      .maybeSingle();

    if (!auto) return json({ allowed: true });

    // Circuit breaker paused
    if (auto.circuit_breaker_paused_at) {
      return json({ allowed: false, reason: auto.circuit_breaker_reason || "Circuit breaker aberto" });
    }

    // Quiet hours (São Paulo, UTC-3)
    if (auto.quiet_start != null && auto.quiet_end != null) {
      const nowUtc = new Date();
      const hourBr = (nowUtc.getUTCHours() - 3 + 24) % 24;
      const qs = auto.quiet_start, qe = auto.quiet_end;
      const inQuiet = qs < qe ? (hourBr >= qs && hourBr < qe) : (hourBr >= qs || hourBr < qe);
      if (inQuiet) return json({ allowed: false, reason: `Quiet hours ${qs}h-${qe}h` });
    }

    // Rate limit per lead
    if (auto.rate_limit_per_lead_24h && lead_id) {
      const since = new Date(Date.now() - 86400000).toISOString();
      const { count } = await supa
        .from("imphq_automacao_logs")
        .select("id", { count: "exact", head: true })
        .eq("automacao_id", automacao_id)
        .eq("lead_id", lead_id)
        .gte("created_at", since);
      if ((count || 0) >= auto.rate_limit_per_lead_24h) {
        return json({ allowed: false, reason: `Rate limit ${count}/${auto.rate_limit_per_lead_24h} em 24h` });
      }
    }

    // Circuit breaker evaluation (open if error rate > threshold in window)
    if (auto.circuit_breaker_error_pct) {
      const win = auto.circuit_breaker_window_min || 15;
      const since = new Date(Date.now() - win * 60000).toISOString();
      const { data: logs } = await supa
        .from("imphq_automacao_logs")
        .select("status")
        .eq("automacao_id", automacao_id)
        .gte("created_at", since)
        .limit(500);
      const total = (logs || []).length;
      if (total >= 10) {
        const errors = (logs || []).filter((l: any) => l.status === "error").length;
        const pct = (errors / total) * 100;
        if (pct >= auto.circuit_breaker_error_pct) {
          const reason = `Erro ${pct.toFixed(0)}% em ${win}min (limite ${auto.circuit_breaker_error_pct}%)`;
          await supa.from("imphq_automacoes")
            .update({ circuit_breaker_paused_at: new Date().toISOString(), circuit_breaker_reason: reason, ativo: false })
            .eq("id", automacao_id);
          return json({ allowed: false, reason });
        }
      }
    }

    return json({ allowed: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
