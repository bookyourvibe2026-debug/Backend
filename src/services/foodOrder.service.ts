import { FilterQuery } from "mongoose";
import { FoodOrderDocument, FoodOrderItem, FoodOrderModel, FoodOrderStatus } from "../models/FoodOrder.model";
import { FoodOutletModel } from "../models/FoodOutlet.model";
import { MenuItemModel } from "../models/MenuItem.model";
import { ApiError } from "../utils/ApiError";
import { generateOrderId } from "../utils/orderId";

export async function listFoodOrdersForVendor(vendorId: string, filters: { status?: string; page: number; limit: number }) {
  const filter: FilterQuery<FoodOrderDocument> = { vendorId };
  if (filters.status) filter.status = filters.status;
  return paginate(filter, filters);
}

export async function listFoodOrdersForCustomer(customerId: string, filters: { page: number; limit: number }) {
  return paginate({ customerId }, filters);
}

async function paginate(filter: FilterQuery<FoodOrderDocument>, { page, limit }: { page: number; limit: number }) {
  const skip = (page - 1) * limit;
  const query = FoodOrderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  const [items, total] = await Promise.all([query, FoodOrderModel.countDocuments(filter)]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getFoodOrderByOrderId(orderId: string, scope?: { customerId?: string; vendorId?: string }) {
  const filter: FilterQuery<FoodOrderDocument> = { orderId };
  if (scope?.customerId) filter.customerId = scope.customerId;
  if (scope?.vendorId) filter.vendorId = scope.vendorId;

  const order = await FoodOrderModel.findOne(filter);
  if (!order) throw ApiError.notFound("Food order not found");
  return order;
}

export async function updateFoodOrderStatus(orderId: string, status: FoodOrderStatus, vendorId: string) {
  const order = await getFoodOrderByOrderId(orderId, { vendorId });
  if (order.status === "Delivered" || order.status === "Cancelled" || order.status === "Rejected") {
    throw ApiError.badRequest(`This order is already ${order.status.toLowerCase()} and cannot be updated`);
  }
  order.status = status;
  await order.save();
  return order;
}

/** "QR scan" here mirrors booking check-in: the customer's order QR just encodes the orderId, and scanning/typing it here marks the order delivered. */
export async function checkInFoodOrder(orderId: string, vendorId: string) {
  const order = await getFoodOrderByOrderId(orderId, { vendorId });

  if (order.status === "Cancelled" || order.status === "Rejected") {
    throw ApiError.badRequest(`This order was ${order.status.toLowerCase()} and cannot be checked in`);
  }
  if (order.checkedIn) {
    return { order, alreadyCheckedIn: true };
  }

  order.checkedIn = true;
  order.checkedInAt = new Date();
  order.status = "Delivered";
  await order.save();
  return { order, alreadyCheckedIn: false };
}

export async function createFoodOrder(input: {
  customerId: string;
  customerName: string;
  phone: string;
  /** New clients send outletId; legacy clients send vendorId only. */
  outletId?: string;
  vendorId?: string;
  items: { menuItemId: string; quantity: number; variantLabel?: string }[];
  notes?: string;
}) {
  if (input.items.length === 0) {
    throw ApiError.badRequest("Add at least one item to place an order");
  }

  let outletId = input.outletId;
  let vendorId = input.vendorId;
  if (outletId) {
    const outlet = await FoodOutletModel.findOne({ _id: outletId, status: "Active" }).select("vendorId");
    if (!outlet) throw ApiError.badRequest("This restaurant is not available right now");
    vendorId = outlet.vendorId.toString();
  } else if (vendorId) {
    // Legacy path: resolve the vendor's default (first) outlet so the order still lands somewhere.
    const outlet = await FoodOutletModel.findOne({ vendorId }).sort({ createdAt: 1 }).select("_id");
    outletId = outlet?._id.toString();
  }
  if (!vendorId) throw ApiError.badRequest("Restaurant not found");

  const menuItems = await MenuItemModel.find({
    _id: { $in: input.items.map((i) => i.menuItemId) },
    vendorId,
    inStock: true,
  });

  const orderItems: FoodOrderItem[] = input.items.map((requested) => {
    const menuItem = menuItems.find((m) => m._id.toString() === requested.menuItemId);
    if (!menuItem) {
      throw ApiError.badRequest("One or more menu items are unavailable. Please refresh the menu and try again.");
    }

    // Variant-priced dishes require a valid variant pick; price always comes from the server.
    if (menuItem.priceVariants.length > 0) {
      const variant = menuItem.priceVariants.find(
        (v) => v.label.toLowerCase() === (requested.variantLabel ?? "").toLowerCase()
      );
      if (!variant) {
        throw ApiError.badRequest(`Please pick a size/option for "${menuItem.name}"`);
      }
      return {
        menuItemId: menuItem._id,
        name: menuItem.name,
        price: variant.price,
        quantity: requested.quantity,
        variantLabel: variant.label,
      };
    }

    return {
      menuItemId: menuItem._id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: requested.quantity,
    };
  });

  const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return FoodOrderModel.create({
    orderId: generateOrderId(),
    vendorId,
    outletId,
    customerId: input.customerId,
    customerName: input.customerName,
    phone: input.phone,
    items: orderItems,
    totalAmount,
    notes: input.notes,
  });
}
