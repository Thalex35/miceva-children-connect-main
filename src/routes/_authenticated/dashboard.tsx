import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, Repeat, UsersRound, Users } from "lucide-react";
import { useChildren, useEvents, useAdminMembers } from "@/lib/queries";
import { completeness, fullName } from "@/lib/children";
import { describeRecurrence, expandEvents, formatTime } from "@/lib/recurrence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MICEVA Children's Department" },
      {
        name: "description",
        content: "Department overview: children, profiles, events and activities.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Dashboard — MICEVA Children's Department" },
      { property: "og:description", content: "Private department overview." },
    ],
  }),
  component: DashboardPage,
});

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  to,
  search,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  to?: string;
  search?: Record<string, string>;
  tone?: "default" | "warning";
}) {
  const body = (
    <Card className="h-full transition-shadow hover:shadow-[var(--shadow-card)]">
      <CardContent className="flex items-start gap-3 p-5">
        <span
          className={
            tone === "warning"
              ? "flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning"
              : "flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          }
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold">{value}</p>
          {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
  return to ? (
    <Link to={to} search={search as never} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function DashboardPage() {
  const { profile } = useAuth();
  const children = useChildren();
  const events = useEvents();
  const members = useAdminMembers();

  const loading = children.isLoading || events.isLoading || members.isLoading;

  const incomplete = (children.data ?? []).filter((c) => !completeness(c).complete);
  const now = new Date();
  const horizon = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 60);
  const occurrences = expandEvents(events.data ?? [], now, horizon);
  const nextEvent = occurrences.find((o) => o.event.recurrence === "none");
  const nextRecurring = occurrences.find((o) => o.event.recurrence !== "none");

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="page-title">Bonjour, {profile?.display_name ?? profile?.username}</h1>
        <p className="text-sm text-muted-foreground">
          Église MICEVA de Puits-Salés — Département des Enfants
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Children"
          value={String(children.data?.length ?? 0)}
          hint="Registered in 2026"
          icon={Users}
          to="/children"
        />
        <StatCard
          label="Incomplete profiles"
          value={String(incomplete.length)}
          hint="Tap to complete missing information"
          icon={AlertTriangle}
          tone="warning"
          to="/children"
          search={{ completeness: "incomplete" }}
        />
        <StatCard
          label="Administration"
          value={String((members.data ?? []).filter((m) => m.active).length)}
          hint="Committee members"
          icon={UsersRound}
          to="/administration"
        />
        <StatCard
          label="Next activity"
          value={nextRecurring ? nextRecurring.event.title : "None"}
          hint={
            nextRecurring
              ? `${describeRecurrence(nextRecurring.event)} · ${formatTime(nextRecurring.start)}`
              : "No recurring activity"
          }
          icon={Repeat}
          to="/activities"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-primary" aria-hidden /> Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {occurrences.length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming events.</p>
            )}
            {occurrences.slice(0, 6).map((o, i) => (
              <div key={`${o.event.id}-${i}`} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{o.event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.start.toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                    })}{" "}
                    · {formatTime(o.start)}
                    {o.event.location ? ` · ${o.event.location}` : ""}
                  </p>
                </div>
              </div>
            ))}
            {nextEvent && (
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                Next one-time event: <span className="font-medium">{nextEvent.event.title}</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" aria-hidden /> Profiles needing
              information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {incomplete.length === 0 && (
              <p className="text-sm text-muted-foreground">All profiles are complete.</p>
            )}
            {incomplete.slice(0, 6).map((c) => {
              const info = completeness(c);
              return (
                <Link
                  key={c.id}
                  to="/children/$childId"
                  params={{ childId: c.id }}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted"
                >
                  <span className="truncate text-sm font-medium">{fullName(c)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {info.percent}% complete
                  </span>
                </Link>
              );
            })}
            {incomplete.length > 6 && (
              <Link
                to="/children"
                search={{ completeness: "incomplete" } as never}
                className="block pt-2 text-sm font-medium text-primary"
              >
                View all {incomplete.length}
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
