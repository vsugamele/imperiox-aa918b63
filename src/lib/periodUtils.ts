import { subDays, startOfDay, endOfDay, startOfYesterday, endOfYesterday } from "date-fns";

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
