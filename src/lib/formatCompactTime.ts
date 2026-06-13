// Formato compacto estilo Instagram/WhatsApp: agora, 1m, 36m, 2h, Ontem, 3d, 12/06
export function formatCompactTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}m`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;

  // Ontem
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return "Ontem";
  }

  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  if (date.getFullYear() === now.getFullYear()) return `${dd}/${mm}`;
  return `${dd}/${mm}/${String(date.getFullYear()).slice(-2)}`;
}

// Estilo WhatsApp: HH:MM para hoje, dd/MM para dias anteriores (mesmo ano)
export function formatMessageTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const dd = String(date.getDate()).padStart(2, "0");
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  if (date.getFullYear() === now.getFullYear()) return `${dd}/${mo}`;
  return `${dd}/${mo}/${String(date.getFullYear()).slice(-2)}`;
}
