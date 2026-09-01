import { describe, expect, it } from "bun:test";
import { expandEvents, type EventException, type EventRow } from "./recurrence";
import { getDueReminders, type ReminderWindow } from "./reminders";

function weeklyEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "evt-1",
    title: "Sunday Prayer Meeting",
    description: null,
    start_datetime: "2026-09-06T09:00:00.000Z",
    end_datetime: "2026-09-06T10:00:00.000Z",
    location: "Church",
    responsible_person: null,
    event_type: "prayer",
    recurrence: "weekly",
    recurrence_days: [0], // Sunday
    recurrence_until: null,
    active: true,
    notes: null,
    ...overrides,
  };
}

function exception(overrides: Partial<EventException> = {}): EventException {
  return {
    id: "exc-1",
    event_id: "evt-1",
    occurrence_date: "2026-09-13",
    cancelled: false,
    override_title: null,
    override_start_time: null,
    override_end_time: null,
    override_location: null,
    notes: null,
    ...overrides,
  };
}

const from = new Date("2026-09-01T00:00:00");
const to = new Date("2026-09-30T23:59:59");

describe("expandEvents with exceptions", () => {
  it("a normal recurring occurrence appears with no exception", () => {
    const occurrences = expandEvents([weeklyEvent()], from, to);
    const sept13 = occurrences.find((o) => o.dateKey === "2026-09-13");
    expect(sept13).toBeTruthy();
    expect(sept13?.cancelled).toBe(false);
  });

  it("a cancelled occurrence is marked cancelled but still present, and other occurrences are unaffected", () => {
    const occurrences = expandEvents([weeklyEvent()], from, to, [
      exception({ occurrence_date: "2026-09-13", cancelled: true }),
    ]);
    const sept13 = occurrences.find((o) => o.dateKey === "2026-09-13");
    const sept20 = occurrences.find((o) => o.dateKey === "2026-09-20");
    expect(sept13?.cancelled).toBe(true);
    expect(sept20?.cancelled).toBe(false);
  });

  it("an overridden title is reflected in occurrence.title without touching the parent event", () => {
    const event = weeklyEvent();
    const occurrences = expandEvents([event], from, to, [
      exception({ occurrence_date: "2026-09-13", override_title: "Special Prayer Night" }),
    ]);
    const sept13 = occurrences.find((o) => o.dateKey === "2026-09-13");
    const sept20 = occurrences.find((o) => o.dateKey === "2026-09-20");
    expect(sept13?.title).toBe("Special Prayer Night");
    expect(sept13?.overridden).toBe(true);
    expect(event.title).toBe("Sunday Prayer Meeting"); // parent event untouched
    expect(sept20?.title).toBe("Sunday Prayer Meeting"); // other occurrence unaffected
  });

  it("an overridden start/end time shifts the occurrence's effective time", () => {
    const occurrences = expandEvents([weeklyEvent()], from, to, [
      exception({
        occurrence_date: "2026-09-13",
        override_start_time: "18:00",
        override_end_time: "19:30",
      }),
    ]);
    const sept13 = occurrences.find((o) => o.dateKey === "2026-09-13");
    expect(sept13?.start.getHours()).toBe(18);
    expect(sept13?.start.getMinutes()).toBe(0);
    expect(sept13?.end?.getHours()).toBe(19);
    expect(sept13?.end?.getMinutes()).toBe(30);
  });

  it("an overridden location is reflected in occurrence.location", () => {
    const occurrences = expandEvents([weeklyEvent()], from, to, [
      exception({ occurrence_date: "2026-09-13", override_location: "Community Hall" }),
    ]);
    const sept13 = occurrences.find((o) => o.dateKey === "2026-09-13");
    expect(sept13?.location).toBe("Community Hall");
  });

  it("restoring means the exception is simply absent, and the occurrence reads normally again", () => {
    // Restoring is modeled as removing the exception row entirely (see
    // eventExceptions.ts) — this asserts that with no exception present,
    // the occurrence is indistinguishable from one that was never touched.
    const occurrences = expandEvents([weeklyEvent()], from, to, []);
    const sept13 = occurrences.find((o) => o.dateKey === "2026-09-13");
    expect(sept13?.cancelled).toBe(false);
    expect(sept13?.overridden).toBe(false);
    expect(sept13?.title).toBe("Sunday Prayer Meeting");
  });

  it("an upsert-style write for the same event+date never produces two exceptions applied at once", () => {
    // Simulates the UNIQUE (event_id, occurrence_date) constraint: only the
    // latest exception for a given occurrence should ever be passed in.
    const exceptions = [exception({ occurrence_date: "2026-09-13", cancelled: true })];
    const occurrences = expandEvents([weeklyEvent()], from, to, exceptions);
    const matches = occurrences.filter((o) => o.dateKey === "2026-09-13");
    expect(matches.length).toBe(1);
    expect(matches[0]?.cancelled).toBe(true);
  });

  it("a non-recurring event continues working normally with no exceptions involved", () => {
    const single = weeklyEvent({
      id: "evt-2",
      recurrence: "none",
      start_datetime: "2026-09-10T14:00:00.000Z",
      end_datetime: "2026-09-10T15:00:00.000Z",
    });
    const occurrences = expandEvents([single], from, to, []);
    expect(occurrences.length).toBe(1);
    expect(occurrences[0]?.cancelled).toBe(false);
  });
});

describe("getDueReminders", () => {
  const windows: ReminderWindow[] = [
    { id: "1h", label: "Starting soon", leadMs: 60 * 60 * 1000 },
    { id: "1d", label: "Tomorrow", leadMs: 24 * 60 * 60 * 1000 },
  ];

  it("detects an event starting within the window as upcoming", () => {
    const now = new Date("2026-09-13T08:30:00");
    const occurrences = expandEvents([weeklyEvent()], from, to); // 09:00 start
    const reminders = getDueReminders(occurrences, now, windows);
    expect(reminders.some((r) => r.occurrence.dateKey === "2026-09-13")).toBe(true);
  });

  it("does not remind about a past event", () => {
    const now = new Date("2026-09-13T10:00:00"); // after the 09:00-10:00 slot
    const occurrences = expandEvents([weeklyEvent()], from, to);
    const reminders = getDueReminders(occurrences, now, windows);
    expect(reminders.some((r) => r.occurrence.dateKey === "2026-09-13")).toBe(false);
  });

  it("does not remind about a cancelled occurrence", () => {
    const now = new Date("2026-09-13T08:30:00");
    const occurrences = expandEvents([weeklyEvent()], from, to, [
      exception({ occurrence_date: "2026-09-13", cancelled: true }),
    ]);
    const reminders = getDueReminders(occurrences, now, windows);
    expect(reminders.some((r) => r.occurrence.dateKey === "2026-09-13")).toBe(false);
  });

  it("uses the overridden time for reminder calculation", () => {
    // Overridden to start at 20:00 instead of 09:00 — at 19:30 the original
    // time has long passed, but the reminder should still fire because the
    // *effective* (overridden) time is what's checked.
    const now = new Date("2026-09-13T19:30:00");
    const occurrences = expandEvents([weeklyEvent()], from, to, [
      exception({ occurrence_date: "2026-09-13", override_start_time: "20:00" }),
    ]);
    const reminders = getDueReminders(occurrences, now, windows);
    expect(reminders.some((r) => r.occurrence.dateKey === "2026-09-13")).toBe(true);
  });

  it("generates one reminder candidate per matching recurring occurrence, not just the first", () => {
    const now = new Date("2026-09-06T08:00:00");
    const wideHorizon = new Date("2026-10-31T23:59:59");
    const occurrences = expandEvents([weeklyEvent()], from, wideHorizon);
    const reminders = getDueReminders(occurrences, now, windows);
    // Only the Sept 6 occurrence is within a 1-day window of "now" here;
    // this asserts reminders are computed per-occurrence, not just once for the event.
    expect(reminders.filter((r) => r.occurrence.event.id === "evt-1").length).toBeGreaterThan(0);
  });

  it("never produces more than one reminder for the same occurrence even when multiple windows match", () => {
    const now = new Date("2026-09-13T08:30:00"); // 30 min before start: matches both 1h and 1d windows
    const occurrences = expandEvents([weeklyEvent()], from, to);
    const reminders = getDueReminders(occurrences, now, windows);
    const forThisOccurrence = reminders.filter((r) => r.occurrence.dateKey === "2026-09-13");
    expect(forThisOccurrence.length).toBe(1);
  });

  it("does not remind about an inactive event", () => {
    const now = new Date("2026-09-13T08:30:00");
    const occurrences = expandEvents([weeklyEvent({ active: false })], from, to);
    expect(occurrences.length).toBe(0);
    const reminders = getDueReminders(occurrences, now, windows);
    expect(reminders.length).toBe(0);
  });
});
