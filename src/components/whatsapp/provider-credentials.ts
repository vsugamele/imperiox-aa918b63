import type { TablesUpdate } from "@/integrations/supabase/types";
export function providerCredentialPatch(form: { api_key: string; access_token: string }, editing: boolean): Pick<TablesUpdate<"imphq_wa_providers">, "api_key" | "access_token"> {
 return {
  ...(!editing || form.api_key.trim() ? { api_key: form.api_key || null } : {}),
  ...(!editing || form.access_token.trim() ? { access_token: form.access_token || null } : {}),
 };
}
