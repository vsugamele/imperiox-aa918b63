import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CHANNEL_COLORS: Record<string, string> = {
  instagram: "#E1306C", tiktok: "#000000", youtube: "#FF0000",
  whatsapp: "#25D366", salvar: "#c9922a",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    // Pega até 25 publicações prontas: agendadas vencidas OU pendentes imediatas
    const { data: due, error } = await admin
      .from("imphq_studio_publications")
      .select("*")
      .in("status", ["agendado", "pendente"])
      .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
      .limit(25);
    if (error) throw error;

    const processed: any[] = [];
    for (const pub of (due || [])) {
      try {
        // 1. Salva na biblioteca de referências (sempre)
        await admin.from("imphq_referencias").insert({
          user_id: pub.user_id,
          projeto_id: pub.projeto_id,
          tipo: pub.media_kind || "image",
          url: pub.media_url,
          titulo: (pub.caption || "").slice(0, 80) || `Studio · ${pub.channel}`,
          descricao: pub.caption || "",
          tags: ["studio", pub.channel].filter(Boolean),
          fonte: "studio",
        });

        // 2. Salva também em content_library se tiver projeto
        if (pub.projeto_id) {
          await admin.from("imphq_content_library").insert({
            project_id: pub.projeto_id, user_id: pub.user_id,
            title: (pub.caption || "").slice(0, 80) || `Studio · ${pub.channel}`,
            file_url: pub.media_url, file_type: pub.media_kind || "image",
            description: pub.caption || "", tags: ["studio", pub.channel].filter(Boolean),
          });
        }

        // 3. Se tem canal externo, agenda no calendário (execução manual/integração depois)
        if (pub.channel && pub.channel !== "salvar") {
          await admin.from("imphq_calendar_events").insert({
            user_id: pub.user_id, project_id: pub.projeto_id,
            title: `📤 ${pub.channel.toUpperCase()} · ${(pub.caption || "sem legenda").slice(0, 60)}`,
            description: `${pub.caption || ""}\n\n🔗 Mídia: ${pub.media_url}`,
            event_date: pub.scheduled_at || now,
            event_type: "publicacao",
            color: CHANNEL_COLORS[pub.channel] || "#c9922a",
          });
        }

        const newStatus = (pub.channel === "salvar") ? "publicado" : "pronto_para_publicar";
        await admin.from("imphq_studio_publications").update({
          status: newStatus, published_at: now, error: null,
        }).eq("id", pub.id);

        processed.push({ id: pub.id, status: newStatus });
      } catch (e: any) {
        await admin.from("imphq_studio_publications").update({
          status: "erro", error: e?.message || String(e),
        }).eq("id", pub.id);
        processed.push({ id: pub.id, status: "erro", error: e?.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("studio-publish-worker:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
