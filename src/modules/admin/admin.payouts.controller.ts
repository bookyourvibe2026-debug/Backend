import { Request, Response } from "express";
import { BookingModel } from "../../models/Booking.model";
import { PayoutCategoryModel } from "../../models/PayoutCategory.model";
import { VendorPayoutModel } from "../../models/VendorPayout.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const listPayoutCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await PayoutCategoryModel.find().sort({ createdAt: 1 });
  sendSuccess(res, 200, categories);
});

export const createPayoutCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await PayoutCategoryModel.create(req.body);
  sendSuccess(res, 201, category, "Category created");
});

export const deletePayoutCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await PayoutCategoryModel.findByIdAndDelete(req.params.id!);
  if (!category) throw ApiError.notFound("Category not found");
  sendSuccess(res, 200, null, "Category deleted");
});

export const listVendorPayouts = asyncHandler(async (req: Request, res: Response) => {
  const { status, vendorId, categoryId, page = 1, limit = 20 } = req.query as unknown as {
    status?: string;
    vendorId?: string;
    categoryId?: string;
    page?: number;
    limit?: number;
  };
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (vendorId) filter.vendorId = vendorId;
  if (categoryId) filter.categoryId = categoryId;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    VendorPayoutModel.find(filter).populate("vendorId", "businessName ownerName").sort({ createdAt: -1 }).skip(skip).limit(limit),
    VendorPayoutModel.countDocuments(filter),
  ]);

  sendSuccess(res, 200, { items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const createVendorPayout = asyncHandler(async (req: Request, res: Response) => {
  const payout = await VendorPayoutModel.create({
    ...req.body,
    bookingsCount: req.body.bookingIds?.length ?? req.body.bookingsCount ?? 0,
  });
  sendSuccess(res, 201, payout, "Payout entry created");
});

export const updateVendorPayoutStatus = asyncHandler(async (req: Request, res: Response) => {
  const payout = await VendorPayoutModel.findById(req.params.id!);
  if (!payout) throw ApiError.notFound("Payout entry not found");

  payout.status = req.body.status;
  if (req.body.status === "Paid") payout.processedAt = new Date();
  await payout.save();

  sendSuccess(res, 200, payout, "Payout status updated");
});

export const getVendorPayoutBookings = asyncHandler(async (req: Request, res: Response) => {
  const payout = await VendorPayoutModel.findById(req.params.id!);
  if (!payout) throw ApiError.notFound("Payout entry not found");

  const bookings = await BookingModel.find({ _id: { $in: payout.bookingIds } }).populate("listingId", "title");
  sendSuccess(
    res,
    200,
    bookings.map((b) => {
      const obj = b.toObject();
      const listing = obj.listingId as unknown as { title?: string } | null;
      return {
        orderId: obj.orderId,
        customerName: obj.customerName,
        listingTitle: listing?.title ?? "Deleted listing",
        vendorEarning: obj.vendorEarning,
      };
    })
  );
});
