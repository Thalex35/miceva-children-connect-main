import { createFileRoute, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useChildren } from "@/lib/queries";
import { fullName } from "@/lib/children";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";

type Search = {
  month?: string;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getMonthNumber(input: string | undefined): number {
  if (!input) {
    return new Date().getMonth();
  }
  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 11) {
    return new Date().getMonth();
  }
  return parsed;
}

function getYearForCalculation(currentMonth: number, birthdayMonth: number): number {
  const now = new Date();
  // If the birthday month is before current month, it already passed this year,
  // so the age is calculated for next year
  if (birthdayMonth < currentMonth) {
    return now.getFullYear() + 1;
  }
  return now.getFullYear();
}

export const Route = createFileRoute("/_authenticated/anniversaries")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Birthdays — MICEVA Children's Department" },
      {
        name: "description",
        content: "View children's birthdays by month.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Birthdays — MICEVA Children's Department" },
      { property: "og:description", content: "Children's birthday calendar." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): Search => {
    return {
      month: typeof search.month === "string" ? search.month : undefined,
    };
  },
  component: AnniversariesPage,
});

function AnniversariesPage() {
  const { data, isLoading, isError } = useChildren();
  const search = Route.useSearch();
  const { useNavigate } = Route.useRouterContext();
  const navigate = useNavigate();

  const currentMonthIndex = getMonthNumber(search.month);
  const currentMonth = MONTHS[currentMonthIndex] || "Unknown";

  const birthdaysThisMonth = useMemo(() => {
    if (!data) return [];

    const birthdays = data
      .filter((child) => {
        if (!child.date_of_birth) return false;
        const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(child.date_of_birth);
        if (!parts) return false;
        const birthMonth = Number(parts[2]);
        return birthMonth === currentMonthIndex + 1;
      })
      .map((child) => {
        const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(child.date_of_birth)!;
        const birthYear = Number(parts[1]);
        const birthDay = Number(parts[3]);
        const ageThisYear = getYearForCalculation(currentMonthIndex, Number(parts[2]) - 1) - birthYear;

        return {
          child,
          day: birthDay,
          age: ageThisYear,
        };
      })
      .sort((a, b) => a.day - b.day);

    return birthdays;
  }, [data, currentMonthIndex]);

  const handlePreviousMonth = () => {
    const newMonth = (currentMonthIndex - 1 + 12) % 12;
    navigate({ search: { month: String(newMonth) } });
  };

  const handleNextMonth = () => {
    const newMonth = (currentMonthIndex + 1) % 12;
    navigate({ search: { month: String(newMonth) } });
  };

  const handleResetToToday = () => {
    navigate({ search: {} });
  };

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">Failed to load children's data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with month navigation */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Birthdays</h1>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePreviousMonth}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="min-w-40 text-center">
              <h2 className="text-lg font-semibold">{currentMonth}</h2>
              <p className="text-xs text-muted-foreground">{MONTHS.length} months in year</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {getMonthNumber(search.month) !== new Date().getMonth() && (
            <Button variant="secondary" size="sm" onClick={handleResetToToday}>
              Back to today
            </Button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && birthdaysThisMonth.length === 0 && (
        <div className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/25 p-8 text-center">
          <p className="text-sm text-muted-foreground">No birthdays this month.</p>
        </div>
      )}

      {/* Birthday list */}
      {!isLoading && birthdaysThisMonth.length > 0 && (
        <div className="space-y-3">
          {birthdaysThisMonth.map(({ child, day, age }) => (
            <Link
              key={child.id}
              to={`/children/${child.id}`}
              className="flex items-start gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-center">
                  <span className="text-sm font-semibold text-primary">{day}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{fullName(child)}</h3>
                <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>Turns {age}</span>
                  {child.class_group && <span>•</span>}
                  {child.class_group && <span className="capitalize">{child.class_group}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
