import type { Json } from "@/integrations/supabase/types";
import { jsonFields } from "@/lib/json-fields";

export function mergeLeadQualification(existing: Json | undefined, analysis: Json | undefined) {
  const data = jsonFields(existing);
  return { ...data, qualificacao: { ...jsonFields(data.qualificacao), ...jsonFields(jsonFields(analysis).qualificacao) } };
}
