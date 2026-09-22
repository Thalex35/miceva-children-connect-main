import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Pencil, Power, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { financeCategoriesKey, useFinanceCategories, useFinanceTransactions } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/finance/categories")({
  head: () => ({
    meta: [
      { title: "Finance Categories — MICEVA Children's Department" },
      { name: "description", content: "Configure categories for church income and expenses." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Finance Categories — MICEVA Children's Department" },
      { property: "og:description", content: "Track and manage finance categories." },
    ],
  }),
  component: FinanceCategoriesPage,
});

function FinanceCategoriesPage() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const categories = useFinanceCategories();
  const transactions = useFinanceTransactions();

  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("income");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Finance categories are restricted to authorized users.</CardContent>
        </Card>
      </div>
    );
  }

  const usedCategoryIds = new Set((transactions.data ?? []).filter((tx) => !tx.is_voided).map((tx) => tx.category_id));

  const saveCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Category name is required.");
      return;
    }
    setSaving(true);
    const payload = { name: name.trim(), type, description: description.trim() || null, is_active: true, created_by: user?.id };
    const { error } = editingId
      ? await supabase.from("finance_categories").update(payload).eq("id", editingId)
      : await supabase.from("finance_categories").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("The category could not be saved.");
      return;
    }
    await logActivity({
      userId: user?.id,
      username: profile?.username,
      action: editingId ? "updated" : "created",
      entityType: "finance_category",
      entityId: editingId ?? null,
      description: `${editingId ? "Updated finance category" : "Created finance category"}: ${name.trim()}`,
    });
    await queryClient.invalidateQueries({ queryKey: financeCategoriesKey });
    toast.success(editingId ? "Category updated." : "Category created.");
    setName("");
    setType("income");
    setDescription("");
    setEditingId(null);
  };

  const toggleCategory = async (categoryId: string, categoryName: string, isActive: boolean) => {
    const { error } = await supabase.from("finance_categories").update({ is_active: !isActive }).eq("id", categoryId);
    if (error) {
      toast.error("The category state could not be updated.");
      return;
    }
    await logActivity({
      userId: user?.id,
      username: profile?.username,
      action: "updated",
      entityType: "finance_category",
      entityId: categoryId,
      description: `${isActive ? "Disabled" : "Enabled"} finance category ${categoryName}`,
    });
    await queryClient.invalidateQueries({ queryKey: financeCategoriesKey });
    toast.success(`${categoryName} ${isActive ? "disabled" : "enabled"}.`);
  };

  const editCategory = (category: (typeof categories.data)[number]) => {
    setEditingId(category.id);
    setName(category.name);
    setType(category.type);
    setDescription(category.description ?? "");
  };

  if (categories.isLoading || transactions.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-10 w-52" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Categories</h1>
        <p className="text-sm text-muted-foreground">Default ministry and church spending categories</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? "Edit category" : "Add category"}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={saveCategory} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">Name</Label>
                <Input id="category-name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-type">Type</Label>
                <Select value={type} onValueChange={(value) => setType(value as "income" | "expense")}>
                  <SelectTrigger id="category-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-description">Description</Label>
                <Input id="category-description" value={description} onChange={(event) => setDescription(event.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />} {editingId ? "Save changes" : "Add category"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={() => { setEditingId(null); setName(""); setType("income"); setDescription(""); }}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Available categories</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {(categories.data ?? []).map((category) => {
                const isInUse = usedCategoryIds.has(category.id);
                return (
                  <div key={category.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{category.name}</p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{category.type}</span>
                        {!category.is_active && <span className="rounded-full border border-muted-foreground/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Inactive</span>}
                      </div>
                      {category.description && <p className="text-xs text-muted-foreground">{category.description}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => editCategory(category)}><Pencil className="size-4" /> Edit</Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => void toggleCategory(category.id, category.name, category.is_active)} disabled={isInUse && category.is_active}>
                        <Power className="size-4" /> {category.is_active ? "Disable" : "Enable"}
                      </Button>
                      {isInUse && <span className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldAlert className="size-3.5" /> In use</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
