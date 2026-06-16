// Gera variantes de telefone BR (com/sem 55, com/sem 9º dígito) para evitar
// duplicidade entre WA (5511...) e CRM (11...).
export function brPhoneVariants(raw: string | null | undefined): {
  canonical: string;
  variants: string[];
} {
  const clean = (raw || "").replace(/\D/g, "");
  const out = new Set<string>();
  if (!clean) return { canonical: "", variants: [] };
  out.add(clean);

  let base = clean;
  // Remove 55 inicial se presente para normalizar
  if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
    base = clean.slice(2);
  }
  // base agora é DDD + numero (10 ou 11 dígitos)
  if (base.length === 11 && base[2] === "9") {
    const without9 = base.slice(0, 2) + base.slice(3);
    out.add(base);
    out.add(without9);
    out.add("55" + base);
    out.add("55" + without9);
  } else if (base.length === 10) {
    const with9 = base.slice(0, 2) + "9" + base.slice(2);
    out.add(base);
    out.add(with9);
    out.add("55" + base);
    out.add("55" + with9);
  }

  const canonical = clean.startsWith("55") ? clean : "55" + base;
  return { canonical, variants: Array.from(out) };
}
