import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, User } from "lucide-react";
import { useEvents } from "@/lib/queries";
import { dateKey, expandEvents, formatTime, type Occurrence } from "@/lib/recurrence";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — MICEVA Children's Department" },
      {
        name: "description",
        content: "Monthly calendar of prayer meetings, programs and department activities.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Calendar — MICEVA Children's Department" },
      { property: "og:description", content: "Department activity calendar." },
    ],
  }),
  component: CalendarPage,
});

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function CalendarPage() {
  const { data, isLoading } = useEvents();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(dateKey(today));

  const { grid, byDay } = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
    const occurrences = expandEvents(data ?? [], first, last);
    const map = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      const list = map.get(o.dateKey) ?? [];
      list.push(o);
      map.set(o.dateKey, list);
    }
    const cells: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++)
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return { grid: cells, byDay: map };
  }, [data, cursor]);

  const move = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const selectedList = byDay.get(selected) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Calendar</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => move(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium">
            {cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </span>
          <Button variant="outline" size="icon" onClick={() => move(1)} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <Card>
          <CardContent className="p-3 sm:p-5">
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {DAY_LABELS.map((d, i) => (
                <span key={i} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {grid.map((day, i) => {
                if (!day) return <span key={`e${i}`} />;
                const key = dateKey(day);
                const count = byDay.get(key)?.length ?? 0;
                const isToday = key === dateKey(today);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors hover:bg-muted",
                      isToday && "ring-1 ring-primary",
                      selected === key && "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                    aria-label={`${day.toDateString()}, ${count} activities`}
                  >
                    <span>{day.getDate()}</span>
                    {count > 0 && (
                      <span
                        className={cn(
                          "mt-0.5 size-1.5 rounded-full",
                          selected === key ? "bg-primary-foreground" : "bg-primary",
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">
          {new Date(selected + "T00:00:00").toLocaleDateString("en-GB", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </h2>
        {selectedList.length === 0 && (
          <p className="text-sm text-muted-foreground">No activity scheduled on this day.</p>
        )}
        {selectedList.map((o, i) => (
          <Card key={`${o.event.id}-${i}`}>
            <CardContent className="space-y-1 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{o.event.title}</p>
                <span className="text-sm text-muted-foreground">
                  {formatTime(o.start)}
                  {o.end ? ` – ${formatTime(o.end)}` : ""}
                </span>
              </div>
              {o.event.description && (
                <p className="text-sm text-muted-foreground">{o.event.description}</p>
              )}
              <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
                {o.event.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {o.event.location}
                  </span>
                )}
                {o.event.responsible_person && (
                  <span className="inline-flex items-center gap-1">
                    <User className="size-3.5" /> {o.event.responsible_person}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
