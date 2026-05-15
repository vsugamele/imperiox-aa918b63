// Rotaciona o ponteiro current_week dos distribuidores com rotation_mode != 'none'.
// Disparado por pg_cron a cada 5 min. Avança quando now() >= last_rotation_at + intervalo do cron.
// Como simplificação, suportamos 'weekly' (7 dias) e cron string semanal (interpretada como 7 dias entre execuções).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Calcula próxima rotação a partir de last_rotation_at e expressão "weekly" simplificada.
// Suportamos cron 5-campos onde campo 5 (DOW) define dia da semana (0=dom..6=sab) e campos 1-2 hora/minuto.
function nextRotationDue(lastAt: Date | null, cron: string | null): boolean {
  const now = new Date();
  if (!lastAt) return true; // primeira execução
  const parts = (cron || "0 9 * * 1").split(/\s+/);
  const minute = parseInt(parts[0]) || 0;
  const hour = parseInt(parts[1]) || 9;
  const dow = parts[4] === "*" ? null : parseInt(parts[4]);

  // Calcula próximo "match" depois de lastAt
  const candidate = new Date(lastAt);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCHours(hour, minute, 0, 0);
  // Avança 1 dia até bater dow (ou no mínimo 7 dias se mesma semana)
  candidate.setUTCDate(candidate.getUTCDate() + 1);
  for (let i = 0; i < 14; i++) {
    if (dow === null || candidate.getUTCDay() === dow) break;
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  // Garante ao menos 6 dias entre rotações
  const minNext = new Date(lastAt.getTime() + 6 * 24 * 60 * 60 * 1000);
  if (candidate < minNext) candidate.setTime(minNext.getTime());
  return now >= candidate;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: dists, error } = await supabase
      .from("imphq_wa_group_distributors")
      .select("id, rotation_mode, rotation_cron, current_week, last_rotation_at")
      .neq("rotation_mode", "none");
    if (error) throw error;

    const results: any[] = [];
    for (const d of dists || []) {
      const lastAt = d.last_rotation_at ? new Date(d.last_rotation_at) : null;
      if (!nextRotationDue(lastAt, d.rotation_cron)) {
        results.push({ id: d.id, skipped: true });
        continue;
      }

      // Busca próxima semana disponível com start_at <= now
      const { data: nextWeek } = await supabase
        .from("imphq_wa_distributor_weeks")
        .select("week_index")
        .eq("distributor_id", d.id)
        .gt("week_index", d.current_week)
        .is("archived_at", null)
        .lte("start_at", new Date().toISOString())
        .order("week_index", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!nextWeek) {
        results.push({ id: d.id, no_next_week: true });
        continue;
      }

      // Arquiva semana atual
      await supabase
        .from("imphq_wa_distributor_weeks")
        .update({ archived_at: new Date().toISOString() })
        .eq("distributor_id", d.id)
        .eq("week_index", d.current_week);

      // Atualiza ponteiro
      await supabase
        .from("imphq_wa_group_distributors")
        .update({
          current_week: nextWeek.week_index,
          last_rotation_at: new Date().toISOString(),
        })
        .eq("id", d.id);

      results.push({ id: d.id, advanced_to: nextWeek.week_index });
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("wa-distributor-rotate error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
