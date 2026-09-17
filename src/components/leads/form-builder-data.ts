import type { Json } from "@/integrations/supabase/types";
import { jsonFields, jsonText } from "@/lib/json-fields";

const FIELD_TYPES = ["text", "email", "tel", "select", "textarea", "number", "radio", "checkbox"] as const;
type FieldType = typeof FIELD_TYPES[number];
export function isFieldType(value: string): value is FieldType { return FIELD_TYPES.some(type => type === value); }
export type FormField = { [key: string]: Json | undefined; key: string; label: string; type: FieldType; required: boolean; options?: string[]; placeholder?: string };
export function isJson(value: unknown): value is Json {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  return typeof value === "object" && Object.values(value).every(item => item === undefined || isJson(item));
}
export function parseFormFields(value: unknown): FormField[] {
  if (!Array.isArray(value)) throw new Error("Campos do formulário devem ser uma lista.");
  return value.map((item, index): FormField => {
    if (!isJson(item)) throw new Error(`Campo ${index + 1} inválido.`);
    const field = jsonFields(item);
    const type = jsonText(field.type) || "text";
    if (!isFieldType(type)) throw new Error(`Tipo de campo não suportado: ${type}`);
    if (field.options != null && (!Array.isArray(field.options) || !field.options.every(option => typeof option === "string"))) throw new Error(`Opções do campo ${index + 1} inválidas.`);
    const options = Array.isArray(field.options) ? field.options.filter((option): option is string => typeof option === "string") : undefined;
    return { ...field, key: jsonText(field.key) || `campo_${index}`, label: jsonText(field.label) || `Campo ${index + 1}`, type, required: field.required === true, options, placeholder: jsonText(field.placeholder) };
  });
}
export function completionText(value: unknown): string {
  if (!isJson(value)) return "";
  const choices = jsonFields(value).choices;
  return Array.isArray(choices) ? jsonText(jsonFields(jsonFields(choices[0]).message).content) || "" : "";
}
