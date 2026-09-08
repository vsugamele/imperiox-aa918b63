import type { TablesUpdate } from "@/integrations/supabase/types";
export interface ProcessFormData {
 title: string; description: string; steps: { text: string; done: boolean }[];
 category: string; member_id: string; project_id: string;
}
export function processPayload(form: ProcessFormData) {
 return { title: form.title.trim(), description: form.description || null, steps: form.steps,
 category: form.category, member_id: form.member_id !== "none" ? form.member_id : null,
 project_id: form.project_id !== "none" ? form.project_id : null } satisfies TablesUpdate<"imphq_processes">;
}
