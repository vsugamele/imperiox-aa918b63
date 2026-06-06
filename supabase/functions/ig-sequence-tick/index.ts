// ig-sequence-tick: Cron edge function (every 5 min)
// Processes pending sequence enrollments and sends the next step message
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendInstagramDM(igUserId: string, recipientId: string, message: string, pageAccessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        access_token: pageAccessToken,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();

  try {
    // Fetch pending enrollments that are due
    const { data: enrollments, error } = await supa
      .from("imphq_ig_sequence_enrollments")
      .select(`
        *,
        sequence:imphq_ig_sequences(id, name, steps, project_id),
        conversation:imphq_ig_conversations(id, participant_id, account_id)
      `)
      .eq("paused", false)
      .eq("completed", false)
      .lte("next_send_at", now.toISOString())
      .limit(50);

    if (error) throw error;

    let processed = 0;
    let sent = 0;
    let errors = 0;

    for (const enrollment of enrollments || []) {
      try {
        const sequence = enrollment.sequence;
        const conversation = enrollment.conversation;
        const steps: any[] = sequence?.steps || [];
        const stepIndex = enrollment.current_step;

        if (stepIndex >= steps.length) {
          // Sequence completed
          await supa.from("imphq_ig_sequence_enrollments")
            .update({ completed: true })
            .eq("id", enrollment.id);
          continue;
        }

        const step = steps[stepIndex];
        
        // Get the IG account token
        const { data: account } = await supa
          .from("imphq_ig_accounts")
          .select("ig_user_id, page_access_token")
          .eq("id", conversation.account_id)
          .single();

        if (!account?.page_access_token) {
          console.warn(`[ig-seq-tick] No token for account ${conversation.account_id}`);
          errors++;
          continue;
        }

        // Personalize message
        const { data: conv } = await supa
          .from("imphq_ig_conversations")
          .select("participant_name, participant_username")
          .eq("id", conversation.id)
          .single();

        const name = conv?.participant_name || conv?.participant_username || "você";
        const firstName = name.split(" ")[0];
        const message = step.message
          .replace("{nome}", firstName)
          .replace("{name}", firstName);

        // Send the message
        const ok = await sendInstagramDM(
          account.ig_user_id,
          conversation.participant_id,
          message,
          account.page_access_token
        );

        if (ok) {
          // Log message sent
          await supa.from("imphq_ig_messages").insert({
            conversation_id: conversation.id,
            direction: "out",
            type: "text",
            content: message,
            ai_generated: true,
            sent_at: now.toISOString(),
          });

          // Advance to next step
          const nextStepIndex = stepIndex + 1;
          const isLast = nextStepIndex >= steps.length;

          if (isLast) {
            await supa.from("imphq_ig_sequence_enrollments")
              .update({ current_step: nextStepIndex, completed: true })
              .eq("id", enrollment.id);
          } else {
            const nextStep = steps[nextStepIndex];
            const delayHours = nextStep?.delay_hours || 24;
            const nextSendAt = new Date(now.getTime() + delayHours * 3600 * 1000);
            await supa.from("imphq_ig_sequence_enrollments")
              .update({ current_step: nextStepIndex, next_send_at: nextSendAt.toISOString() })
              .eq("id", enrollment.id);
          }

          sent++;
          console.log(`[ig-seq-tick] Sent step ${stepIndex + 1} of "${sequence.name}" to conv ${conversation.id}`);
        } else {
          console.warn(`[ig-seq-tick] Failed to send step ${stepIndex + 1} to conv ${conversation.id}`);
          errors++;
        }

        processed++;
      } catch (e: any) {
        console.error(`[ig-seq-tick] Enrollment ${enrollment.id} error: ${e.message}`);
        errors++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, sent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[ig-seq-tick] Fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
