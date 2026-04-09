import { supabase } from "@/integrations/supabase/client";

/**
 * Creates a calendar event for a Kanban card (fire-and-forget).
 */
export function createCalendarEventForCard(params: {
  title: string;
  due_date: string;
  project_id?: string | null;
  user_id: string;
  card_id: string;
}) {
  if (!params.due_date || !params.project_id) return;

  supabase
    .from("imphq_calendar_events")
    .insert({
      project_id: params.project_id,
      user_id: params.user_id,
      title: params.title,
      description: `[kanban:${params.card_id}] Tarefa do Kanban`,
      event_date: new Date(params.due_date).toISOString(),
      event_type: "task",
      all_day: true,
      reminder: false,
      color: null,
    })
    .then(({ error }) => {
      if (error) console.warn("Calendar sync failed:", error.message);
    });
}

/**
 * Updates the calendar event when a card's due_date changes.
 */
export function updateCalendarEventForCard(card_id: string, due_date: string | null) {
  if (!due_date) {
    // Remove event if date cleared
    removeCalendarEventForCard(card_id);
    return;
  }

  supabase
    .from("imphq_calendar_events")
    .update({ event_date: new Date(due_date).toISOString() })
    .like("description", `[kanban:${card_id}]%`)
    .then(({ error }) => {
      if (error) console.warn("Calendar event update failed:", error.message);
    });
}

/**
 * Removes the calendar event linked to a card.
 */
export function removeCalendarEventForCard(card_id: string) {
  supabase
    .from("imphq_calendar_events")
    .delete()
    .like("description", `[kanban:${card_id}]%`)
    .then(({ error }) => {
      if (error) console.warn("Calendar event delete failed:", error.message);
    });
}
