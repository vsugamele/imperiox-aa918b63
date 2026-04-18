import { subDays, startOfDay, endOfDay, startOfYesterday, endOfYesterday } from "date-fns";

/**
 * Returns a YYYY-MM-DD string in the LOCAL timezone (avoids UTC off-by-one in Brazil).
 * Use this instead of `new Date().toISOString().slice(0,10)` everywhere.
 */
export function toLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns YYYY-MM-DD in BRT (America/Sao_Paulo) regardless of server timezone.
 * Use in Edge Functions / scripts where `new Date()` is UTC.
 */
export function getBRTDateString(date: Date = new Date()): string {
  // en-CA gives YYYY-MM-DD format
  return date.toLocaleString("en-CA", { timeZone: "America/Sao_Paulo" }).split(",")[0];
}

/**
 * Returns a local-timezone YYYY-MM-DD for `daysAgo` days in the past.
 */
export function localDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return toLocalDateStr(d);
}

/**
 * Returns { from, to } ISO strings for a given dashboard period filter.
 */
export function getPeriodRange(period: string): { from: string; to: string } {
  const now = new Date();
  let from: Date;
  let to: Date = now;

  switch (period) {
    case "today":
      from = startOfDay(now);
      to = endOfDay(now);
      break;
    case "yesterday":
      from = startOfYesterday();
      to = endOfYesterday();
      break;
    case "7d":
      from = subDays(now, 7);
      break;
    case "90d":
      from = subDays(now, 90);
      break;
    case "6m":
      from = subDays(now, 180);
      break;
    case "30d":
    default:
      from = subDays(now, 30);
      break;
  }

  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Returns the previous equivalent period range (same duration, immediately before).
 * Useful for period-over-period comparisons.
 */
export function getPreviousPeriodRange(period: string): { from: string; to: string } {
  const current = getPeriodRange(period);
  const fromMs = new Date(current.from).getTime();
  const toMs = new Date(current.to).getTime();
  const duration = toMs - fromMs;
  const prevTo = new Date(fromMs - 1);
  const prevFrom = new Date(fromMs - 1 - duration);
  return { from: prevFrom.toISOString(), to: prevTo.toISOString() };
}

/**
 * Returns delta percentage between current and previous values.
 * Returns null when previous is 0 (avoids divide-by-zero / infinity).
 */
export function calcDelta(current: number, previous: number): number | null {
  if (!previous || previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}
