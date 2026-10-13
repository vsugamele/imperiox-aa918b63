// ============================================================================
// 🏛️ IMPÉRIO HQ — Media Vault Worker Local de Alta Performance
// Arquivo: scripts/media_vault_worker.mjs
//
// Processa e espelha vídeos e imagens do Google Drive, Notion e Meta Ads
// direto para o Supabase Storage com streaming de alta velocidade, sem limites
// de memória de serverless.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SUPABASE_URL = "https://tkbivipqiewkfnhktmqq.supabase.co";

// Lê chave de .env (anon/publishable key é suficiente com as policies ativas)
let API_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!API_KEY && fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf8");
  const match = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=["']?([^"'\r\n]+)/) ||
                envContent.match(/SUPABASE_PUBLISHABLE_KEY=["']?([^"'\r\n]+)/);
  if (match) API_KEY = match[1];
}

if (!API_KEY) {
  console.error("❌ Chave do Supabase não encontrada no .env");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, API_KEY, {
  auth: { persistSession: false },
});

const BUCKET = "referencias";

function extractGoogleDriveId(url) {
  if (!url || typeof url !== "string") return null;
  const isGDrive = url.includes("drive.google.com") || url.includes("docs.google.com") || url.includes("drive.usercontent.google.com");
  if (!isGDrive) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i) ||
                url.match(/id=([a-zA-Z0-9_-]+)/i) ||
                url.match(/\/d\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

function isAlreadyInVault(url) {
  if (!url) return true;
  return url.includes(".supabase.co/storage/v1/object/public/") || url.startsWith("storage://");
}

async function fetchMedia(url) {
  const gdriveId = extractGoogleDriveId(url);

  if (gdriveId) {
    const directUrl = `https://drive.usercontent.google.com/download?id=${gdriveId}&export=download`;
    const res = await fetch(directUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" },
    });

    const ct = res.headers.get("content-type") || "";

    if (ct.includes("text/html")) {
      const html = await res.text();
      const formMatch = html.match(/<form[^>]+action="([^"]+)"/i);
      const action = formMatch ? formMatch[1] : null;
      const inputMatches = [...html.matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/gi)];

      if (action) {
        const params = new URLSearchParams();
        for (const m of inputMatches) params.append(m[1], m[2]);
        const finalUrl = `${action}?${params.toString()}`;
        const res2 = await fetch(finalUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Cookie": res.headers.get("set-cookie") || "",
          },
        });

        if (!res2.ok) throw new Error(`GDrive Form HTTP ${res2.status}`);

        const ct2 = res2.headers.get("content-type") || "video/mp4";
        const ext = ct2.includes("image") ? "png" : "mp4";
        const buffer = Buffer.from(await res2.arrayBuffer());
        return { buffer, contentType: ct2, extension: ext };
      }
    }

    if (res.ok) {
      const ext = ct.includes("image") ? "png" : "mp4";
      const buffer = Buffer.from(await res.arrayBuffer());
      return { buffer, contentType: ct || "video/mp4", extension: ext };
    }

    throw new Error(`GDrive HTTP ${res.status}`);
  }

  // Notion ou URL genérica
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const ct = res.headers.get("content-type") || "";
  let ext = "bin";
  if (ct.includes("image/jpeg") || ct.includes("image/jpg")) ext = "jpg";
  else if (ct.includes("image/png")) ext = "png";
  else if (ct.includes("image/webp")) ext = "webp";
  else if (ct.includes("video/mp4") || url.includes(".mp4")) ext = "mp4";
  else if (ct.includes("video/webm")) ext = "webm";

  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType: ct || (ext === "mp4" ? "video/mp4" : "image/jpeg"), extension: ext };
}

async function syncMediaFile(entityId, entityType, field, url) {
  if (isAlreadyInVault(url)) return null;

  const data = await fetchMedia(url);
  const folder = entityType === "referencia" ? "vault/referencias" : "vault/swipes";
  const filename = `${field}_${entityId}.${data.extension}`;
  const storagePath = `${folder}/${filename}`;

  const { error: uploadError } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, data.buffer, {
      contentType: data.contentType,
      upsert: true,
    });

  if (uploadError) throw new Error(`Upload storage error: ${uploadError.message}`);

  const { data: publicData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
  return {
    cdnUrl: publicData.publicUrl,
    storagePath,
    sizeBytes: data.buffer.length,
    contentType: data.contentType,
    originalUrl: url,
  };
}

async function main() {
  console.log("🛡️ [MEDIA VAULT WORKER] Iniciando sincronização direta de mídias...");

  const limit = parseInt(process.argv[2] || "10", 10);

  // 1. Busca referências com links do Google Drive
  let { data: refs = [], error: refErr } = await sb
    .from("imphq_referencias")
    .select("id, titulo, tipo, url, image_url, pipeline")
    .ilike("url", "%drive.google.com%")
    .limit(limit);

  if (refErr) {
    console.error("Erro ao carregar referências:", refErr);
    return;
  }

  // Se não encontrar Google Drive, busca Notion
  if (refs.length === 0) {
    const { data: notionRefs = [] } = await sb
      .from("imphq_referencias")
      .select("id, titulo, tipo, url, image_url, pipeline")
      .ilike("image_url", "%notion.site%")
      .limit(limit);
    refs = notionRefs;
  }

  console.log(`📋 Processando lote de até ${refs.length} referências...\n`);

  let syncedTotal = 0;

  for (let i = 0; i < refs.length; i++) {
    const r = refs[i];
    const prefix = `[${i + 1}/${refs.length}] [${r.titulo?.slice(0, 35) || r.id}]`;
    const patch = {};
    const pipeline = (r.pipeline && typeof r.pipeline === "object" ? r.pipeline : {});
    const vaultInfo = pipeline.vault || {};

    try {
      // Sincroniza URL de vídeo / conteúdo
      if (r.url && !isAlreadyInVault(r.url)) {
        process.stdout.write(`${prefix} Baixando URL (${r.url.slice(0, 40)}...)... `);
        const res = await syncMediaFile(r.id, "referencia", "url", r.url);
        if (res) {
          patch.url = res.cdnUrl;
          vaultInfo.original_url = res.originalUrl;
          vaultInfo.url_cdn = res.cdnUrl;
          vaultInfo.url_size = res.sizeBytes;
          vaultInfo.url_synced_at = new Date().toISOString();
          console.log(`✅ OK (${(res.sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
        } else {
          console.log(`⏩ Já no cofre`);
        }
      }

      // Sincroniza Imagem / Thumbnail
      if (r.image_url && !isAlreadyInVault(r.image_url)) {
        process.stdout.write(`${prefix} Baixando Imagem (${r.image_url.slice(0, 40)}...)... `);
        const res = await syncMediaFile(r.id, "referencia", "image_url", r.image_url);
        if (res) {
          patch.image_url = res.cdnUrl;
          vaultInfo.original_image_url = res.originalUrl;
          vaultInfo.image_cdn = res.cdnUrl;
          vaultInfo.image_size = res.sizeBytes;
          vaultInfo.image_synced_at = new Date().toISOString();
          console.log(`✅ OK (${(res.sizeBytes / 1024).toFixed(1)} KB)`);
        } else {
          console.log(`⏩ Já no cofre`);
        }
      }

      if (Object.keys(patch).length > 0) {
        vaultInfo.status = "synced";
        patch.pipeline = { ...pipeline, vault: vaultInfo };
        patch.pipeline_at = new Date().toISOString();

        const { error: updErr } = await sb.from("imphq_referencias").update(patch).eq("id", r.id);
        if (updErr) console.warn(`${prefix} ⚠️ Erro ao atualizar banco:`, updErr.message);
        else syncedTotal++;
      }
    } catch (err) {
      console.log(`❌ Falha: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\n🎉 [LOTE FINALIZADO] ${syncedTotal} mídias espelhadas no Supabase Storage com sucesso!`);
}

main().catch(console.error);
