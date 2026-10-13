// ============================================================================
// 🏛️ IMPÉRIO HQ — Media Vault & CDN Própria
// Arquivo: supabase/functions/_shared/media-vault.ts
//
// Baixa vídeos e imagens de fontes externas (Google Drive, Meta Ads, Notion, etc.),
// armazena no Supabase Storage (bucket 'referencias') e substitui pelas URLs
// da CDN pública própria, preservando a URL de origem no histórico.
// ============================================================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface MediaResolveResult {
  ok: boolean;
  stream?: ReadableStream<Uint8Array>;
  buffer?: ArrayBuffer;
  contentType: string;
  contentLength: number | null;
  extension: string;
  error?: string;
}

export interface VaultSyncResult {
  id: string;
  entity: "referencia" | "swipe";
  field: "url" | "image_url" | "video_url" | "thumb_url";
  original_url: string;
  cdn_url?: string;
  storage_path?: string;
  size_bytes?: number;
  status: "synced" | "skipped" | "error";
  error?: string;
}

const STORAGE_BUCKET = "referencias";

// ============================================================================
// 1. RESOLVER DE MÍDIA EXTERNA (GOOGLE DRIVE / NOTION / META / DIRETO)
// ============================================================================

export function extractGoogleDriveId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const isGDrive = url.includes("drive.google.com") || url.includes("docs.google.com") || url.includes("drive.usercontent.google.com");
  if (!isGDrive) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i) ||
                url.match(/id=([a-zA-Z0-9_-]+)/i) ||
                url.match(/\/d\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

export function isAlreadyInSupabaseStorage(url: string | null | undefined): boolean {
  if (!url) return true; // Vazio não precisa de sync
  return url.includes(".supabase.co/storage/v1/object/public/") || url.startsWith("storage://");
}

export async function fetchExternalMedia(url: string): Promise<MediaResolveResult> {
  const gdriveId = extractGoogleDriveId(url);

  // A. GOOGLE DRIVE RESOLUTION COM BYPASS DE CONFIRMAÇÃO DE VÍRUS
  if (gdriveId) {
    const downloadUrl = `https://drive.usercontent.google.com/download?id=${gdriveId}&export=download`;
    try {
      const res = await fetch(downloadUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" },
      });

      const contentType = res.headers.get("content-type") || "";

      // Se retornou página HTML de confirmação de vírus do Google
      if (contentType.includes("text/html")) {
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

          if (!res2.ok) {
            return { ok: false, contentType: "", contentLength: null, extension: "mp4", error: `GDrive Form HTTP ${res2.status}` };
          }

          const ct2 = res2.headers.get("content-type") || "video/mp4";
          const len2 = Number(res2.headers.get("content-length")) || null;
          const ext = ct2.includes("image") ? "png" : "mp4";
          const buffer = await res2.arrayBuffer();

          return { ok: true, buffer, contentType: ct2, contentLength: len2 || buffer.byteLength, extension: ext };
        }
      }

      // Se retornou stream direta
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const ext = contentType.includes("image") ? "png" : "mp4";
        return {
          ok: true,
          buffer,
          contentType: contentType || "video/mp4",
          contentLength: buffer.byteLength,
          extension: ext,
        };
      }

      return { ok: false, contentType: "", contentLength: null, extension: "mp4", error: `GDrive HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, contentType: "", contentLength: null, extension: "mp4", error: `GDrive fetch: ${String(e)}` };
    }
  }

  // B. NOTION, META OU OUTROS SITES EXTERNOS
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });

    if (!res.ok) {
      return { ok: false, contentType: "", contentLength: null, extension: "bin", error: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get("content-type") || "";
    let ext = "bin";
    if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) ext = "jpg";
    else if (contentType.includes("image/png")) ext = "png";
    else if (contentType.includes("image/webp")) ext = "webp";
    else if (contentType.includes("video/mp4")) ext = "mp4";
    else if (contentType.includes("video/webm")) ext = "webm";
    else if (url.includes(".mp4")) ext = "mp4";
    else if (url.includes(".png")) ext = "png";
    else if (url.includes(".jpg")) ext = "jpg";

    const buffer = await res.arrayBuffer();
    return {
      ok: true,
      buffer,
      contentType: contentType || (ext === "mp4" ? "video/mp4" : "image/jpeg"),
      contentLength: buffer.byteLength,
      extension: ext,
    };
  } catch (e) {
    return { ok: false, contentType: "", contentLength: null, extension: "bin", error: `Generic fetch: ${String(e)}` };
  }
}

// ============================================================================
// 2. SINCRONIZADOR PARA SUPABASE STORAGE
// ============================================================================

export async function syncUrlToVault(
  sb: SupabaseClient,
  entityId: string,
  entityType: "referencia" | "swipe",
  field: "url" | "image_url" | "video_url" | "thumb_url",
  sourceUrl: string
): Promise<VaultSyncResult> {
  if (isAlreadyInSupabaseStorage(sourceUrl)) {
    return { id: entityId, entity: entityType, field, original_url: sourceUrl, status: "skipped" };
  }

  const fetched = await fetchExternalMedia(sourceUrl);
  if (!fetched.ok || !fetched.buffer) {
    return {
      id: entityId,
      entity: entityType,
      field,
      original_url: sourceUrl,
      status: "error",
      error: fetched.error || "Falha ao baixar mídia",
    };
  }

  const folder = entityType === "referencia" ? "vault/referencias" : "vault/swipes";
  const filename = `${field}_${entityId}.${fetched.extension}`;
  const storagePath = `${folder}/${filename}`;

  // Upload no Supabase Storage
  const { error: uploadError } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fetched.buffer, {
      contentType: fetched.contentType,
      upsert: true,
    });

  if (uploadError) {
    return {
      id: entityId,
      entity: entityType,
      field,
      original_url: sourceUrl,
      status: "error",
      error: `Storage upload: ${uploadError.message}`,
    };
  }

  // Gera a URL pública permanente da CDN
  const { data: publicData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  const cdnUrl = publicData.publicUrl;

  return {
    id: entityId,
    entity: entityType,
    field,
    original_url: sourceUrl,
    cdn_url: cdnUrl,
    storage_path: storagePath,
    size_bytes: fetched.buffer.byteLength,
    status: "synced",
  };
}
