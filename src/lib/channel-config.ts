// Channel asset configuration - serialized inside HubAsset.output as JSON
// Marker: `_channel: true` to distinguish from copy/markdown outputs.
import { z } from "zod";

export interface ChannelConfig {
  _channel: true;
  url?: string;
  label?: string;
  observacao?: string;
  prioridade_ia?: "preferida" | "secundaria" | "evitar";
  ativo?: boolean;
  meta?: Record<string, unknown>;
}

const channelSchema = z.object({
  _channel: z.literal(true), url: z.string().optional(), label: z.string().optional(),
  observacao: z.string().optional(), prioridade_ia: z.enum(["preferida", "secundaria", "evitar"]).optional(),
  ativo: z.boolean().optional(), meta: z.record(z.unknown()).optional(),
}).passthrough();

export function isChannelOutput(output: string | undefined): boolean {
  if (!output) return false;
  try {
    const parsed: unknown = JSON.parse(output);
    return !!parsed && typeof parsed === "object" && "_channel" in parsed && parsed._channel === true;
  } catch {
    return false;
  }
}

export function parseChannelConfig(output: string | undefined): ChannelConfig {
  if (!output) return { _channel: true, ativo: true, prioridade_ia: "secundaria" };
  try {
    const parsed = channelSchema.safeParse(JSON.parse(output));
    if (parsed.success) return { ...parsed.data, _channel: true };
  } catch {
    // Non-JSON copy is not a channel configuration; use the editor defaults below.
  }
  return { _channel: true, ativo: true, prioridade_ia: "secundaria" };
}

export function serializeChannelConfig(cfg: ChannelConfig): string {
  return JSON.stringify({ ...cfg, _channel: true });
}
