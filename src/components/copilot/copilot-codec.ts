import type { Json } from "@/integrations/supabase/types";
export interface CopilotToolActivity {
  name: string;
  args: Json;
  result: Json;
  ts?: string;
}

export interface CopilotMsg {
  role: "user" | "assistant";
  content: string;
  ts?: string;
  tools?: CopilotToolActivity[];
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isJson(value: unknown): value is Json {
  return value === null || typeof value === "string" || typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) ? value.every(isJson) : record(value) && Object.values(value).every(isJson));
}
export function decodeCopilotTools(value: unknown): CopilotToolActivity[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((tool): CopilotToolActivity[] => {
    if (!record(tool) || typeof tool.name !== "string") return [];
    if (tool.args !== undefined && !isJson(tool.args)) return [];
    if (tool.result !== undefined && !isJson(tool.result)) return [];
    const args: Json = isJson(tool.args) ? tool.args : {};
    const result: Json = isJson(tool.result) ? tool.result : {};
    return [{ name: tool.name, args, result,
      ...(typeof tool.ts === "string" ? { ts: tool.ts } : {}) }];
  });
}
export function decodeCopilotMessages(value: unknown): CopilotMsg[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((message): CopilotMsg[] => {
    if (!record(message) || (message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") return [];
    return [{ role: message.role, content: message.content,
      ...(typeof message.ts === "string" ? { ts: message.ts } : {}),
      ...(message.tools !== undefined ? { tools: decodeCopilotTools(message.tools) } : {}),
    }];
  });
}
export function serializeCopilotMessages(messages: CopilotMsg[]): Json {
  return messages.map(message => ({
    role: message.role, content: message.content,
    ...(message.ts !== undefined ? { ts: message.ts } : {}),
    ...(message.tools !== undefined ? { tools: message.tools.map(tool => ({
      name: tool.name, args: tool.args, result: tool.result,
      ...(tool.ts !== undefined ? { ts: tool.ts } : {}),
    })) } : {}),
  }));
}
export function decodeCopilotStream(value: unknown):
  | { type: "meta"; threadId: string }
  | { type: "tools"; tools: CopilotToolActivity[] }
  | { type: "delta"; content: string }
  | null {
  if (!record(value)) return null;
  if (value.type === "meta") return typeof value.threadId === "string" ? { type: "meta", threadId: value.threadId } : null;
  if (value.type === "tools") return { type: "tools", tools: decodeCopilotTools(value.tools) };
  const choice: unknown = Array.isArray(value.choices) ? value.choices[0] : undefined;
  if (!record(choice) || !record(choice.delta) || typeof choice.delta.content !== "string") return null;
  return { type: "delta", content: choice.delta.content };
}


