import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { checkInFoodOrder, listFoodOrdersForVendor, updateFoodOrderStatus } from "../../services/foodOrder.service";

export const getVendorFoodOrders = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
  const result = await listFoodOrdersForVendor(req.vendorId!, { status, page, limit });
  sendSuccess(res, 200, result);
});

export const updateVendorFoodOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const order = await updateFoodOrderStatus(req.params.orderId!, req.body.status, req.vendorId!);
  sendSuccess(res, 200, order, "Order updated");
});

export const checkInVendorFoodOrder = asyncHandler(async (req: Request, res: Response) => {
  const { order, alreadyCheckedIn } = await checkInFoodOrder(req.params.orderId!, req.vendorId!);
  sendSuccess(res, 200, order, alreadyCheckedIn ? "Already checked in" : "Marked delivered");
});
