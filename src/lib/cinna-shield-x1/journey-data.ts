import { supabase } from "@/integrations/supabase/client";
import { readJourney, type JourneyExecution } from "@/lib/cinna-shield-x1/journey";

const FLOW_ID = "cinna-shield-x1-native";
const BATCH = 250;
export const JOURNEY_LIMIT = 5000;
export const MESSAGE_PAGE_SIZE = 50;
export async function loadCinnaJourney(days: number, signal: AbortSignal) {
  const until = new Date().toISOString();
  const since = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
  const rows: JourneyExecution[] = [];
  let total = 0;
  for (let offset = 0; offset < JOURNEY_LIMIT; offset += BATCH) {
    let query = supabase.from("imphq_flow_executions")
      .select("id, lead_id, channel_session_id, status, current_step, created_at, updated_at, error_message, step_results", { count: "exact" })
      .eq("automacao_id", FLOW_ID).lte("created_at", until)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + BATCH - 1);
    if (since) query = query.gte("created_at", since);
    const { data, error, count } = await query.abortSignal(signal);
    if (error) throw error;
    if (count === null) throw new Error("Contagem de execuções indisponível");
    total = count;
    rows.push(...(data || []));
    if (!data || data.length < BATCH || rows.length >= total) break;
  }
  const conversations = rows.map(readJourney).filter((item): item is NonNullable<typeof item> => item !== null);
  const identities: Record<string, { name: string; channel: string }> = {};
  const ids = [...new Set(conversations.map(item => item.sessionId).filter((id): id is string => Boolean(id)))];
  for (let offset = 0; offset < ids.length; offset += BATCH) {
    const { data, error } = await supabase.from("imphq_channel_sessions").select("id, nome, canal")
      .in("id", ids.slice(offset, offset + BATCH)).abortSignal(signal);
    if (error) throw error;
    for (const item of data || []) identities[item.id] = { name: item.nome || `Lead ${item.id.slice(0, 8)}`, channel: item.canal };
  }
  return { conversations, identities, total, loaded: rows.length, unrecognized: rows.length - conversations.length, until };
}
export type JourneyData = Awaited<ReturnType<typeof loadCinnaJourney>>;

export async function loadJourneyMessages(sessionId: string, offset: number, until: string, signal: AbortSignal) {
  const { data, error, count } = await supabase.from("imphq_channel_messages")
    .select("id, direction, texto, media_url, meta, created_at", { count: "exact" })
    .eq("session_id", sessionId).lte("created_at", until)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + MESSAGE_PAGE_SIZE - 1).abortSignal(signal);
  if (error) throw error;
  return { messages: [...(data || [])].reverse(), total: count ?? 0 };
}
export type JourneyMessage = Awaited<ReturnType<typeof loadJourneyMessages>>["messages"][number];
