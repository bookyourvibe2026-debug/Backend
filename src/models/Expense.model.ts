import { Schema, model, Types } from "mongoose";

/** Buckets a venue's running costs fall into. */
export type ExpenseCategory = "Maintenance" | "Rent" | "Salary" | "Misc";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ["Maintenance", "Rent", "Salary", "Misc"];

export interface ExpenseDocument {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  category: ExpenseCategory;
  amount: number;
  note?: string;
  /** Date the cost was incurred (not the row's createdAt). */
  spentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<ExpenseDocument>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, maxlength: 200 },
    spentAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Dashboard reads are always "this vendor, newest first, within a date window".
expenseSchema.index({ vendorId: 1, spentAt: -1 });

export const ExpenseModel = model<ExpenseDocument>("Expense", expenseSchema);
