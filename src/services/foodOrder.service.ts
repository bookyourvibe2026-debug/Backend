import { FilterQuery } from "mongoose";
import { FoodOrderDocument, FoodOrderItem, FoodOrderModel, FoodOrderStatus } from "../models/FoodOrder.model";
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
  vendorId: string;
  items: { menuItemId: string; quantity: number }[];
  notes?: string;
}) {
  if (input.items.length === 0) {
    throw ApiError.badRequest("Add at least one item to place an order");
  }

  const menuItems = await MenuItemModel.find({
    _id: { $in: input.items.map((i) => i.menuItemId) },
    vendorId: input.vendorId,
    inStock: true,
  });

  const orderItems: FoodOrderItem[] = input.items.map((requested) => {
    const menuItem = menuItems.find((m) => m._id.toString() === requested.menuItemId);
    if (!menuItem) {
      throw ApiError.badRequest("One or more menu items are unavailable. Please refresh the menu and try again.");
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
    vendorId: input.vendorId,
    customerId: input.customerId,
    customerName: input.customerName,
    phone: input.phone,
    items: orderItems,
    totalAmount,
    notes: input.notes,
  });
}
