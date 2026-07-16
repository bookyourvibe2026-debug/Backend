import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createExpenseSchema,
  expenseIdParamSchema,
  expenseQuerySchema,
  updateExpenseSchema,
} from "../../validators/vendor.validators";
import { createExpense, deleteExpense, listExpenses, updateExpense } from "./vendor.expense.controller";

const router = Router();

// Expenses are financial data, so they ride on the "earnings" permission.
router.get("/", requireVendorPermission("earnings", "view"), validate({ query: expenseQuerySchema }), listExpenses);
router.post("/", requireVendorPermission("earnings", "create"), validate({ body: createExpenseSchema }), createExpense);
router.put(
  "/:id",
  requireVendorPermission("earnings", "edit"),
  validate({ params: expenseIdParamSchema, body: updateExpenseSchema }),
  updateExpense
);
router.delete(
  "/:id",
  requireVendorPermission("earnings", "delete"),
  validate({ params: expenseIdParamSchema }),
  deleteExpense
);

export default router;
