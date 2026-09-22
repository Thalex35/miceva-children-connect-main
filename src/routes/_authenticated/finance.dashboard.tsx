import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, BadgeDollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceCategories, useFinanceTransactions } from "@/lib/queries";
import { buildExpenseBreakdown, formatCurrency, summarizeFinanceTransactions } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/finance/dashboard")({
  head: () => ({
    meta: [
      { title: "Finance Dashboard — MICEVA Children's Department" },
      { name: "description", content: "Church finances overview and recent transactions." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Finance Dashboard — MICEVA Children's Department" },
      { property: "og:description", content: "Current balance and monthly summaries." },
    ],
  }),
  component: FinanceDashboardPage,
});

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof ArrowUpRight;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FinanceDashboardPage() {
  const categories = useFinanceCategories();
  const transactions = useFinanceTransactions(20);

  const summary = useMemo(() => summarizeFinanceTransactions(transactions.data ?? []), [transactions.data]);
  const expenseBreakdown = useMemo(
    () =>
      buildExpenseBreakdown(
        (transactions.data ?? []).map((t) => ({
          type: t.type,
          amount: Number(t.amount),
          category_name: t.category_name ?? t.category_id,
        })),
      ),
    [transactions.data],
  );

  if (categories.isLoading || transactions.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      </div>
    );
  }

  const totalTransactions = transactions.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Finance Dashboard</h1>
          <p className="text-sm text-muted-foreground">Current church balance and recent activity</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/finance/transactions" className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Transactions</Link>
          <Link to="/finance/reports" className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm">Reports</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current Balance" value={formatCurrency(summary.currentBalance)} hint="All recorded transactions" icon={BadgeDollarSign} />
        <StatCard label="Income This Month" value={formatCurrency(summary.currentMonth.income)} hint="Current month" icon={ArrowUpRight} />
        <StatCard label="Expenses This Month" value={formatCurrency(summary.currentMonth.expenses)} hint="Current month" icon={ArrowDownRight} />
        <StatCard label="Net This Month" value={formatCurrency(summary.currentMonth.net)} hint="Income minus expenses" icon={TrendingUp} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">This Year</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border py-2">
              <span className="text-muted-foreground">Income</span>
              <span className="font-medium text-green-600">{formatCurrency(summary.currentYear.income)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border py-2">
              <span className="text-muted-foreground">Expenses</span>
              <span className="font-medium text-red-600">{formatCurrency(summary.currentYear.expenses)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-muted-foreground">Net</span>
              <span className="font-medium">{formatCurrency(summary.currentYear.net)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {expenseBreakdown.length === 0 && <p className="text-sm text-muted-foreground">No expense records yet.</p>}
            {expenseBreakdown.map((row) => {
              const max = Math.max(...expenseBreakdown.map((item) => item.total), 1);
              const width = (row.total / max) * 100;
              return (
                <div key={row.category} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{row.category}</span>
                    <span className="font-medium">{formatCurrency(row.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {totalTransactions.length === 0 && <p className="text-sm text-muted-foreground">No financial transactions have been recorded yet.</p>}
          <div className="space-y-3">
            {totalTransactions.slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex flex-col gap-1 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{new Date(`${tx.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{tx.type}</span>
                    <span className="text-xs text-muted-foreground">{tx.category_name ?? "Category"}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{tx.description}</p>
                </div>
                <div className={`text-right font-semibold ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}>
                  {tx.type === "income" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
