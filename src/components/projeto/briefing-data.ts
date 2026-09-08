import type { Json } from "@/integrations/supabase/types";
import { jsonFields, jsonText } from "@/lib/json-fields";

export function copyArsenalFields(value: Json | undefined): Record<string, string | string[]> {
  return Object.fromEntries(Object.entries(jsonFields(value)).filter((entry): entry is [string, string | string[]] =>
    typeof entry[1] === "string" || (Array.isArray(entry[1]) && entry[1].every(item => typeof item === "string"))));
}

/** Apply one complete product patch so successive updates cannot overwrite each other. */
export function mergeProductIntelligence(product: Json, result: Json): Json {
  const current = jsonFields(product);
  const intel = jsonFields(jsonFields(result).product_intel);
  const merged = { ...current };
  for (const key of ["mecanismo", "contexto"] as const) {
    if (!(jsonText(current[key]) || "").trim() && typeof intel[key] === "string") merged[key] = intel[key];
  }
  if ((!Array.isArray(current.ofertas) || current.ofertas.length === 0) && Array.isArray(intel.ofertas_sugeridas) && intel.ofertas_sugeridas.length > 0) {
    merged.ofertas = intel.ofertas_sugeridas.map(jsonFields).map(offer => ({
      nome: offer.nome, tipo_oferta: offer.tipo_oferta, preco_por: offer.preco_sugerido, ativo: true,
    }));
  }
  return merged;
}
