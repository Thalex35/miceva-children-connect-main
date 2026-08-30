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

export type Occurrence = {
  event: EventRow;
  start: Date;
  end: Date | null;
  dateKey: string;
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

/** Expands an event into concrete occurrences inside [from, to]. */
export function expandEvent(event: EventRow, from: Date, to: Date): Occurrence[] {
  if (!event.active) return [];
  const start = new Date(event.start_datetime);
  const durationMs = event.end_datetime
    ? new Date(event.end_datetime).getTime() - start.getTime()
    : null;
  const until = event.recurrence_until ? new Date(event.recurrence_until + "T23:59:59") : null;
  const out: Occurrence[] = [];

  const push = (day: Date) => {
    const s = withTimeOf(start, day);
    if (s < from || s > to) return;
    if (until && s > until) return;
    if (s < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return;
    out.push({
      event,
      start: s,
      end: durationMs !== null ? new Date(s.getTime() + durationMs) : null,
      dateKey: dateKey(s),
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

export function expandEvents(events: EventRow[], from: Date, to: Date): Occurrence[] {
  return events
    .flatMap((e) => expandEvent(e, from, to))
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
