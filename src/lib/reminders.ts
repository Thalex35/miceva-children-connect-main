import type { Occurrence } from "@/lib/recurrence";

export type ReminderWindow = { id: string; label: string; leadMs: number };

/**
 * Configurable reminder lead times. Kept as a plain in-memory list rather
 * than a database table: there's no cron/edge-function/scheduled-worker in
 * this project to consume a persisted "scheduled_for" row, so a reminders
 * table would sit unused — the same "scaffolding nobody calls" trap seen
 * elsewhere in this app. This list is exactly where a real configuration
 * UI would eventually read from, and would move to the database only once
 * an actual scheduler-backed delivery path exists.
 */
export const REMINDER_WINDOWS: ReminderWindow[] = [
  { id: "1h", label: "Starting soon", leadMs: 60 * 60 * 1000 },
  { id: "1d", label: "Tomorrow", leadMs: 24 * 60 * 60 * 1000 },
];

export type Reminder = {
  /** Stable dedup key: one reminder per occurrence, regardless of how many windows match. */
  key: string;
  occurrence: Occurrence;
  window: ReminderWindow;
};

/**
 * Finds occurrences currently due for a reminder as of `now`.
 *
 * - Cancelled occurrences are skipped entirely (the caller is expected to
 *   have already expanded occurrences with exceptions applied, so
 *   `occurrence.start`/`occurrence.cancelled` already reflect any override).
 * - Already-started/past occurrences never generate a reminder.
 * - Inactive events never reach this function in the first place —
 *   `expandEvent` already returns no occurrences for `active: false`.
 * - When more than one window would match (e.g. an event 30 minutes away
 *   matches both "1 hour" and "1 day"), only the nearest (smallest leadMs)
 *   window is used, so a single occurrence never produces more than one
 *   reminder at a time.
 */
export function getDueReminders(
  occurrences: Occurrence[],
  now: Date,
  windows: ReminderWindow[] = REMINDER_WINDOWS,
): Reminder[] {
  const sortedWindows = [...windows].sort((a, b) => a.leadMs - b.leadMs);
  const reminders: Reminder[] = [];

  for (const occurrence of occurrences) {
    if (occurrence.cancelled) continue;
    const msUntilStart = occurrence.start.getTime() - now.getTime();
    if (msUntilStart <= 0) continue;

    const window = sortedWindows.find((w) => msUntilStart <= w.leadMs);
    if (!window) continue;

    reminders.push({
      key: `${occurrence.event.id}:${occurrence.dateKey}`,
      occurrence,
      window,
    });
  }

  return reminders;
}
