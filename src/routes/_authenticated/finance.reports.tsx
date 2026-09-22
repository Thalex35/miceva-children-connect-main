import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceTransactions } from "@/lib/queries";
import { buildExpenseBreakdown, formatCurrency, summarizeFinanceTransactions } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/finance/reports")({
  head: () => ({
    meta: [
      { title: "Finance Reports — MICEVA Children's Department" },
      { name: "description", content: "Monthly and date-range reporting for church finances." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Finance Reports — MICEVA Children's Department" },
      { property: "og:description", content: "Reports for church transactions." },
    ],
  }),
  component: FinanceReportsPage,
});

function exportCsv(rows: Array<Record<string, string | number>>) {
  const headers = Object.keys(rows[0] ?? {});
  const content = [headers.join(","), ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `miceva-finance-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function FinanceReportsPage() {
  const transactions = useFinanceTransactions();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const monthSummary = useMemo(() => {
    const monthTransactions = (transactions.data ?? []).filter((item) => item.date.startsWith(month));
    return summarizeFinanceTransactions(monthTransactions, new Date(`${month}-15T00:00:00Z`));
  }, [month, transactions.data]);

  const rangeSummary = useMemo(() => {
    const rangeTransactions = (transactions.data ?? []).filter((item) => {
      if (!startDate || !endDate) return true;
      return item.date >= startDate && item.date <= endDate;
    });
    return summarizeFinanceTransactions(rangeTransactions, new Date(`${endDate || new Date().toISOString().slice(0, 10)}T00:00:00Z`));
  }, [endDate, startDate, transactions.data]);

  const monthBreakdown = useMemo(() => buildExpenseBreakdown((transactions.data ?? []).filter((item) => item.date.startsWith(month)).map((item) => ({
      type: item.type,
      amount: Number(item.amount),
      category_name: item.category_name,
  }))), [month, transactions.data]);

  const rangeBreakdown = useMemo(() => buildExpenseBreakdown((transactions.data ?? []).filter((item) => item.date >= (startDate || "") && item.date <= (endDate || item.date)).map((item) => ({
      type: item.type,
      amount: Number(item.amount),
      category_name: item.category_name,
  }))), [endDate, startDate, transactions.data]);

  const exportMonth = () => {
    const rows = (transactions.data ?? []).filter((item) => item.date.startsWith(month)).map((item) => ({
      date: item.date,
      type: item.type,
      category: item.category_name ?? "Category",
      amount: Number(item.amount),
      description: item.description,
    }));
    exportCsv(rows);
  };

  if (transactions.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Finance Reports</h1>
          <p className="text-sm text-muted-foreground">Monitor church cash flow and spending</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportMonth}><Download className="size-4" /> Export CSV</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="month-report">Select month</Label>
              <Input id="month-report" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            </div>
            <div className="space-y-2 text-sm">
              <p>Total income: <span className="font-medium">{formatCurrency(monthSummary.totalIncome)}</span></p>
              <p>Total expenses: <span className="font-medium">{formatCurrency(monthSummary.totalExpenses)}</span></p>
              <p>Net balance: <span className="font-medium">{formatCurrency(monthSummary.currentBalance)}</span></p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Expense breakdown</p>
              {monthBreakdown.length === 0 && <p className="text-sm text-muted-foreground">No expenses in this month.</p>}
              {monthBreakdown.map((row) => (
                <div key={row.category} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{row.category}</span>
                  <span className="font-medium">{formatCurrency(row.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Date-range report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start date</Label>
                <Input id="start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End date</Label>
                <Input id="end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p>Total income: <span className="font-medium">{formatCurrency(rangeSummary.totalIncome)}</span></p>
              <p>Total expenses: <span className="font-medium">{formatCurrency(rangeSummary.totalExpenses)}</span></p>
              <p>Net balance: <span className="font-medium">{formatCurrency(rangeSummary.currentBalance)}</span></p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Expense categories</p>
              {rangeBreakdown.length === 0 && <p className="text-sm text-muted-foreground">No transactions in this period.</p>}
              {rangeBreakdown.map((row) => (
                <div key={row.category} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{row.category}</span>
                  <span className="font-medium">{formatCurrency(row.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {(transactions.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No financial transactions have been recorded yet.</p>}
          <div className="space-y-2">
            {(transactions.data ?? []).slice(0, 12).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
                <div className="min-w-0">
                  <p className="font-medium">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{new Date(`${tx.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · {tx.category_name ?? "Category"}</p>
                </div>
                <div className={`font-medium ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}>
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
