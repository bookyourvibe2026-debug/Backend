import { NextFunction, Request, Response } from "express";
import multer from "multer";
import * as xlsx from "xlsx";
import { MenuItemModel } from "../../models/MenuItem.model";
import { getOutletForVendor } from "../../services/foodOutlet.service";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const listMenuItems = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { vendorId: req.vendorId };
  if (typeof req.query.outletId === "string" && req.query.outletId) filter.outletId = req.query.outletId;
  const items = await MenuItemModel.find(filter).sort({ category: 1, name: 1 });
  sendSuccess(res, 200, items);
});

export const createMenuItem = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.outletId) await getOutletForVendor(req.vendorId!, req.body.outletId);
  const item = await MenuItemModel.create({ ...req.body, vendorId: req.vendorId });
  sendSuccess(res, 201, item, "Menu item added");
});

export const updateMenuItem = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.outletId) await getOutletForVendor(req.vendorId!, req.body.outletId);
  const item = await MenuItemModel.findOne({ _id: req.params.id, vendorId: req.vendorId });
  if (!item) throw ApiError.notFound("Menu item not found");
  item.set(req.body);
  await item.save();
  sendSuccess(res, 200, item, "Menu item updated");
});

export const deleteMenuItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await MenuItemModel.findOneAndDelete({ _id: req.params.id, vendorId: req.vendorId });
  if (!item) throw ApiError.notFound("Menu item not found");
  sendSuccess(res, 200, null, "Menu item removed");
});

/* ------------------------------ Bulk Excel upload ------------------------------ */

const SHEET_MIMETYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv",
]);

const sheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!SHEET_MIMETYPES.has(file.mimetype) && !/\.(xlsx|xls|csv)$/i.test(file.originalname)) {
      cb(new Error("Upload an Excel (.xlsx/.xls) or CSV file"));
      return;
    }
    cb(null, true);
  },
}).single("file");

export function menuSheetUploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  sheetUpload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      next(ApiError.badRequest("File is too large — max 2 MB"));
      return;
    }
    next(ApiError.badRequest(err instanceof Error ? err.message : "Upload failed"));
  });
}

interface SheetRow {
  [key: string]: unknown;
}

/** Case-insensitive cell lookup so headers like "Item Name"/"item name"/"NAME" all work. */
function cell(row: SheetRow, ...names: string[]): unknown {
  const keys = Object.keys(row);
  for (const name of names) {
    const match = keys.find((k) => k.trim().toLowerCase() === name);
    if (match !== undefined) return row[match];
  }
  return undefined;
}

/**
 * Bulk-add menu items from a spreadsheet. Expected columns (case-insensitive):
 * "Item Name" (or "Name"/"Dish"), "Price", optional "Category", optional "Description".
 */
export const bulkUploadMenuItems = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("No file uploaded");
  const outletId = req.params.outletId!;
  await getOutletForVendor(req.vendorId!, outletId);

  let rows: SheetRow[];
  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("Empty workbook");
    rows = xlsx.utils.sheet_to_json<SheetRow>(workbook.Sheets[sheetName]!, { defval: "" });
  } catch {
    throw ApiError.badRequest("Couldn't read the file — make sure it's a valid Excel/CSV sheet");
  }

  if (rows.length === 0) throw ApiError.badRequest("The sheet has no rows");
  if (rows.length > 500) throw ApiError.badRequest("Max 500 rows per upload");

  const valid: { name: string; price: number; category: string; description?: string }[] = [];
  const errors: { row: number; reason: string }[] = [];

  rows.forEach((row, i) => {
    const rowNo = i + 2; // 1-based + header row
    const name = String(cell(row, "item name", "name", "dish", "item") ?? "").trim();
    const priceRaw = cell(row, "price", "amount", "rate");
    const price = Number(String(priceRaw ?? "").toString().replace(/[₹,\s]/g, ""));
    const category = String(cell(row, "category") ?? "").trim() || "General";
    const description = String(cell(row, "description") ?? "").trim() || undefined;

    if (name.length < 2) return errors.push({ row: rowNo, reason: "Missing/short item name" });
    if (!Number.isFinite(price) || price < 0) return errors.push({ row: rowNo, reason: "Invalid price" });
    valid.push({ name: name.slice(0, 120), price, category: category.slice(0, 60), description: description?.slice(0, 500) });
  });

  if (valid.length > 0) {
    await MenuItemModel.insertMany(
      valid.map((v) => ({ ...v, vendorId: req.vendorId, outletId, inStock: true }))
    );
  }

  sendSuccess(res, 201, { created: valid.length, errors }, `${valid.length} item(s) added`);
});
