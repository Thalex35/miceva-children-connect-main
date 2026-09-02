import { describe, expect, it } from "bun:test";
import { getDueEventNotifications, type NotificationDraft } from "./notifications";
import { type EventRow } from "./recurrence";

function weeklyEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "evt-1",
    title: "Sunday Prayer Meeting",
    description: null,
    start_datetime: "2026-09-13T09:00:00.000Z",
    end_datetime: "2026-09-13T10:00:00.000Z",
    location: "Church",
    responsible_person: null,
    event_type: "prayer",
    recurrence: "weekly",
    recurrence_days: [0],
    recurrence_until: null,
    active: true,
    notes: null,
    ...overrides,
  };
}

describe("getDueEventNotifications", () => {
  it("creates a notification for an event due within the configured reminder window", () => {
    const now = new Date("2026-09-13T08:30:00");
    const notifications: NotificationDraft[] = getDueEventNotifications([weeklyEvent()], [], now, "user-1");

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.eventId).toBe("evt-1");
    expect(notifications[0]?.title).toBe("Upcoming event");
    expect(notifications[0]?.message).toContain("Sunday Prayer Meeting");
  });

  it("does not create duplicates for the same user and event occurrence", () => {
    const now = new Date("2026-09-13T08:30:00");
    const notifications: NotificationDraft[] = getDueEventNotifications([weeklyEvent()], [], now, "user-1");
    const deduped = Array.from(
      new Map(notifications.map((n) => [`${n.userId}:${n.eventId}:${n.scheduledFor}`, n])).values(),
    );

    expect(notifications).toHaveLength(deduped.length);
    expect(notifications).toHaveLength(1);
  });
});
