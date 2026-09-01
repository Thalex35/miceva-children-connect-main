import { useEffect, useMemo, useState } from "react";
import { useEventExceptions, useEvents } from "@/lib/queries";
import { expandEvents } from "@/lib/recurrence";
import { getDueReminders, type Reminder } from "@/lib/reminders";

const DISMISSED_KEY = "miceva-dismissed-reminders";

function loadDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(keys: Set<string>) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...keys]));
  } catch {
    // localStorage unavailable (private browsing, storage full, etc.) —
    // reminders still work, they just won't remember dismissals.
  }
}

/** Drops dismissed-reminder keys whose occurrence date is well in the past, so this never grows unbounded. */
function pruneDismissed(dismissed: Set<string>): Set<string> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 2);
  const kept = new Set<string>();
  for (const key of dismissed) {
    const dateStr = key.split(":")[1];
    const date = dateStr ? new Date(`${dateStr}T00:00:00`) : null;
    if (date && !Number.isNaN(date.getTime()) && date >= cutoff) kept.add(key);
  }
  return kept;
}

/**
 * Surfaces in-app reminders for events starting soon. This only detects
 * reminders while the app is open and this hook is mounted (on load, on
 * refresh, or on a later re-render) — there is no cron job, Supabase Edge
 * Function, or other server-side scheduler in this project, so no
 * notification can ever be delivered while nobody has the app open. That's
 * a deliberate, honest limitation, not an oversight.
 */
export function useEventReminders() {
  const { data: events } = useEvents();
  const { data: exceptions } = useEventExceptions();
  const [dismissed, setDismissed] = useState<Set<string>>(() => pruneDismissed(loadDismissed()));

  useEffect(() => {
    saveDismissed(dismissed);
  }, [dismissed]);

  const reminders: Reminder[] = useMemo(() => {
    if (!events) return [];
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const occurrences = expandEvents(events, now, horizon, exceptions ?? []);
    return getDueReminders(occurrences, now).filter((r) => !dismissed.has(r.key));
  }, [events, exceptions, dismissed]);

  const dismiss = (key: string) => {
    setDismissed((prev) => new Set(prev).add(key));
  };

  return { reminders, dismiss };
}
