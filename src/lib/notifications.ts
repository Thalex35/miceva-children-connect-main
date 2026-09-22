import { supabase } from "@/integrations/supabase/client";
import { type EventRow, type Occurrence, expandEvents } from "@/lib/recurrence";
import { type Child, ageFromDob, fullName } from "@/lib/children";

export type NotificationDraft = {
  userId: string;
  type: "event_reminder" | "birthday_reminder";
  title: string;
  message: string;
  eventId: string | null;
  eventOccurrenceDate: string | null;
  childId?: string;
  birthdayYear?: number;
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
  related_child_id: string | null;
  birthday_year: number | null;
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

export const BIRTHDAY_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000; // Notify if birthday is within 24 hours

/**
 * Generate birthday notifications for children whose birthday is tomorrow or today.
 * Only generates notifications if the child has a valid date_of_birth.
 */
export function getDueBirthdayNotifications(
  children: Child[],
  now: Date,
  userId: string,
): NotificationDraft[] {
  const notifications: NotificationDraft[] = [];
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const tomorrowMonth = tomorrow.getMonth() + 1;
  const tomorrowDay = tomorrow.getDate();
  const nowMonth = now.getMonth() + 1;
  const nowDay = now.getDate();
  const currentYear = now.getFullYear();

  for (const child of children) {
    if (!child.date_of_birth) continue;

    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(child.date_of_birth);
    if (!parts) continue;

    const birthMonth = Number(parts[2]);
    const birthDay = Number(parts[3]);

    // Check if birthday is today or tomorrow
    const isBirthdayToday = birthMonth === nowMonth && birthDay === nowDay;
    const isBirthdayTomorrow = birthMonth === tomorrowMonth && birthDay === tomorrowDay;

    if (!isBirthdayToday && !isBirthdayTomorrow) continue;

    // Calculate the age they'll turn this year
    const birthYear = Number(parts[1]);
    let ageThisYear = currentYear - birthYear;
    
    // For notifications, we always report the age after the birthday
    // (since it's happening today or tomorrow)
    // No age decrement needed - they're turning that age

    const whenText = isBirthdayToday ? "today" : "tomorrow";
    const name = `${child.first_name} ${child.last_name}`.trim();
    
    notifications.push({
      userId,
      type: "birthday_reminder",
      title: "🎂 Birthday",
      message: `${name} is turning ${ageThisYear} ${whenText}.`,
      eventId: null,
      eventOccurrenceDate: null,
      childId: child.id,
      birthdayYear: currentYear,
      scheduledFor: (isBirthdayToday ? now : tomorrow).toISOString(),
    });
  }

  // Deduplicate by user + child + year
  return notifications.filter((n, index, arr) => {
    const key = `${n.userId}:${n.childId}:${n.birthdayYear}`;
    return arr.findIndex((candidate) => `${candidate.userId}:${candidate.childId}:${candidate.birthdayYear}` === key) === index;
  });
}

export async function syncBirthdayNotifications(userId: string, children: Child[]) {
  const now = new Date();
  const drafts = getDueBirthdayNotifications(children, now, userId);
  if (drafts.length === 0) return { created: 0, skipped: 0 };

  const rows = drafts.map((draft) => ({
    user_id: draft.userId,
    type: draft.type,
    title: draft.title,
    message: draft.message,
    related_event_id: draft.eventId,
    event_occurrence_date: draft.eventOccurrenceDate,
    related_child_id: draft.childId,
    birthday_year: draft.birthdayYear,
    scheduled_for: draft.scheduledFor,
  }));

  const childIds = drafts.map((d) => d.childId).filter((id): id is string => Boolean(id));
  if (childIds.length === 0) return { created: 0, skipped: 0 };

  const { data: existing, error: existingError } = await supabase
    .from("notifications")
    .select("user_id, related_child_id, birthday_year")
    .eq("user_id", userId)
    .in("related_child_id", childIds);

  if (existingError) throw existingError;

  const seen = new Set(
    (existing ?? []).map((row) => `${row.user_id}:${row.related_child_id}:${row.birthday_year}`),
  );

  const toInsert = rows.filter(
    (row) => !seen.has(`${row.user_id}:${row.related_child_id}:${row.birthday_year}`),
  );

  if (toInsert.length === 0) return { created: 0, skipped: drafts.length };

  const { error } = await supabase.from("notifications").insert(toInsert);
  if (error) throw error;
  return { created: toInsert.length, skipped: drafts.length - toInsert.length };
}

export async function syncBirthdayNotificationsForUsers(userIds: string[], children: Child[]) {
  let created = 0;
  let skipped = 0;

  for (const userId of userIds) {
    const result = await syncBirthdayNotifications(userId, children);
    created += result.created;
    skipped += result.skipped;
  }

  return { created, skipped, users: userIds.length };
}
