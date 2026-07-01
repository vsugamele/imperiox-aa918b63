// Channel asset configuration - serialized inside HubAsset.output as JSON
// Marker: `_channel: true` to distinguish from copy/markdown outputs.

export interface ChannelConfig {
  _channel: true;
  url?: string;
  label?: string;
  observacao?: string;
  prioridade_ia?: "preferida" | "secundaria" | "evitar";
  ativo?: boolean;
  meta?: Record<string, any>;
}

export function isChannelOutput(output: string | undefined): boolean {
  if (!output) return false;
  try {
    const parsed = JSON.parse(output);
    return parsed && parsed._channel === true;
  } catch {
    return false;
  }
}

export function parseChannelConfig(output: string | undefined): ChannelConfig {
  if (!output) return { _channel: true, ativo: true, prioridade_ia: "secundaria" };
  try {
    const parsed = JSON.parse(output);
    if (parsed && parsed._channel === true) return parsed as ChannelConfig;
  } catch {}
  return { _channel: true, ativo: true, prioridade_ia: "secundaria" };
}

export function serializeChannelConfig(cfg: ChannelConfig): string {
  return JSON.stringify({ ...cfg, _channel: true });
}
