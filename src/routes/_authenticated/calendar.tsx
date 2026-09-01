import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MoreVertical,
  Pencil,
  RotateCcw,
  User,
} from "lucide-react";
import { eventExceptionsKey, useEventExceptions, useEvents } from "@/lib/queries";
import { cancelOccurrence, restoreOccurrence, saveOccurrenceOverride } from "@/lib/eventExceptions";
import { dateKey, expandEvents, formatTime, type Occurrence } from "@/lib/recurrence";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      { property: "og:description", content: "Private department activity calendar." },
    ],
  }),
  component: CalendarPage,
});

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function toTimeInput(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function CalendarPage() {
  const { data, isLoading } = useEvents();
  const { data: exceptions } = useEventExceptions();
  const queryClient = useQueryClient();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(dateKey(today));

  const [cancelTarget, setCancelTarget] = useState<Occurrence | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Occurrence | null>(null);
  const [editTarget, setEditTarget] = useState<Occurrence | null>(null);
  const [saving, setSaving] = useState(false);

  const { grid, byDay } = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
    const occurrences = expandEvents(data ?? [], first, last, exceptions ?? []);
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
  }, [data, exceptions, cursor]);

  const move = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const selectedList = byDay.get(selected) ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: eventExceptionsKey });

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelOccurrence(cancelTarget.event.id, cancelTarget.dateKey);
      await refresh();
      toast.success(`${cancelTarget.title} was cancelled for this date only.`);
    } catch {
      toast.error("Could not cancel this occurrence. Please try again.");
    } finally {
      setCancelTarget(null);
    }
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    try {
      await restoreOccurrence(restoreTarget.event.id, restoreTarget.dateKey);
      await refresh();
      toast.success(`${restoreTarget.event.title} was restored to the normal schedule.`);
    } catch {
      toast.error("Could not restore this occurrence. Please try again.");
    } finally {
      setRestoreTarget(null);
    }
  };

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
                const dayOccurrences = byDay.get(key) ?? [];
                const count = dayOccurrences.filter((o) => !o.cancelled).length;
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
          <Card key={`${o.event.id}-${i}`} className={cn(o.cancelled && "opacity-60")}>
            <CardContent className="space-y-1 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <p className={cn("truncate font-medium", o.cancelled && "line-through")}>
                    {o.title}
                  </p>
                  {o.cancelled && <Badge variant="outline">Cancelled</Badge>}
                  {!o.cancelled && o.overridden && <Badge variant="secondary">Modified</Badge>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-sm text-muted-foreground">
                    {formatTime(o.start)}
                    {o.end ? ` – ${formatTime(o.end)}` : ""}
                  </span>
                  {o.event.recurrence !== "none" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Options for ${o.title} on this date`}
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {o.cancelled ? (
                          <DropdownMenuItem onClick={() => setRestoreTarget(o)}>
                            <RotateCcw className="size-4" /> Restore occurrence
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => setEditTarget(o)}>
                              <Pencil className="size-4" /> Edit this occurrence
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setCancelTarget(o)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Ban className="size-4" /> Cancel this occurrence
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              {o.event.description && (
                <p className="text-sm text-muted-foreground">{o.event.description}</p>
              )}
              <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
                {o.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {o.location}
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

      {/* Cancel confirmation — this occurrence only, never the whole series */}
      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this occurrence?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (
                <>
                  This will cancel <strong>{cancelTarget.title}</strong> on{" "}
                  {cancelTarget.start.toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })}{" "}
                  only. Every other occurrence of this recurring activity stays scheduled as normal,
                  and you can restore this one later.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmCancel()}>
              Cancel this date
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore confirmation */}
      <AlertDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this occurrence?</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreTarget && (
                <>
                  {restoreTarget.event.title} on{" "}
                  {restoreTarget.start.toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })}{" "}
                  will return to the normal recurring schedule.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Never mind</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmRestore()}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit-this-occurrence dialog — overrides one date only, never the parent event */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          {editTarget && (
            <EditOccurrenceForm
              occurrence={editTarget}
              saving={saving}
              onCancel={() => setEditTarget(null)}
              onSave={async (values) => {
                setSaving(true);
                try {
                  await saveOccurrenceOverride(editTarget.event.id, editTarget.dateKey, values);
                  await refresh();
                  toast.success(`This occurrence of ${editTarget.event.title} was updated.`);
                  setEditTarget(null);
                } catch {
                  toast.error("Could not save this occurrence. Please try again.");
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditOccurrenceForm({
  occurrence,
  saving,
  onCancel,
  onSave,
}: {
  occurrence: Occurrence;
  saving: boolean;
  onCancel: () => void;
  onSave: (values: {
    title: string | null;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
    notes: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState(
    occurrence.exception?.override_title ?? occurrence.event.title,
  );
  const [startTime, setStartTime] = useState(toTimeInput(occurrence.start));
  const [endTime, setEndTime] = useState(occurrence.end ? toTimeInput(occurrence.end) : "");
  const [location, setLocation] = useState(occurrence.location ?? "");
  const [notes, setNotes] = useState(occurrence.exception?.notes ?? "");

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit this occurrence</DialogTitle>
        <DialogDescription>
          Changes apply only to{" "}
          {occurrence.start.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          })}
          . The recurring series and every other date are unaffected.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="occ-title">Title</Label>
          <Input id="occ-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="occ-start">Start time</Label>
            <Input
              id="occ-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="occ-end">End time</Label>
            <Input
              id="occ-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="occ-location">Location</Label>
          <Input id="occ-location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="occ-notes">Notes</Label>
          <Textarea
            id="occ-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={() =>
            onSave({
              title: title.trim() && title.trim() !== occurrence.event.title ? title.trim() : null,
              startTime: startTime || null,
              endTime: endTime || null,
              location:
                location.trim() && location.trim() !== (occurrence.event.location ?? "")
                  ? location.trim()
                  : null,
              notes: notes.trim() || null,
            })
          }
          disabled={saving}
        >
          {saving ? "Saving…" : "Save this occurrence"}
        </Button>
      </DialogFooter>
    </>
  );
}
