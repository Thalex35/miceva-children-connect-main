import {
  buildExpenseBreakdown,
  calculateNetBalance,
  formatCurrency,
  summarizeFinanceTransactions,
  validateFinanceTransactionInput,
} from "./finance";

describe("finance calculations", () => {
  it("calculates current balance from income and expense totals", () => {
    const balance = calculateNetBalance({ income: 10000, expenses: 3000 });
    if (balance !== 7000) throw new Error(`Expected 7000, received ${balance}`);
  });

  it("summarizes the current month and year correctly", () => {
    const now = new Date("2026-09-15T12:00:00Z");
    const summary = summarizeFinanceTransactions(
      [
        { date: "2026-09-02", type: "income", amount: 5000 },
        { date: "2026-09-10", type: "expense", amount: 1200 },
        { date: "2026-08-20", type: "income", amount: 2000 },
        { date: "2025-12-30", type: "income", amount: 1000 },
        { date: "2026-01-05", type: "expense", amount: 800 },
      ],
      now,
    );

    if (summary.currentMonth.income !== 5000) throw new Error("Current month income mismatch");
    if (summary.currentMonth.expenses !== 1200) throw new Error("Current month expense mismatch");
    if (summary.currentMonth.net !== 3800) throw new Error("Current month net mismatch");
    if (summary.currentYear.income !== 5000 + 2000) throw new Error("Current year income mismatch");
    if (summary.currentYear.expenses !== 1200 + 800) throw new Error("Current year expense mismatch");
  });

  it("handles empty transaction sets safely", () => {
    const summary = summarizeFinanceTransactions([], new Date("2026-09-15T12:00:00Z"));
    if (summary.currentBalance !== 0) throw new Error("Expected zero balance");
    if (summary.currentMonth.income !== 0 || summary.currentMonth.expenses !== 0) {
      throw new Error("Expected empty month totals to be zero");
    }
  });
});

describe("transaction validation", () => {
  it("accepts valid income and expense entries", () => {
    const income = validateFinanceTransactionInput({
      date: "2026-09-15",
      type: "income",
      amount: 5000,
      categoryId: "11111111-1111-1111-1111-111111111111",
      description: "Offering",
    });
    const expense = validateFinanceTransactionInput({
      date: "2026-09-15",
      type: "expense",
      amount: 1200,
      categoryId: "22222222-2222-2222-2222-222222222222",
      description: "Bread",
    });

    if (!income.ok || !expense.ok) throw new Error("Expected valid input to pass");
  });

  it("rejects invalid amounts and transaction types", () => {
    const invalidAmount = validateFinanceTransactionInput({
      date: "2026-09-15",
      type: "income",
      amount: 0,
      categoryId: "11111111-1111-1111-1111-111111111111",
      description: "Offering",
    });
    const invalidType = validateFinanceTransactionInput({
      date: "2026-09-15",
      type: "refund",
      amount: 800,
      categoryId: "11111111-1111-1111-1111-111111111111",
      description: "Invalid",
    });

    if (invalidAmount.ok) throw new Error("Zero money should be rejected");
    if (invalidType.ok) throw new Error("Unsupported type should be rejected");
  });

  it("accepts USD and keeps HTG validation working", () => {
    const usdIncome = validateFinanceTransactionInput({
      date: "2026-09-15",
      type: "income",
      amount: 25,
      categoryId: "",
      description: "Offering in USD",
      currency: "USD",
    });
    const badCurrency = validateFinanceTransactionInput({
      date: "2026-09-15",
      type: "expense",
      amount: 12,
      categoryId: "lait",
      description: "Milk",
      currency: "EUR",
    });

    if (!usdIncome.ok) throw new Error("USD income should be accepted");
    if (badCurrency.ok) throw new Error("Unsupported currency should be rejected");
  });

  it("allows income without a category and requires a custom category for other expenses", () => {
    const income = validateFinanceTransactionInput({
      date: "2026-09-15",
      type: "income",
      amount: 5000,
      categoryId: "",
      description: "Offering",
    });
    const customOtherExpense = validateFinanceTransactionInput({
      date: "2026-09-15",
      type: "expense",
      amount: 250,
      categoryId: "other",
      description: "Snack",
      categoryName: "Divers",
    });
    const missingCustomOtherExpense = validateFinanceTransactionInput({
      date: "2026-09-15",
      type: "expense",
      amount: 250,
      categoryId: "other",
      description: "Snack",
      categoryName: "",
    });

    if (!income.ok) throw new Error("Income without a category should be accepted");
    if (!customOtherExpense.ok) throw new Error("Expense with a custom category should be accepted");
    if (missingCustomOtherExpense.ok) throw new Error("Other expense requires a custom category label");
  });
});

describe("currency formatting", () => {
  it("formats values in HTG and USD with grouping", () => {
    if (formatCurrency(12500) !== "12,500 HTG") throw new Error("Currency format mismatch");
    if (formatCurrency(-2500) !== "-2,500 HTG") throw new Error("Negative currency format mismatch");
    if (formatCurrency(12500, "USD") !== "12,500 USD") throw new Error("USD currency format mismatch");
  });
});
