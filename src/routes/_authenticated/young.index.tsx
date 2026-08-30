import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useChildren } from "@/lib/queries";
import {
  childAge,
  formatDate,
  fullName,
  isYoungMember,
  NOT_PROVIDED,
  normalize,
  primaryGuardian,
  telHref,
} from "@/lib/children";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/young/")({
  head: () => ({
    meta: [
      { title: "Young — MICEVA Children's Department" },
      {
        name: "description",
        content: "Members who have transitioned from the Children department to Young.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Young — MICEVA Children's Department" },
      { property: "og:description", content: "Private Young member register." },
    ],
  }),
  component: YoungPage,
});

function YoungPage() {
  const { data, isLoading, isError } = useChildren();
  const [term, setTerm] = useState("");
  const [gender, setGender] = useState("all");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("name");

  // Young members are the same underlying child records — this page only
  // ever filters the existing `children` data by class_group; it never
  // creates or reads a separate person/record for anyone.
  const youngMembers = useMemo(() => (data ?? []).filter(isYoungMember), [data]);

  const rows = useMemo(() => {
    const q = normalize(term).trim();
    let list = youngMembers.filter((c) => {
      const g = primaryGuardian(c.guardians);
      if (q) {
        const haystack = [
          c.first_name,
          c.last_name,
          `${c.last_name} ${c.first_name}`,
          `${c.first_name} ${c.last_name}`,
          g?.name,
          g?.phone,
          ...c.guardians.map((x) => x.name ?? ""),
          ...c.guardians.map((x) => x.phone ?? ""),
        ]
          .map(normalize)
          .join(" ");
        if (
          !haystack.includes(q) &&
          !(g?.phone ?? "").replace(/\s/g, "").includes(term.replace(/\s/g, ""))
        )
          return false;
      }
      if (gender !== "all" && (c.gender ?? "") !== gender) return false;
      if (status !== "all" && c.status !== status) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "age") {
        const aa = childAge(a).age ?? 999;
        const bb = childAge(b).age ?? 999;
        return aa - bb;
      }
      if (sort === "registration") {
        return (b.registration_date ?? b.created_at).localeCompare(
          a.registration_date ?? a.created_at,
        );
      }
      return fullName(a).localeCompare(fullName(b), "fr");
    });
    return list;
  }, [youngMembers, term, gender, status, sort]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Young</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} of {youngMembers.length} Young members
          </p>
        </div>
      </div>

      <div className="relative">
        <Search
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search name, guardian or phone…"
          aria-label="Search Young members"
          className="h-12 pl-9 text-base"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger aria-label="Gender">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All genders</SelectItem>
            <SelectItem value="F">Girls</SelectItem>
            <SelectItem value="M">Boys</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger aria-label="Sort by">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="age">Sort: Age</SelectItem>
            <SelectItem value="registration">Sort: Registration</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          We couldn&rsquo;t load the Young register. Please check your connection and try again.
        </p>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <UsersRound className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">No Young members found.</p>
          <p className="text-sm text-muted-foreground">
            Move a child 14 or older to Young from the Children page, or try another search.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((child) => {
          const g = primaryGuardian(child.guardians);
          const { age, approximate } = childAge(child);
          return (
            <div
              key={child.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-(--shadow-card)"
            >
              <Link
                to="/children/$childId"
                params={{ childId: child.id }}
                className="min-w-0 flex-1"
              >
                <p className="truncate font-medium">{fullName(child)}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {age !== null
                    ? `${age} yrs${approximate ? " (approx.)" : ""}`
                    : "Age not provided"}
                  {" · "}
                  {child.gender === "F" ? "Girl" : child.gender === "M" ? "Boy" : NOT_PROVIDED}
                  {" · Registered "}
                  {formatDate(child.registration_date)}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {g?.name ?? NOT_PROVIDED} · {g?.phone ?? NOT_PROVIDED}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {child.status !== "active" && <Badge variant="outline">Inactive</Badge>}
                  <Badge variant="secondary">Young</Badge>
                </div>
              </Link>
              {g?.phone && (
                <Button
                  asChild
                  size="icon"
                  variant="secondary"
                  aria-label={`Call ${g.name ?? "guardian"}`}
                >
                  <a href={telHref(g.phone)}>
                    <Phone className="size-4" />
                  </a>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
