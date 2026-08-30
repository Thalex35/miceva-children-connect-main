import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Phone, Plus, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { childrenKey, useChildren } from "@/lib/queries";
import {
  childAge,
  completeness,
  formatDate,
  fullName,
  isEligibleForYoungTransition,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Search = {
  completeness?: "all" | "incomplete" | "complete";
};

export const Route = createFileRoute("/_authenticated/children/")({
  head: () => ({
    meta: [
      { title: "Children — MICEVA Children's Department" },
      {
        name: "description",
        content: "Search the children's register and find guardian contacts fast.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Children — MICEVA Children's Department" },
      { property: "og:description", content: "Private children's register." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): Search =>
    search["completeness"] === "incomplete" || search["completeness"] === "complete"
      ? { completeness: search["completeness"] }
      : {},
  component: ChildrenPage,
});

function ChildrenPage() {
  const { data, isLoading, isError } = useChildren();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [term, setTerm] = useState("");
  const [gender, setGender] = useState("all");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("name");
  const completenessFilter = search.completeness ?? "all";

  const transitionCandidates = useMemo(
    () =>
      (data ?? [])
        .filter(isEligibleForYoungTransition)
        .sort((a, b) => fullName(a).localeCompare(fullName(b), "fr")),
    [data],
  );

  const moveToYoung = async (childId: string, childName: string) => {
    const { data: updated, error } = await supabase
      .from("children")
      .update({ class_group: "Young" })
      .eq("id", childId)
      .eq("class_group", "Children")
      .select("id")
      .maybeSingle();

    if (error) {
      toast.error("The child could not be moved to Young. Please try again.");
      return;
    }
    if (!updated) {
      toast.error("This child is no longer in the Children group. Refresh and try again.");
      await queryClient.invalidateQueries({ queryKey: childrenKey });
      return;
    }

    await queryClient.invalidateQueries({ queryKey: childrenKey });
    toast.success(`${childName} was moved to Young.`);
  };

  const groups = useMemo(
    () => Array.from(new Set((data ?? []).map((c) => c.class_group).filter(Boolean))) as string[],
    [data],
  );

  const rows = useMemo(() => {
    const q = normalize(term).trim();
    let list = (data ?? []).filter((c) => {
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
      if (group !== "all" && (c.class_group ?? "") !== group) return false;
      if (status !== "all" && c.status !== status) return false;
      if (completenessFilter !== "all") {
        const complete = completeness(c).complete;
        if (completenessFilter === "complete" && !complete) return false;
        if (completenessFilter === "incomplete" && complete) return false;
      }
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
  }, [data, term, gender, group, status, sort, completenessFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Children</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} of {data?.length ?? 0} children
          </p>
        </div>
        <Button asChild>
          <Link to="/children/new">
            <Plus className="size-4" /> Add child
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Children Ready for Transition</CardTitle>
          <p className="text-sm text-muted-foreground">
            Children in the Children group who are 14 or older can be moved to Young.
          </p>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {transitionCandidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No child in the Children group is currently 14 or older.
            </p>
          ) : (
            transitionCandidates.map((child) => {
              const { age, approximate } = childAge(child);
              return (
                <div
                  key={child.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <Link
                      to="/children/$childId"
                      params={{ childId: child.id }}
                      className="font-medium hover:underline"
                    >
                      {fullName(child)}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      DOB: {formatDate(child.date_of_birth)} · Age: {age}
                      {approximate ? " (approx.)" : ""} · Group: {child.class_group} · ID:{" "}
                      {child.id}
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm">Move to Young</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Move {fullName(child)} to Young?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will move the child from the Children group to the Young group. No
                          other information will be changed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => void moveToYoung(child.id, fullName(child))}
                        >
                          Move to Young
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="relative">
        <Search
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search name, guardian or phone…"
          aria-label="Search children"
          className="h-12 pl-9 text-base"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger aria-label="Class or group">
            <SelectValue placeholder="Group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
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
        <Select
          value={completenessFilter}
          onValueChange={(v) =>
            navigate({
              to: "/children",
              search:
                v === "incomplete" || v === "complete"
                  ? ({ completeness: v } as Search)
                  : ({} as Search),
            })
          }
        >
          <SelectTrigger aria-label="Profile completeness">
            <SelectValue placeholder="Profiles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All profiles</SelectItem>
            <SelectItem value="incomplete">Incomplete</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
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
          We couldn&rsquo;t load the register. Please check your connection and try again.
        </p>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <UserPlus className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">No children found.</p>
          <p className="text-sm text-muted-foreground">Try another search or add a new child.</p>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((child) => {
          const g = primaryGuardian(child.guardians);
          const { age, approximate } = childAge(child);
          const info = completeness(child);
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
                  {child.class_group ?? NOT_PROVIDED}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {g?.name ?? NOT_PROVIDED} · {g?.phone ?? NOT_PROVIDED}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {child.status !== "active" && <Badge variant="outline">Inactive</Badge>}
                  <Badge variant={info.complete ? "secondary" : "outline"}>
                    {info.complete ? "Complete" : `${info.percent}% complete`}
                  </Badge>
                  {isEligibleForYoungTransition(child) && (
                    <Badge variant="default">14+ · Ready for transition</Badge>
                  )}
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
