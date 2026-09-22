export type FinanceTransactionType = "income" | "expense";
export type FinanceCategoryType = "income" | "expense";
export type FinanceCurrency = "HTG" | "USD";

export type FinanceSummaryInput = {
  date: string;
  type: FinanceTransactionType;
  amount: number;
  currency?: FinanceCurrency;
};

export type FinanceCategory = {
  id: string;
  name: string;
  type: FinanceCategoryType;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FinanceTransaction = {
  id: string;
  date: string;
  type: FinanceTransactionType;
  amount: number;
  currency?: FinanceCurrency;
  category_id: string;
  description: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_voided?: boolean;
  void_reason?: string | null;
  category_name?: string | null;
};

export type FinanceSummary = {
  totalIncome: number;
  totalExpenses: number;
  currentBalance: number;
  currentMonth: { income: number; expenses: number; net: number };
  currentYear: { income: number; expenses: number; net: number };
  previousMonth: { income: number; expenses: number; net: number };
};

export const defaultFinanceCategories = {
  income: [
    "Offering",
    "Tithe",
    "Donation",
    "Fundraising",
    "Other Income",
  ],
  expense: [
    "Bread",
    "Food",
    "Water",
    "Electricity",
    "Transportation",
    "Church Supplies",
    "Children's Ministry",
    "Maintenance",
    "Events",
    "Other Expense",
  ],
} as const;

export function calculateNetBalance({ income, expenses }: { income: number; expenses: number }) {
  return income - expenses;
}

function toDateKeyString(value: string | Date): string {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
      .toISOString()
      .slice(0, 10);
  }
  return value.slice(0, 10);
}

function isSameMonth(value: string | Date, reference: Date) {
  const d = value instanceof Date ? value : new Date(`${toDateKeyString(value)}T00:00:00Z`);
  return d.getUTCFullYear() === reference.getUTCFullYear() && d.getUTCMonth() === reference.getUTCMonth();
}

function isSameYear(value: string | Date, reference: Date) {
  const d = value instanceof Date ? value : new Date(`${toDateKeyString(value)}T00:00:00Z`);
  return d.getUTCFullYear() === reference.getUTCFullYear();
}

function getMonthStart(reference: Date) {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
}

function getMonthEnd(reference: Date) {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0));
}

function getPreviousMonth(reference: Date) {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 1));
}

export function summarizeFinanceTransactions(
  transactions: FinanceSummaryInput[],
  referenceDate = new Date(),
): FinanceSummary {
  const totals = { income: 0, expenses: 0 };
  const currentMonth = { income: 0, expenses: 0 };
  const currentYear = { income: 0, expenses: 0 };
  const previousMonth = { income: 0, expenses: 0 };

  for (const entry of transactions) {
    const amount = Number(entry.amount) || 0;
    if (!Number.isFinite(amount)) continue;
    const date = toDateKeyString(entry.date);
    if (entry.type === "income") {
      totals.income += amount;
      if (isSameMonth(date, referenceDate)) currentMonth.income += amount;
      if (isSameYear(date, referenceDate)) currentYear.income += amount;
      if (isSameMonth(date, getPreviousMonth(referenceDate))) previousMonth.income += amount;
    }
    if (entry.type === "expense") {
      totals.expenses += amount;
      if (isSameMonth(date, referenceDate)) currentMonth.expenses += amount;
      if (isSameYear(date, referenceDate)) currentYear.expenses += amount;
      if (isSameMonth(date, getPreviousMonth(referenceDate))) previousMonth.expenses += amount;
    }
  }

  return {
    totalIncome: totals.income,
    totalExpenses: totals.expenses,
    currentBalance: calculateNetBalance({ income: totals.income, expenses: totals.expenses }),
    currentMonth: {
      income: currentMonth.income,
      expenses: currentMonth.expenses,
      net: calculateNetBalance({ income: currentMonth.income, expenses: currentMonth.expenses }),
    },
    currentYear: {
      income: currentYear.income,
      expenses: currentYear.expenses,
      net: calculateNetBalance({ income: currentYear.income, expenses: currentYear.expenses }),
    },
    previousMonth: {
      income: previousMonth.income,
      expenses: previousMonth.expenses,
      net: calculateNetBalance({ income: previousMonth.income, expenses: previousMonth.expenses }),
    },
  };
}

export function formatCurrency(value: number, currency: FinanceCurrency = "HTG") {
  const safe = Number.isFinite(value) ? value : 0;
  const absolute = Math.abs(safe);
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(absolute);
  const sign = safe < 0 ? "-" : "";
  return `${sign}${formatted} ${currency}`;
}

export function validateFinanceTransactionInput(input: {
  date: string;
  type: string;
  amount: number | string;
  categoryId: string;
  description: string;
  categoryName?: string;
  currency?: string;
}) {
  const trimmedDate = (input.date ?? "").trim();
  const trimmedDescription = (input.description ?? "").trim();
  const amount = Number(input.amount);
  const type = (input.type ?? "").trim().toLowerCase();
  const customCategoryName = (input.categoryName ?? "").trim();
  const currency = (input.currency ?? "HTG").trim().toUpperCase();

  if (!trimmedDate || Number.isNaN(new Date(`${trimmedDate}T00:00:00Z`).getTime())) {
    return { ok: false, error: "A valid date is required." } as const;
  }

  if (!/^(income|expense)$/.test(type)) {
    return { ok: false, error: "Transaction type must be income or expense." } as const;
  }

  if (!/^(HTG|USD)$/.test(currency)) {
    return { ok: false, error: "Currency must be HTG or USD." } as const;
  }

  if (type === "income") {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "Amount must be greater than zero." } as const;
    }

    if (trimmedDescription.length === 0) {
      return { ok: false, error: "Description is required." } as const;
    }

    return { ok: true } as const;
  }

  if (!input.categoryId || input.categoryId.trim() === "") {
    return { ok: false, error: "Please select a category." } as const;
  }

  if (input.categoryId === "other" && customCategoryName.length === 0) {
    return { ok: false, error: "Please specify the other expense category." } as const;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Amount must be greater than zero." } as const;
  }

  if (trimmedDescription.length === 0) {
    return { ok: false, error: "Description is required." } as const;
  }

  return { ok: true } as const;
}

export function buildExpenseBreakdown(
  transactions: Array<{ type: FinanceTransactionType; amount: number; category_name?: string | null }>,
  fallbackLabel = "Uncategorized",
) {
  const map = new Map<string, number>();

  for (const item of transactions) {
    if (item.type !== "expense") continue;
    const key = (item.category_name ?? fallbackLabel).trim() || fallbackLabel;
    map.set(key, (map.get(key) ?? 0) + Number(item.amount || 0));
  }

  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}
