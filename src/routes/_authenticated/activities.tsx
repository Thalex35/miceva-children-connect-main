import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Trash2, User } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { eventsKey, useEvents } from "@/lib/queries";
import {
  describeRecurrence,
  EVENT_TYPES,
  formatTime,
  WEEKDAYS,
  type EventRow,
} from "@/lib/recurrence";
import { useAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/activities")({
  head: () => ({
    meta: [
      { title: "Activities — MICEVA Children's Department" },
      { name: "description", content: "Manage recurring prayer meetings, programs and one-time department events." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Activities — MICEVA Children's Department" },
      { property: "og:description", content: "Recurring activities and events." },
    ],
  }),
  component: ActivitiesPage,
});

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(140),
  description: z.string().trim().max(1000),
  date: z.string().trim().min(1, "Date is required"),
  startTime: z.string().trim().min(1, "Start time is required"),
  endTime: z.string().trim(),
  location: z.string().trim().max(160),
  responsible_person: z.string().trim().max(120),
  event_type: z.string(),
  recurrence: z.string(),
  recurrence_until: z.string().trim(),
});

type Values = z.infer<typeof schema>;

function toValues(event?: EventRow): Values {
  const start = event ? new Date(event.start_datetime) : null;
  const end = event?.end_datetime ? new Date(event.end_datetime) : null;
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return {
    title: event?.title ?? "",
    description: event?.description ?? "",
    date: start ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}` : "",
    startTime: start ? hhmm(start) : "",
    endTime: end ? hhmm(end) : "",
    location: event?.location ?? "",
    responsible_person: event?.responsible_person ?? "",
    event_type: event?.event_type ?? "children",
    recurrence: event?.recurrence ?? "none",
    recurrence_until: event?.recurrence_until ?? "",
  };
}

function EventDialog({ event, trigger }: { event?: EventRow; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(() => toValues(event));
  const [days, setDays] = useState<number[]>(event?.recurrence_days ?? []);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  const set = (key: keyof Values, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof Values, string>> = {};
      for (const i of parsed.error.issues) next[i.path[0] as keyof Values] = i.message;
      setErrors(next);
      return;
    }
    const v = parsed.data;
    const start = new Date(`${v.date}T${v.startTime}`);
    const end = v.endTime ? new Date(`${v.date}T${v.endTime}`) : null;
    if (end && end <= start) {
      setErrors({ endTime: "End time must be after the start time." });
      return;
    }
    setErrors({});
    setSaving(true);
    const payload = {
      title: v.title,
      description: v.description || null,
      start_datetime: start.toISOString(),
      end_datetime: end ? end.toISOString() : null,
      location: v.location || null,
      responsible_person: v.responsible_person || null,
      event_type: v.event_type,
      recurrence: v.recurrence,
      recurrence_days: v.recurrence === "weekly" || v.recurrence === "custom_weekly" ? (days.length ? days : [start.getDay()]) : null,
      recurrence_until: v.recurrence !== "none" && v.recurrence_until ? v.recurrence_until : null,
    };
    const { error } = event
      ? await supabase.from("events").update(payload).eq("id", event.id)
      : await supabase.from("events").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("The activity could not be saved.");
      return;
    }
    await logActivity({
      userId: user?.id,
      username: profile?.username,
      action: event ? "updated" : "created",
      entityType: "event",
      entityId: event?.id ?? null,
      description: `${event ? "Updated" : "Created"} activity ${payload.title}`,
    });
    await queryClient.invalidateQueries({ queryKey: eventsKey });
    toast.success(event ? "Activity updated." : "Activity created.");
    setOpen(false);
  };

  const weekly = values.recurrence === "weekly" || values.recurrence === "custom_weekly";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Edit activity" : "New activity"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="e-title">Title *</Label>
            <Input id="e-title" value={values.title} onChange={(e) => set("title", e.target.value)} />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="e-date">Date *</Label>
              <Input id="e-date" type="date" value={values.date} onChange={(e) => set("date", e.target.value)} />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-start">Start *</Label>
              <Input id="e-start" type="time" value={values.startTime} onChange={(e) => set("startTime", e.target.value)} />
              {errors.startTime && <p className="text-xs text-destructive">{errors.startTime}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-end">End</Label>
              <Input id="e-end" type="time" value={values.endTime} onChange={(e) => set("endTime", e.target.value)} />
              {errors.endTime && <p className="text-xs text-destructive">{errors.endTime}</p>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="e-loc">Location</Label>
              <Input id="e-loc" value={values.location} onChange={(e) => set("location", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-resp">Responsible person</Label>
              <Input
                id="e-resp"
                value={values.responsible_person}
                onChange={(e) => set("responsible_person", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-type">Type</Label>
              <Select value={values.event_type} onValueChange={(v) => set("event_type", v)}>
                <SelectTrigger id="e-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-rec">Repeats</Label>
              <Select value={values.recurrence} onValueChange={(v) => set("recurrence", v)}>
                <SelectTrigger id="e-rec"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">One time</SelectItem>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekly">Every week</SelectItem>
                  <SelectItem value="monthly">Every month</SelectItem>
                  <SelectItem value="custom_weekly">Selected weekdays</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {weekly && (
            <div className="space-y-2">
              <Label>Weekdays</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((label, index) => (
                  <Button
                    key={label}
                    type="button"
                    size="sm"
                    variant={days.includes(index) ? "default" : "outline"}
                    onClick={() =>
                      setDays((d) => (d.includes(index) ? d.filter((x) => x !== index) : [...d, index]))
                    }
                  >
                    {label.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {values.recurrence !== "none" && (
            <div className="space-y-2">
              <Label htmlFor="e-until">Repeat until (optional)</Label>
              <Input
                id="e-until"
                type="date"
                value={values.recurrence_until}
                onChange={(e) => set("recurrence_until", e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="e-desc">Description</Label>
            <Textarea id="e-desc" rows={3} value={values.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActivitiesPage() {
  const { data, isLoading } = useEvents();
  const { isAdmin, user, profile } = useAuth();
  const queryClient = useQueryClient();

  const toggleActive = async (event: EventRow, active: boolean) => {
    const { error } = await supabase.from("events").update({ active }).eq("id", event.id);
    if (error) {
      toast.error("The activity could not be updated.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: eventsKey });
  };

  const remove = async (event: EventRow) => {
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) {
      toast.error("This activity could not be deleted.");
      return;
    }
    await logActivity({
      userId: user?.id,
      username: profile?.username,
      action: "deleted",
      entityType: "event",
      entityId: event.id,
      description: `Deleted activity ${event.title}`,
    });
    await queryClient.invalidateQueries({ queryKey: eventsKey });
    toast.success("Activity deleted.");
  };

  const recurring = (data ?? []).filter((e) => e.recurrence !== "none");
  const oneTime = (data ?? []).filter((e) => e.recurrence === "none");

  const section = (title: string, list: EventRow[]) => (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {list.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
      {list.map((e) => (
        <Card key={e.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{e.title}</p>
                <p className="text-sm text-muted-foreground">
                  {describeRecurrence(e)} · {formatTime(new Date(e.start_datetime))}
                </p>
              </div>
              <Badge variant="outline">{e.event_type}</Badge>
            </div>
            {e.description && <p className="text-sm text-muted-foreground">{e.description}</p>}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {e.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {e.location}
                </span>
              )}
              {e.responsible_person && (
                <span className="inline-flex items-center gap-1">
                  <User className="size-3.5" /> {e.responsible_person}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={e.active} onCheckedChange={(v) => toggleActive(e, v)} aria-label="Active" />
                {e.active ? "Active" : "Paused"}
              </label>
              <EventDialog
                event={e}
                trigger={
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                }
              />
              {isAdmin && (
                <Button size="sm" variant="ghost" onClick={() => remove(e)} aria-label={`Delete ${e.title}`}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Activities</h1>
          <p className="text-sm text-muted-foreground">Recurring meetings and one-time events</p>
        </div>
        <EventDialog
          trigger={
            <Button>
              <Plus className="size-4" /> New activity
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          {section("Recurring", recurring)}
          {section("One-time events", oneTime)}
        </>
      )}
    </div>
  );
}
