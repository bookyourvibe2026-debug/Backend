import { Request, Response } from "express";
import { CustomerModel } from "../../models/Customer.model";
import { VendorModel } from "../../models/Vendor.model";
import { MenuItemModel } from "../../models/MenuItem.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { createFoodOrder, getFoodOrderByOrderId, listFoodOrdersForCustomer } from "../../services/foodOrder.service";

export const listFoodVendors = asyncHandler(async (_req: Request, res: Response) => {
  const vendors = await VendorModel.find({
    vertical: { $in: ["food", "both"] },
    status: "approved",
  }).select("businessName ownerName logo banner poster city state categories");
  sendSuccess(res, 200, vendors);
});

export const getFoodVendorMenu = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await VendorModel.findOne({
    _id: req.params.vendorId,
    vertical: { $in: ["food", "both"] },
    status: "approved",
  }).select("businessName ownerName logo banner poster city state");
  if (!vendor) throw ApiError.notFound("Food vendor not found");

  const items = await MenuItemModel.find({ vendorId: vendor._id, inStock: true }).sort({ category: 1, name: 1 });
  sendSuccess(res, 200, { vendor, items });
});

export const placeFoodOrder = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerModel.findById(req.auth!.sub);
  if (!customer) throw ApiError.notFound("Customer not found");

  const order = await createFoodOrder({
    customerId: customer._id.toString(),
    customerName: customer.name,
    phone: customer.phone ?? "",
    vendorId: req.body.vendorId,
    items: req.body.items,
    notes: req.body.notes,
  });
  sendSuccess(res, 201, order, "Order placed");
});

export const getMyFoodOrders = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await listFoodOrdersForCustomer(req.auth!.sub, { page, limit });
  sendSuccess(res, 200, result);
});

export const getMyFoodOrderByOrderId = asyncHandler(async (req: Request, res: Response) => {
  const order = await getFoodOrderByOrderId(req.params.orderId!, { customerId: req.auth!.sub });
  sendSuccess(res, 200, order);
});
