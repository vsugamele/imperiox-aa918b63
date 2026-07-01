// Utilitário para exibir bandeira + ISO de país a partir de código ISO-2.
const COUNTRY_NAMES: Record<string, string> = {
  BR: "Brasil", PY: "Paraguai", US: "Estados Unidos", AR: "Argentina",
  CL: "Chile", CO: "Colômbia", MX: "México", PE: "Peru", UY: "Uruguai",
  BO: "Bolívia", VE: "Venezuela", EC: "Equador", PT: "Portugal",
  ES: "Espanha", GB: "Reino Unido", FR: "França", DE: "Alemanha",
  IT: "Itália", CA: "Canadá", JP: "Japão", CN: "China", AU: "Austrália",
  EU: "União Europeia",
};

export function countryFlag(iso?: string | null): string {
  if (!iso || iso.length !== 2) return "🌎";
  const code = iso.toUpperCase();
  if (code === "EU") return "🇪🇺";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

export function countryName(iso?: string | null): string {
  if (!iso) return "Desconhecido";
  return COUNTRY_NAMES[iso.toUpperCase()] || iso.toUpperCase();
}

export function countryBadge(iso?: string | null): string {
  if (!iso) return "";
  return `${countryFlag(iso)} ${iso.toUpperCase()}`;
}
