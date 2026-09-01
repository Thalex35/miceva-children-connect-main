export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string | null;
  location: string | null;
  responsible_person: string | null;
  event_type: string;
  recurrence: string;
  recurrence_days: number[] | null;
  recurrence_until: string | null;
  active: boolean;
  notes: string | null;
};

export type EventException = {
  id: string;
  event_id: string;
  occurrence_date: string;
  cancelled: boolean;
  override_title: string | null;
  override_start_time: string | null;
  override_end_time: string | null;
  override_location: string | null;
  notes: string | null;
};

export type Occurrence = {
  event: EventRow;
  start: Date;
  end: Date | null;
  dateKey: string;
  cancelled: boolean;
  overridden: boolean;
  exception: EventException | null;
  /** Title after any override is applied — use this for display instead of event.title. */
  title: string;
  /** Location after any override is applied — use this for display instead of event.location. */
  location: string | null;
};

export const EVENT_TYPES = [
  "prayer",
  "children",
  "meeting",
  "program",
  "training",
  "other",
] as const;

export const RECURRENCES = ["none", "daily", "weekly", "monthly", "custom_weekly"] as const;

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function withTimeOf(base: Date, day: Date) {
  const d = new Date(day);
  d.setHours(base.getHours(), base.getMinutes(), 0, 0);
  return d;
}

/** Applies an override time string ("HH:MM" or "HH:MM:SS") onto a specific day. */
function withOverrideTime(day: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function findException(
  exceptions: EventException[],
  eventId: string,
  key: string,
): EventException | null {
  return exceptions.find((e) => e.event_id === eventId && e.occurrence_date === key) ?? null;
}

/** Expands an event into concrete occurrences inside [from, to], applying any per-occurrence exceptions. */
export function expandEvent(
  event: EventRow,
  from: Date,
  to: Date,
  exceptions: EventException[] = [],
): Occurrence[] {
  if (!event.active) return [];
  const start = new Date(event.start_datetime);
  const durationMs = event.end_datetime
    ? new Date(event.end_datetime).getTime() - start.getTime()
    : null;
  const until = event.recurrence_until ? new Date(event.recurrence_until + "T23:59:59") : null;
  const out: Occurrence[] = [];

  const push = (day: Date) => {
    let s = withTimeOf(start, day);
    if (s < from || s > to) return;
    if (until && s > until) return;
    if (s < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return;

    const key = dateKey(s);
    const exception = findException(exceptions, event.id, key);

    let e = durationMs !== null ? new Date(s.getTime() + durationMs) : null;
    if (exception?.override_start_time) s = withOverrideTime(s, exception.override_start_time);
    if (exception?.override_end_time) {
      e = withOverrideTime(s, exception.override_end_time);
    } else if (exception?.override_start_time && durationMs !== null) {
      // Start moved but no explicit end override — keep the original duration.
      e = new Date(s.getTime() + durationMs);
    }

    out.push({
      event,
      start: s,
      end: e,
      dateKey: key,
      cancelled: exception?.cancelled ?? false,
      overridden: Boolean(
        exception &&
        (exception.override_title ||
          exception.override_start_time ||
          exception.override_end_time ||
          exception.override_location),
      ),
      exception,
      title: exception?.override_title || event.title,
      location: exception?.override_location || event.location,
    });
  };

  if (event.recurrence === "none") {
    push(start);
    return out;
  }

  const cursor = new Date(Math.max(from.getTime(), start.getTime()));
  cursor.setHours(0, 0, 0, 0);
  const limit = new Date(to);
  const days = event.recurrence_days?.length ? event.recurrence_days : [start.getDay()];

  while (cursor <= limit) {
    if (event.recurrence === "daily") push(cursor);
    else if (event.recurrence === "weekly" || event.recurrence === "custom_weekly") {
      if (days.includes(cursor.getDay())) push(cursor);
    } else if (event.recurrence === "monthly") {
      if (cursor.getDate() === start.getDate()) push(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function expandEvents(
  events: EventRow[],
  from: Date,
  to: Date,
  exceptions: EventException[] = [],
): Occurrence[] {
  return events
    .flatMap((e) => expandEvent(e, from, to, exceptions))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function describeRecurrence(event: EventRow) {
  switch (event.recurrence) {
    case "daily":
      return "Every day";
    case "weekly":
    case "custom_weekly": {
      const days = event.recurrence_days?.length
        ? event.recurrence_days
        : [new Date(event.start_datetime).getDay()];
      return `Every ${days.map((d) => WEEKDAYS[d]).join(", ")}`;
    }
    case "monthly":
      return "Every month";
    default:
      return "One time";
  }
}

export function formatTime(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
