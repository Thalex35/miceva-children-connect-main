import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { formatCurrency, validateFinanceTransactionInput } from "@/lib/finance";
import { financeCategoriesKey, financeTransactionsKey, useFinanceCategories, useFinanceTransactions } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/finance/transactions")({
  head: () => ({
    meta: [
      { title: "Finance Transactions — MICEVA Children's Department" },
      { name: "description", content: "Record and manage church income and expense transactions." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Finance Transactions — MICEVA Children's Department" },
      { property: "og:description", content: "Track church income and expenses." },
    ],
  }),
  component: FinanceTransactionsPage,
});

type FormValues = {
  date: string;
  type: "income" | "expense";
  amount: string;
  currency: "HTG" | "USD";
  categoryId: string;
  description: string;
};

const expensePresetCategories = [
  { id: "lait", name: "Lait" },
  { id: "pain", name: "Pain" },
  { id: "sucre", name: "Sucre" },
  { id: "eau", name: "Eau" },
  { id: "other", name: "Autre" },
] as const;

const emptyValues = (): FormValues => ({
  date: new Date().toISOString().slice(0, 10),
  type: "income",
  amount: "",
  currency: "HTG",
  categoryId: "",
  description: "",
});

function FinanceTransactionsPage() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const categories = useFinanceCategories();
  const transactions = useFinanceTransactions();
  const [form, setForm] = useState<FormValues>(emptyValues());
  const [customExpenseCategory, setCustomExpenseCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveCategories = useMemo(
    () => (categories.data ?? []).filter((category) => category.is_active),
    [categories.data],
  );

  const expenseOptions = useMemo(() => {
    const byName = new Map((effectiveCategories ?? []).filter((category) => category.type === "expense").map((category) => [category.name.toLowerCase(), category]));
    const merged = [...expensePresetCategories.map((category) => ({ ...category, existing: byName.get(category.name.toLowerCase()) ?? null }))];

    for (const category of effectiveCategories) {
      if (category.type !== "expense") continue;
      const existing = merged.some((item) => item.name.toLowerCase() === category.name.toLowerCase());
      if (!existing) {
        merged.push({ id: category.id, name: category.name, existing: category });
      }
    }

    return merged;
  }, [effectiveCategories]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Finance access is restricted to authorized users.
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const validation = validateFinanceTransactionInput({
      date: form.date,
      type: form.type,
      amount: form.amount,
      categoryId: form.categoryId,
      description: form.description,
      categoryName: customExpenseCategory,
      currency: form.currency,
    });

    if (!validation.ok) {
      setErrorMessage(validation.error ?? "Please review your values.");
      return;
    }

    setSaving(true);

    let resolvedCategoryId = form.categoryId;

    try {
      if (form.type === "income") {
        const fallbackIncomeCategory =
          effectiveCategories.find((category) => category.type === "income" && category.name.toLowerCase() === "autre revenu") ??
          effectiveCategories.find((category) => category.type === "income") ??
          (
            await supabase
              .from("finance_categories")
              .insert({
                name: "Autre revenu",
                type: "income",
                description: "Default category for income transactions without a specific category",
                is_active: true,
                created_by: user?.id,
              })
              .select("id")
              .single()
          ).data;

        resolvedCategoryId = fallbackIncomeCategory?.id ?? "";
      } else if (form.categoryId === "other") {
        const normalizedName = customExpenseCategory.trim();
        const existingExpenseCategory = effectiveCategories.find(
          (category) => category.type === "expense" && category.name.toLowerCase() === normalizedName.toLowerCase(),
        );

        if (existingExpenseCategory) {
          resolvedCategoryId = existingExpenseCategory.id;
        } else {
          const { data: insertedCategory, error: categoryError } = await supabase
            .from("finance_categories")
            .insert({
              name: normalizedName,
              type: "expense",
              description: "Custom expense category",
              is_active: true,
              created_by: user?.id,
            })
            .select("id")
            .single();

          if (categoryError || !insertedCategory) {
            throw new Error(categoryError?.message ?? "The category could not be created.");
          }

          resolvedCategoryId = insertedCategory.id;
        }
      } else {
        const selectedCategory = expenseOptions.find((option) => option.id === form.categoryId && option.existing);
        resolvedCategoryId = selectedCategory?.existing?.id ?? form.categoryId;
      }

      const payload = {
        date: form.date,
        type: form.type,
        amount: Number(form.amount),
        currency: form.currency,
        category_id: resolvedCategoryId,
        description: form.description.trim(),
        created_by: user?.id,
      };

      const result = editingId
        ? await supabase.from("financial_transactions").update(payload).eq("id", editingId)
        : await supabase.from("financial_transactions").insert(payload);

      setSaving(false);
      if (result.error) {
        setErrorMessage(result.error.message || "The transaction could not be saved.");
        return;
      }

      await logActivity({
        userId: user?.id,
        username: profile?.username,
        action: editingId ? "updated" : "created",
        entityType: "financial_transaction",
        entityId: editingId ?? null,
        description: `${editingId ? "Updated" : "Recorded"} ${form.type} transaction for ${form.description.trim()}`,
      });

      await queryClient.invalidateQueries({ queryKey: financeTransactionsKey });
      await queryClient.invalidateQueries({ queryKey: financeCategoriesKey });
      toast.success(editingId ? "Transaction updated." : "Transaction recorded.");
      setForm(emptyValues());
      setCustomExpenseCategory("");
      setEditingId(null);
    } catch (error) {
      setSaving(false);
      setErrorMessage(error instanceof Error ? error.message : "The transaction could not be saved.");
    }
  };

  const editTransaction = (tx: (typeof transactions.data)[number]) => {
    setEditingId(tx.id);
    setForm({
      date: tx.date,
      type: tx.type,
      amount: String(tx.amount),
      currency: tx.currency ?? "HTG",
      categoryId: tx.category_id,
      description: tx.description,
    });
    setCustomExpenseCategory("");
  };

  const voidTransaction = async (transactionId: string, description: string) => {
    const { error } = await supabase
      .from("financial_transactions")
      .update({ is_voided: true, void_reason: "Voided from Finance Transactions screen" })
      .eq("id", transactionId);

    if (error) {
      toast.error("This transaction could not be voided.");
      return;
    }

    await logActivity({
      userId: user?.id,
      username: profile?.username,
      action: "voided",
      entityType: "financial_transaction",
      entityId: transactionId,
      description: `Voided transaction: ${description}`,
    });
    await queryClient.invalidateQueries({ queryKey: financeTransactionsKey });
    toast.success("Transaction voided.");
  };

  if (categories.isLoading || transactions.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-10 w-52" />
        <div className="grid gap-4 lg:grid-cols-[1.05fr_1.4fr]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="page-title">Transactions</h1>
        <p className="text-sm text-muted-foreground">Track church income and expenses</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? "Edit transaction" : "New transaction"}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="finance-date">Date</Label>
                  <Input id="finance-date" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-type">Transaction Type</Label>
                  <Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value as "income" | "expense" }))}>
                    <SelectTrigger id="finance-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                <div className="space-y-2">
                  <Label htmlFor="finance-amount">Amount</Label>
                  <Input id="finance-amount" type="number" min="1" step="1" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-currency">Currency</Label>
                  <Select value={form.currency} onValueChange={(value) => setForm((current) => ({ ...current, currency: value as "HTG" | "USD" }))}>
                    <SelectTrigger id="finance-currency">
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HTG">HTG</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.type === "expense" ? (
                <div className="space-y-2">
                  <Label htmlFor="finance-category">Category</Label>
                  <Select value={form.categoryId} onValueChange={(value) => setForm((current) => ({ ...current, categoryId: value }))}>
                    <SelectTrigger id="finance-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseOptions.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  Income transactions do not require a category.
                </div>
              )}

              {form.type === "expense" && form.categoryId === "other" && (
                <div className="space-y-2">
                  <Label htmlFor="finance-custom-category">Other expense category</Label>
                  <Input
                    id="finance-custom-category"
                    placeholder="Ex: sucre, pain, ..."
                    value={customExpenseCategory}
                    onChange={(event) => setCustomExpenseCategory(event.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="finance-description">Description</Label>
                <Textarea id="finance-description" value={form.description} rows={4} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </div>

              {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />} {editingId ? "Save changes" : "Add transaction"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyValues()); setErrorMessage(null); }}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent entries</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {(transactions.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No financial transactions have been recorded yet.</p>}
            <div className="space-y-3">
              {(transactions.data ?? []).map((tx) => (
                <div key={tx.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(`${tx.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 uppercase tracking-wide">{tx.type}</span>
                        {tx.is_voided && <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-destructive">Voided</span>}
                      </div>
                      <p className="mt-1 text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.category_name ?? "Category"}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}>
                        {tx.type === "income" ? "+" : "-"}{formatCurrency(Number(tx.amount), tx.currency ?? "HTG")}
                      </p>
                      <div className="mt-2 flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => editTransaction(tx)}>
                          <Pencil className="size-4" /> Edit
                        </Button>
                        {!tx.is_voided && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => voidTransaction(tx.id, tx.description)}>
                            <Trash2 className="size-4" /> Void
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
