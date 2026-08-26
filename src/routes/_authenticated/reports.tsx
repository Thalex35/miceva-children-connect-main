import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Download, Printer } from "lucide-react";
import { useAdminMembers, useChildren } from "@/lib/queries";
import { childAge, completeness, fullName, primaryGuardian } from "@/lib/children";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — MICEVA Children's Department" },
      { name: "description", content: "Statistics and exportable reports for the children's register." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Reports — MICEVA Children's Department" },
      { property: "og:description", content: "Department statistics and exports." },
    ],
  }),
  component: ReportsPage,
});

function csvCell(value: string | number | null | undefined) {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function download(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const children = useChildren();
  const members = useAdminMembers();

  const stats = useMemo(() => {
    const list = children.data ?? [];
    const girls = list.filter((c) => c.gender === "F").length;
    const boys = list.filter((c) => c.gender === "M").length;
    const buckets = { "0-5": 0, "6-9": 0, "10-12": 0, "13+": 0, Unknown: 0 } as Record<string, number>;
    for (const c of list) {
      const { age } = childAge(c);
      if (age === null) buckets["Unknown"]!++;
      else if (age <= 5) buckets["0-5"]!++;
      else if (age <= 9) buckets["6-9"]!++;
      else if (age <= 12) buckets["10-12"]!++;
      else buckets["13+"]!++;
    }
    const groups = new Map<string, number>();
    for (const c of list) {
      const key = c.class_group ?? "No group";
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    const complete = list.filter((c) => completeness(c).complete).length;
    const withPhone = list.filter((c) => Boolean(primaryGuardian(c.guardians)?.phone)).length;
    return { total: list.length, girls, boys, buckets, groups, complete, withPhone };
  }, [children.data]);

  const exportChildren = () => {
    const header = [
      "Last name",
      "First name",
      "Date of birth",
      "Age",
      "Gender",
      "Guardian",
      "Phone",
      "Address",
      "Class/group",
      "Status",
      "Completeness %",
    ];
    const rows = (children.data ?? []).map((c) => {
      const g = primaryGuardian(c.guardians);
      const { age } = childAge(c);
      return [
        c.last_name,
        c.first_name,
        c.date_of_birth ?? "",
        age ?? "",
        c.gender ?? "",
        g?.name ?? "",
        g?.phone ?? "",
        c.address ?? "",
        c.class_group ?? "",
        c.status,
        completeness(c).percent,
      ]
        .map(csvCell)
        .join(",");
    });
    download(`miceva-children-${new Date().toISOString().slice(0, 10)}.csv`, [header.map(csvCell).join(","), ...rows].join("\n"));
  };

  const exportMembers = () => {
    const header = ["Name", "Role", "Phone", "Email", "Responsibilities", "Active"];
    const rows = (members.data ?? []).map((m) =>
      [m.name, m.role ?? "", m.phone ?? "", m.email ?? "", m.responsibilities ?? "", m.active ? "Yes" : "No"]
        .map(csvCell)
        .join(","),
    );
    download(`miceva-administration-${new Date().toISOString().slice(0, 10)}.csv`, [header.map(csvCell).join(","), ...rows].join("\n"));
  };

  if (children.isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-sm text-muted-foreground">Statistics and exports for the department</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportChildren}>
            <Download className="size-4" /> Children CSV
          </Button>
          <Button variant="outline" onClick={exportMembers}>
            <Download className="size-4" /> Committee CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Print / PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0 text-sm">
            <p>Total children: <span className="font-medium">{stats.total}</span></p>
            <p>Girls: <span className="font-medium">{stats.girls}</span> · Boys: <span className="font-medium">{stats.boys}</span></p>
            <p>Complete profiles: <span className="font-medium">{stats.complete}</span> / {stats.total}</p>
            <p>With a guardian phone: <span className="font-medium">{stats.withPhone}</span></p>
            <p>Committee members: <span className="font-medium">{members.data?.length ?? 0}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Age distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {Object.entries(stats.buckets).map(([label, count]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-16 text-sm text-muted-foreground">{label}</span>
                <div className="h-2 flex-1 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${stats.total ? (count / stats.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-6 text-right text-sm font-medium">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">By class / group</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 pt-0 sm:grid-cols-2">
            {[...stats.groups.entries()].map(([label, count]) => (
              <div key={label} className="flex justify-between border-b border-border py-1.5 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Register</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto pt-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2">Name</th>
                  <th className="py-2">Age</th>
                  <th className="py-2">Guardian</th>
                  <th className="py-2">Phone</th>
                </tr>
              </thead>
              <tbody>
                {(children.data ?? []).map((c) => {
                  const g = primaryGuardian(c.guardians);
                  const { age } = childAge(c);
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="py-2">{fullName(c)}</td>
                      <td className="py-2">{age ?? "—"}</td>
                      <td className="py-2">{g?.name ?? "—"}</td>
                      <td className="py-2">{g?.phone ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
