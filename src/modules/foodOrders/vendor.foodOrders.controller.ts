import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  checkInFoodOrder,
  createCounterOrder,
  listFoodOrdersForVendor,
  peekFoodOrder,
  updateFoodOrderStatus,
} from "../../services/foodOrder.service";

export const getVendorFoodOrders = asyncHandler(async (req: Request, res: Response) => {
  const { status, outletId, orderType, scope, page, limit } = req.query as unknown as {
    status?: string;
    outletId?: string;
    orderType?: string;
    scope?: "upcoming" | "history";
    page: number;
    limit: number;
  };
  const result = await listFoodOrdersForVendor(req.vendorId!, { status, outletId, orderType, scope, page, limit });
  sendSuccess(res, 200, result);
});

/** Full order details behind a scanned QR — read-only, so the counter can verify before handing over. */
export const getVendorFoodOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await peekFoodOrder(req.params.orderId!, req.vendorId!);
  sendSuccess(res, 200, order);
});

export const updateVendorFoodOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const order = await updateFoodOrderStatus(req.params.orderId!, req.body.status, req.vendorId!);
  sendSuccess(res, 200, order, "Order updated");
});

export const checkInVendorFoodOrder = asyncHandler(async (req: Request, res: Response) => {
  const { order, alreadyCheckedIn } = await checkInFoodOrder(req.params.orderId!, req.vendorId!);
  sendSuccess(res, 200, order, alreadyCheckedIn ? "Already checked in" : "Marked delivered");
});

/** Billing Slide / POS — ring up a walk-in bill against the live menu. */
export const createVendorCounterOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await createCounterOrder({ ...req.body, vendorId: req.vendorId! });
  sendSuccess(res, 201, order, "Bill created");
});
