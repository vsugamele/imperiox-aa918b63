// Extract filename from message content (e.g. "📎 file.pdf") or URL
export function extractFilename(content: string | undefined, url: string | undefined): string {
  if (content) {
    const cleaned = content.replace(/^(?:📎|🎵|🎬|🖼\uFE0F?)\s*/u, "").trim();
    if (cleaned && !/^(mídia|midia|imagem|áudio|audio|vídeo|video|arquivo|document)$/i.test(cleaned)) {
      return cleaned;
    }
  }
  if (url) {
    try {
      const u = new URL(url);
      const last = u.pathname.split("/").pop();
      if (last) return decodeURIComponent(last);
    } catch {
      // Invalid URLs fall back to the generic filename.
    }
  }
  return "arquivo";
}

