import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function nextDate(cadencia: string, lastSent: Date): Date {
  const next = new Date(lastSent);
  if (cadencia === "diaria") next.setDate(next.getDate() + 1);
  else if (cadencia === "semanal") next.setDate(next.getDate() + 7);
  else if (cadencia === "quinzenal") next.setDate(next.getDate() + 14);
  else next.setDate(next.getDate() + 1);
  return next;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const projectRef = Deno.env.get("SUPABASE_URL")!.split("//")[1].split(".")[0];
  const functionsBase = `https://${projectRef}.supabase.co/functions/v1`;

  const summary = { processed: 0, generated: 0, sent: 0, paused: 0, errors: [] as string[] };

  try {
    // 1. Pegar enrollments ativos com proximo_envio_em <= now
    const { data: enrollments } = await supabase
      .from("imphq_lead_sequence_enrollments")
      .select("*, sequence:imphq_nurture_sequences(*)")
      .eq("status", "ativo")
      .lte("proximo_envio_em", new Date().toISOString())
      .limit(500);

    for (const enr of enrollments || []) {
      summary.processed++;
      try {
        const seq: any = enr.sequence;
        if (!seq || !seq.ativa) continue;

        // Verificar duração da sequência
        const diasAtivos = Math.floor((Date.now() - new Date(enr.data_inicio).getTime()) / (1000 * 60 * 60 * 24));
        if (diasAtivos >= seq.duracao_dias) {
          await supabase.from("imphq_lead_sequence_enrollments").update({ status: "concluido" }).eq("id", enr.id);
          continue;
        }

        // Auto-pausar leads frios
        if (enr.dias_sem_abertura >= 10) {
          await supabase.from("imphq_lead_sequence_enrollments").update({ status: "cold", pausado_em: new Date().toISOString(), pausado_motivo: "10 e-mails sem abertura" }).eq("id", enr.id);
          summary.paused++;
          continue;
        }

        // Verificar lead
        const { data: lead } = await supabase.from("imphq_leads").select("id, email, nome").eq("id", enr.lead_id).single();
        if (!lead?.email) continue;

        // Limite hard: 1 e-mail/dia por lead
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const { count: enviadosHoje } = await supabase
          .from("imphq_nurture_emails")
          .select("*", { count: "exact", head: true })
          .eq("lead_id", enr.lead_id)
          .eq("status", "enviado")
          .gte("enviado_em", hoje.toISOString());
        if ((enviadosHoje || 0) >= 1) continue;

        // Pegar e-mail pendente ou gerar novo
        let { data: pending } = await supabase
          .from("imphq_nurture_emails")
          .select("*")
          .eq("enrollment_id", enr.id)
          .eq("status", "agendado")
          .order("dia_numero", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!pending) {
          // Gerar
          const genRes = await fetch(`${functionsBase}/nurture-generator`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ lead_id: enr.lead_id, sequence_id: enr.sequence_id, enrollment_id: enr.id }),
          });
          if (!genRes.ok) {
            summary.errors.push(`Geração falhou enr=${enr.id}`);
            continue;
          }
          const genData = await genRes.json();
          pending = genData.email;
          summary.generated++;
        }

        if (!pending) continue;

        // Enviar via send-project-email
        const sendRes = await fetch(`${functionsBase}/send-project-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({
            project_id: seq.project_id,
            to_email: lead.email,
            inline: { subject: pending.assunto, html_body: pending.corpo_html, name: `Nurture Dia ${pending.dia_numero}` },
          }),
        });

        const sendOk = sendRes.ok;
        const sendData = sendOk ? await sendRes.json() : { error: await sendRes.text() };

        if (sendOk) {
          await supabase.from("imphq_nurture_emails").update({
            status: "enviado",
            enviado_em: new Date().toISOString(),
            resend_id: sendData.id || null,
          }).eq("id", pending.id);

          const proximo = nextDate(seq.cadencia, new Date());
          await supabase.from("imphq_lead_sequence_enrollments").update({
            ultimo_envio_em: new Date().toISOString(),
            proximo_envio_em: proximo.toISOString(),
            dia_atual: pending.dia_numero,
            dias_sem_abertura: enr.dias_sem_abertura + 1,
          }).eq("id", enr.id);

          await supabase.rpc("noop").catch(() => {});
          await supabase.from("imphq_nurture_sequences").update({ total_emails_enviados: (seq.total_emails_enviados || 0) + 1 }).eq("id", seq.id);

          summary.sent++;
        } else {
          await supabase.from("imphq_nurture_emails").update({
            status: "falha", erro: JSON.stringify(sendData).slice(0, 500),
          }).eq("id", pending.id);
          summary.errors.push(`Envio falhou enr=${enr.id}: ${JSON.stringify(sendData).slice(0, 200)}`);
        }
      } catch (e: any) {
        summary.errors.push(`enr=${enr.id}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[nurture-scheduler]", err);
    return new Response(JSON.stringify({ error: err.message, summary }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
