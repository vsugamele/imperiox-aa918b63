
function hexToTint(hex: string | null | undefined, alpha = 0.12): string {
  if (!hex) return "hsl(var(--muted) / 0.3)";
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export { hexToTint };
