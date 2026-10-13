// ============================================================================
// 🏛️ IMPÉRIO HQ — Edge Function: media-vault
// Espelhador de Mídia e CDN Própria do Acervo de Inteligência
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { syncUrlToVault, isAlreadyInSupabaseStorage } from "../_shared/media-vault.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // ------------------------------------------------------------------------
    // 1. GET: Status do Cofre & Estatísticas de Espelhamento
    // ------------------------------------------------------------------------
    if (req.method === "GET") {
      const { data: refStats } = await sb.rpc("get_media_vault_stats").maybeSingle();

      // Contagem rápida de fontes de referências
      const { data: refs } = await sb
        .from("imphq_referencias")
        .select("id, url, image_url, tipo")
        .limit(2000);

      let gdrive = 0, notion = 0, supabaseCdn = 0, empty = 0, other = 0;
      for (const r of refs || []) {
        const u = r.url || "";
        const img = r.image_url || "";
        if (!u && !img) empty++;
        else if (u.includes("drive.google.com") || img.includes("drive.google.com")) gdrive++;
        else if (u.includes("notion.site") || img.includes("notion.site")) notion++;
        else if (isAlreadyInSupabaseStorage(u) && isAlreadyInSupabaseStorage(img)) supabaseCdn++;
        else other++;
      }

      return json({
        ok: true,
        stats: {
          total_inspected: refs?.length || 0,
          in_supabase_cdn: supabaseCdn,
          google_drive_pending: gdrive,
          notion_pending: notion,
          other_external: other,
          empty,
        },
      });
    }

    // ------------------------------------------------------------------------
    // 2. POST Handlers
    // ------------------------------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const op = body?.op || "sync_one";

    // A. Sincronizar um único registro (Referência ou Swipe)
    if (op === "sync_one") {
      const entityId = body?.id;
      const entityType = body?.entity || "referencia";

      if (!entityId) return json({ ok: false, error: "ID obrigatório" }, 400);

      const results = [];

      if (entityType === "referencia") {
        const { data: ref, error: refErr } = await sb
          .from("imphq_referencias")
          .select("id, url, image_url, pipeline")
          .eq("id", entityId)
          .single();

        if (refErr || !ref) return json({ ok: false, error: "Referência não encontrada" }, 404);

        const patch: Record<string, unknown> = {};
        const pipeline = (ref.pipeline && typeof ref.pipeline === "object" ? ref.pipeline : {}) as Record<string, unknown>;
        const vaultInfo: Record<string, unknown> = (pipeline.vault as Record<string, unknown>) || {};

        // Sincroniza vídeo / url principal se não estiver no Supabase
        if (ref.url && !isAlreadyInSupabaseStorage(ref.url)) {
          const syncRes = await syncUrlToVault(sb, ref.id, "referencia", "url", ref.url);
          results.push(syncRes);
          if (syncRes.status === "synced" && syncRes.cdn_url) {
            patch.url = syncRes.cdn_url;
            vaultInfo.original_url = syncRes.original_url;
            vaultInfo.url_cdn = syncRes.cdn_url;
            vaultInfo.url_synced_at = new Date().toISOString();
          }
        }

        // Sincroniza imagem se não estiver no Supabase
        if (ref.image_url && !isAlreadyInSupabaseStorage(ref.image_url)) {
          const syncRes = await syncUrlToVault(sb, ref.id, "referencia", "image_url", ref.image_url);
          results.push(syncRes);
          if (syncRes.status === "synced" && syncRes.cdn_url) {
            patch.image_url = syncRes.cdn_url;
            vaultInfo.original_image_url = syncRes.original_url;
            vaultInfo.image_cdn = syncRes.cdn_url;
            vaultInfo.image_synced_at = new Date().toISOString();
          }
        }

        if (Object.keys(patch).length > 0) {
          vaultInfo.status = "synced";
          patch.pipeline = { ...pipeline, vault: vaultInfo };
          patch.pipeline_at = new Date().toISOString();
          await sb.from("imphq_referencias").update(patch).eq("id", ref.id);
        }

        return json({ ok: true, id: ref.id, results, updated: Object.keys(patch).length > 0 });
      }

      if (entityType === "swipe") {
        const { data: sw, error: swErr } = await sb
          .from("imphq_swipes")
          .select("id, video_url, thumb_url, metadata")
          .eq("id", entityId)
          .single();

        if (swErr || !sw) return json({ ok: false, error: "Swipe não encontrado" }, 404);

        const patch: Record<string, unknown> = {};
        const meta = (sw.metadata && typeof sw.metadata === "object" ? sw.metadata : {}) as Record<string, unknown>;

        if (sw.video_url && !isAlreadyInSupabaseStorage(sw.video_url)) {
          const syncRes = await syncUrlToVault(sb, sw.id, "swipe", "video_url", sw.video_url);
          results.push(syncRes);
          if (syncRes.status === "synced" && syncRes.cdn_url) {
            patch.video_url = syncRes.cdn_url;
            meta.original_video_url = syncRes.original_url;
            meta.vault_video_synced_at = new Date().toISOString();
          }
        }

        if (Object.keys(patch).length > 0) {
          patch.metadata = meta;
          patch.updated_at = new Date().toISOString();
          await sb.from("imphq_swipes").update(patch).eq("id", sw.id);
        }

        return json({ ok: true, id: sw.id, results, updated: Object.keys(patch).length > 0 });
      }
    }

    // B. Sincronizar em Lote (batch de até 5 por execução para respeitar limites de timeout)
    if (op === "sync_batch") {
      const limit = Math.min(Number(body?.limit || 3), 5);
      const targetType = body?.target || "all"; // "gdrive" | "notion" | "all"

      let q = sb
        .from("imphq_referencias")
        .select("id, url, image_url, pipeline")
        .order("created_at", { ascending: false });

      if (targetType === "gdrive") {
        q = q.like("url", "%drive.google.com%");
      } else if (targetType === "notion") {
        q = q.like("image_url", "%notion.site%");
      }

      const { data: batchCandidates } = await q.limit(50);
      const pending = (batchCandidates || []).filter(
        (r) => !isAlreadyInSupabaseStorage(r.url) || !isAlreadyInSupabaseStorage(r.image_url)
      ).slice(0, limit);

      const processed = [];
      for (const item of pending) {
        const itemResults = [];
        const patch: Record<string, unknown> = {};
        const pipeline = (item.pipeline && typeof item.pipeline === "object" ? item.pipeline : {}) as Record<string, unknown>;
        const vaultInfo: Record<string, unknown> = (pipeline.vault as Record<string, unknown>) || {};

        if (item.url && !isAlreadyInSupabaseStorage(item.url)) {
          const res = await syncUrlToVault(sb, item.id, "referencia", "url", item.url);
          itemResults.push(res);
          if (res.status === "synced" && res.cdn_url) {
            patch.url = res.cdn_url;
            vaultInfo.original_url = res.original_url;
            vaultInfo.url_cdn = res.cdn_url;
          }
        }

        if (item.image_url && !isAlreadyInSupabaseStorage(item.image_url)) {
          const res = await syncUrlToVault(sb, item.id, "referencia", "image_url", item.image_url);
          itemResults.push(res);
          if (res.status === "synced" && res.cdn_url) {
            patch.image_url = res.cdn_url;
            vaultInfo.original_image_url = res.original_url;
            vaultInfo.image_cdn = res.cdn_url;
          }
        }

        if (Object.keys(patch).length > 0) {
          vaultInfo.status = "synced";
          patch.pipeline = { ...pipeline, vault: vaultInfo };
          patch.pipeline_at = new Date().toISOString();
          await sb.from("imphq_referencias").update(patch).eq("id", item.id);
        }

        processed.push({ id: item.id, results: itemResults });
      }

      return json({ ok: true, processed_count: processed.length, processed });
    }

    return json({ ok: false, error: "Operação desconhecida" }, 400);
  } catch (err) {
    console.error("[media-vault] Erro:", err);
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
