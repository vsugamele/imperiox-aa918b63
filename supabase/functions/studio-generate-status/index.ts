import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
const LUMA_API_KEY = Deno.env.get("LUMA_API_KEY");
const BUCKET = "creative-assets";

async function uploadFromUrl(supabase: any, userId: string, url: string, ext: string, mime: string) {
  const r = await fetch(url);
  const buf = new Uint8Array(await r.arrayBuffer());
  const path = `studio/${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { id } = await req.json();
    const { data: row, error } = await supabase.from("imphq_studio_generations").select("*").eq("id", id).eq("user_id", userId).single();
    if (error || !row) throw new Error("Geração não encontrada");
    if (row.status === "completed" || row.status === "failed") {
      return new Response(JSON.stringify({ ok: true, status: row.status, output_url: row.output_url, error: row.error }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!row.external_id) {
      return new Response(JSON.stringify({ ok: true, status: row.status }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---------- LUMA ----------
    if (row.provider === "luma") {
      if (!LUMA_API_KEY) throw new Error("LUMA_API_KEY ausente");
      const r = await fetch(`https://api.lumalabs.ai/agents/v1/generations/${row.external_id}`, {
        headers: { Authorization: `Bearer ${LUMA_API_KEY}` },
      });
      if (!r.ok) throw new Error(`Luma poll ${r.status}: ${await r.text()}`);
      const data = await r.json();
      const state = data?.state || data?.status;
      const imgUrl = data?.assets?.image || data?.image?.url || data?.assets?.[0]?.url;
      if (state === "completed" && imgUrl) {
        const publicUrl = await uploadFromUrl(supabase, userId, imgUrl, "png", "image/png");
        await supabase.from("imphq_studio_generations").update({ status: "completed", output_url: publicUrl }).eq("id", id);
        return new Response(JSON.stringify({ ok: true, status: "completed", output_url: publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (state === "failed") {
        const err = data?.failure_reason || data?.error || "Luma falhou";
        await supabase.from("imphq_studio_generations").update({ status: "failed", error: err }).eq("id", id);
        return new Response(JSON.stringify({ ok: false, status: "failed", error: err }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, status: "processing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---------- KIE ----------
    if (row.provider !== "kie") {
      return new Response(JSON.stringify({ ok: true, status: row.status }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const r = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${row.external_id}`, {
      headers: { Authorization: `Bearer ${KIE_API_KEY}` },
    });
    if (!r.ok) throw new Error(`Kie poll ${r.status}: ${await r.text()}`);
    const data = await r.json();
    const status = data?.data?.state || data?.data?.status;
    const parsedResult = (() => { try { return data?.data?.resultJson ? JSON.parse(data.data.resultJson) : null; } catch { return null; } })();
    const resultUrl =
      parsedResult?.resultUrls?.[0] ||
      parsedResult?.imageUrl ||
      parsedResult?.images?.[0] ||
      data?.data?.result_urls?.[0] ||
      data?.data?.resultUrls?.[0] ||
      data?.data?.imageUrl ||
      data?.data?.videoUrl;

    if (status === "success" || status === "succeeded" || resultUrl) {
      if (!resultUrl) throw new Error("Sem URL de resultado");
      const isVideo = row.kind === "video";
      const publicUrl = await uploadFromUrl(
        supabase, userId, resultUrl,
        isVideo ? "mp4" : "png",
        isVideo ? "video/mp4" : "image/png",
      );
      await supabase.from("imphq_studio_generations").update({ status: "completed", output_url: publicUrl }).eq("id", id);
      return new Response(JSON.stringify({ ok: true, status: "completed", output_url: publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (status === "fail" || status === "failed") {
      const err = data?.data?.failMsg || data?.data?.error || "Falhou";
      await supabase.from("imphq_studio_generations").update({ status: "failed", error: err }).eq("id", id);
      return new Response(JSON.stringify({ ok: false, status: "failed", error: err }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, status: "processing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("studio-generate-status:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
