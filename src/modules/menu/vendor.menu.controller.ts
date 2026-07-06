import { Request, Response } from "express";
import { MenuItemModel } from "../../models/MenuItem.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const listMenuItems = asyncHandler(async (req: Request, res: Response) => {
  const items = await MenuItemModel.find({ vendorId: req.vendorId }).sort({ category: 1, name: 1 });
  sendSuccess(res, 200, items);
});

export const createMenuItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await MenuItemModel.create({ ...req.body, vendorId: req.vendorId });
  sendSuccess(res, 201, item, "Menu item added");
});

export const updateMenuItem = asyncHandler(async (req: Request, res: Response) => {
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
