import { supabase } from "@/integrations/supabase/client";
import { type EventRow, type Occurrence, expandEvents } from "@/lib/recurrence";

export type NotificationDraft = {
  userId: string;
  type: "event_reminder";
  title: string;
  message: string;
  eventId: string | null;
  eventOccurrenceDate: string | null;
  scheduledFor: string;
};

export type StoredNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_event_id: string | null;
  event_occurrence_date: string | null;
  scheduled_for: string | null;
  read_at: string | null;
  created_at: string;
};

export const EVENT_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export function getDueEventNotifications(
  events: EventRow[],
  exceptions: EventRow[] | EventExceptionLike[] = [],
  now: Date,
  userId: string,
): NotificationDraft[] {
  const horizon = new Date(now.getTime() + EVENT_REMINDER_WINDOW_MS);
  const occurrenceList = expandEvents(events, now, horizon, exceptions as any);
  const notifications: NotificationDraft[] = [];

  for (const occurrence of occurrenceList) {
    if (occurrence.cancelled) continue;
    const leadMs = occurrence.start.getTime() - now.getTime();
    if (leadMs <= 0 || leadMs > EVENT_REMINDER_WINDOW_MS) continue;

    notifications.push({
      userId,
      type: "event_reminder",
      title: "Upcoming event",
      message: `${occurrence.title} starts ${occurrence.start.toLocaleString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      eventId: occurrence.event.id,
      eventOccurrenceDate: occurrence.dateKey,
      scheduledFor: occurrence.start.toISOString(),
    });
  }

  return notifications.filter((n, index, arr) => {
    const key = `${n.userId}:${n.eventId ?? "-"}:${n.scheduledFor}`;
    return arr.findIndex((candidate) => `${candidate.userId}:${candidate.eventId ?? "-"}:${candidate.scheduledFor}` === key) === index;
  });
}

function isEventExceptionLike(value: unknown): value is { event_id?: string; occurrence_date?: string; cancelled?: boolean } {
  return typeof value === "object" && value !== null && "event_id" in value;
}

type EventExceptionLike = { event_id: string; occurrence_date: string; cancelled?: boolean };

export async function syncEventNotifications(
  userId: string,
  events: EventRow[],
  exceptions: EventExceptionLike[] = [],
) {
  const now = new Date();
  const drafts = getDueEventNotifications(events, exceptions, now, userId);
  if (drafts.length === 0) return { created: 0, skipped: 0 };

  const rows = drafts.map((draft) => ({
    user_id: draft.userId,
    type: draft.type,
    title: draft.title,
    message: draft.message,
    related_event_id: draft.eventId,
    event_occurrence_date: draft.eventOccurrenceDate,
    scheduled_for: draft.scheduledFor,
  }));

  const { data: existing, error: existingError } = await supabase
    .from("notifications")
    .select("user_id, related_event_id, scheduled_for")
    .eq("user_id", userId)
    .in(
      "related_event_id",
      drafts.map((draft) => draft.eventId).filter((id): id is string => Boolean(id)),
    );

  if (existingError) throw existingError;

  const seen = new Set(
    (existing ?? []).map((row) => `${row.user_id}:${row.related_event_id ?? "-"}:${row.scheduled_for ?? "-"}`),
  );

  const toInsert = rows.filter(
    (row) => !seen.has(`${row.user_id}:${row.related_event_id ?? "-"}:${row.scheduled_for ?? "-"}`),
  );

  if (toInsert.length === 0) return { created: 0, skipped: drafts.length };

  const { error } = await supabase.from("notifications").insert(toInsert);
  if (error) throw error;
  return { created: toInsert.length, skipped: drafts.length - toInsert.length };
}

export async function markNotificationAsRead(notificationId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select();

  if (error) throw error;
}

export async function markAllNotificationsAsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw error;
}

export async function syncEventNotificationsForUsers(
  userIds: string[],
  events: EventRow[],
  exceptions: EventExceptionLike[] = [],
) {
  let created = 0;
  let skipped = 0;

  for (const userId of userIds) {
    const result = await syncEventNotifications(userId, events, exceptions);
    created += result.created;
    skipped += result.skipped;
  }

  return { created, skipped, users: userIds.length };
}
