import { Request, Response } from "express";
import { ExpenseModel } from "../../models/Expense.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

/** Venue running costs: maintenance, rent, salary, misc. */

export const listExpenses = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query as { from?: string; to?: string };

  const filter: Record<string, unknown> = { vendorId: req.vendorId };
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) range.$lte = new Date(to);
    filter.spentAt = range;
  }

  const expenses = await ExpenseModel.find(filter).sort({ spentAt: -1 }).limit(200);

  // Totals per category so the dashboard doesn't have to re-add them client-side.
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    total += e.amount;
  }

  sendSuccess(res, 200, { items: expenses, total, byCategory });
});

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await ExpenseModel.create({
    ...req.body,
    spentAt: req.body.spentAt ?? new Date(),
    vendorId: req.vendorId,
  });
  sendSuccess(res, 201, expense, "Expense added");
});

export const updateExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await ExpenseModel.findOne({ _id: req.params.id, vendorId: req.vendorId });
  if (!expense) throw ApiError.notFound("Expense not found");

  expense.set(req.body);
  await expense.save();
  sendSuccess(res, 200, expense, "Expense updated");
});

export const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await ExpenseModel.findOneAndDelete({ _id: req.params.id, vendorId: req.vendorId });
  if (!expense) throw ApiError.notFound("Expense not found");
  sendSuccess(res, 200, null, "Expense deleted");
});
