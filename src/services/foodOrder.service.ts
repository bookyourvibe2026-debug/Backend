import { FilterQuery } from "mongoose";
import {
  FoodOrderChannel,
  FoodOrderDocument,
  FoodOrderItem,
  FoodOrderModel,
  FoodOrderStatus,
  FoodOrderType,
} from "../models/FoodOrder.model";
import { FoodOutletDocument, FoodOutletModel } from "../models/FoodOutlet.model";
import { MenuItemDocument, MenuItemModel } from "../models/MenuItem.model";
import { ApiError } from "../utils/ApiError";
import { generateOrderId } from "../utils/orderId";
import { estimateOrderEtaMins } from "./foodEta.service";

/** GST slab applied to restaurant food bills. */
const GST_RATE = 5;
/** Packaging & platform fee on app orders. Counter bills don't carry it. */
const PACKAGING_FEE = 15;

/** Statuses that are still "live" in the kitchen — the Upcoming Orders queue. */
const OPEN_STATUSES: FoodOrderStatus[] = ["Pending", "Accepted", "Preparing", "Ready"];
/** Statuses that are done with — the Order History. */
const CLOSED_STATUSES: FoodOrderStatus[] = ["Delivered", "Rejected", "Cancelled"];

export async function listFoodOrdersForVendor(
  vendorId: string,
  filters: { status?: string; outletId?: string; orderType?: string; scope?: "upcoming" | "history"; page: number; limit: number }
) {
  const filter: FilterQuery<FoodOrderDocument> = { vendorId };
  if (filters.status) filter.status = filters.status;
  else if (filters.scope === "upcoming") filter.status = { $in: OPEN_STATUSES };
  else if (filters.scope === "history") filter.status = { $in: CLOSED_STATUSES };
  // Omitting outletId keeps the default view "all turfs", which is what the owner wants first.
  if (filters.outletId) filter.outletId = filters.outletId;
  if (filters.orderType) filter.orderType = filters.orderType;
  return paginate(filter, filters);
}

export async function listFoodOrdersForCustomer(customerId: string, filters: { page: number; limit: number }) {
  return paginate({ customerId }, filters);
}

async function paginate(filter: FilterQuery<FoodOrderDocument>, { page, limit }: { page: number; limit: number }) {
  const skip = (page - 1) * limit;
  const query = FoodOrderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
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
  // The kitchen never made these — put the units back on the shelf.
  if (status === "Rejected" || status === "Cancelled") await restoreStock(order);
  return order;
}

/* --------------------------------- Inventory --------------------------------- */

/**
 * Reserve stock for an order, one dish at a time.
 *
 * Each decrement is a single conditional update — it only applies while enough units are
 * still on the shelf — so two players checking out at once can't oversell the last plate.
 * If a later dish comes up short, the units already taken are handed back before throwing.
 */
async function consumeStock(items: FoodOrderItem[], menuItems: MenuItemDocument[]) {
  const tracked = menuItems.filter((m) => m.trackInventory);
  if (tracked.length === 0) return;

  const taken: { menuItemId: string; qty: number }[] = [];

  for (const menuItem of tracked) {
    const ordered = items
      .filter((i) => i.menuItemId.toString() === menuItem._id.toString())
      .reduce((sum, i) => sum + i.quantity, 0);
    if (ordered === 0) continue;

    const updated = await MenuItemModel.findOneAndUpdate(
      { _id: menuItem._id, stockQty: { $gte: ordered } },
      { $inc: { stockQty: -ordered } },
      { new: true }
    );

    if (!updated) {
      // Someone else got there first — release what this order already claimed.
      await releaseStock(taken);
      const left = await MenuItemModel.findById(menuItem._id).select("stockQty").lean();
      throw ApiError.badRequest(
        `"${menuItem.name}" only has ${left?.stockQty ?? 0} left. Please reduce the quantity.`
      );
    }

    taken.push({ menuItemId: menuItem._id.toString(), qty: ordered });
    // Selling the last unit takes the dish off the menu automatically.
    if (updated.stockQty === 0) await MenuItemModel.updateOne({ _id: menuItem._id }, { $set: { inStock: false } });
  }
}

/** Hand reserved units back — used when a basket only partly clears. */
async function releaseStock(taken: { menuItemId: string; qty: number }[]) {
  await Promise.all(
    taken.map((t) =>
      MenuItemModel.updateOne({ _id: t.menuItemId }, { $inc: { stockQty: t.qty }, $set: { inStock: true } })
    )
  );
}

/** Put reserved units back after a rejection/cancellation. */
async function restoreStock(order: Pick<FoodOrderDocument, "items">) {
  const ids = order.items.map((i) => i.menuItemId);
  const tracked = await MenuItemModel.find({ _id: { $in: ids }, trackInventory: true }).select("_id");
  await Promise.all(
    tracked.map((menuItem) => {
      const qty = order.items
        .filter((i) => i.menuItemId.toString() === menuItem._id.toString())
        .reduce((sum, i) => sum + i.quantity, 0);
      if (qty === 0) return Promise.resolve();
      return MenuItemModel.updateOne({ _id: menuItem._id }, { $inc: { stockQty: qty }, $set: { inStock: true } });
    })
  );
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
  // Scanning closes the sale, so the GST bill number is issued here — this is the hook that
  // pushes the order into the food revenue dashboard.
  if (!order.billNo) order.billNo = order.orderId;
  await order.save();
  return { order, alreadyCheckedIn: false };
}

/** Full order behind a scanned QR, without changing its status — powers the scan preview. */
export async function peekFoodOrder(orderId: string, vendorId: string) {
  return getFoodOrderByOrderId(orderId, { vendorId });
}

/** Resolve the kitchen an order belongs to, from either an outletId (new clients) or a vendorId (legacy). */
async function resolveOutlet(input: { outletId?: string; vendorId?: string }) {
  let outlet: FoodOutletDocument | null = null;
  let vendorId = input.vendorId;

  if (input.outletId) {
    outlet = await FoodOutletModel.findOne({ _id: input.outletId, status: "Active" });
    if (!outlet) throw ApiError.badRequest("This restaurant is not available right now");
    vendorId = outlet.vendorId.toString();
  } else if (vendorId) {
    // Legacy path: fall back to the vendor's default (first) outlet so the order still lands somewhere.
    outlet = await FoodOutletModel.findOne({ vendorId }).sort({ createdAt: 1 });
  }
  if (!vendorId) throw ApiError.badRequest("Restaurant not found");

  return { outlet, outletId: outlet?._id.toString() ?? input.outletId, vendorId };
}

/** Price the basket off the live menu — the client never gets to set a price. */
function priceBasket(
  requestedItems: { menuItemId: string; quantity: number; variantLabel?: string }[],
  menuItems: MenuItemDocument[]
): FoodOrderItem[] {
  return requestedItems.map((requested) => {
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
}

/** GST bill maths, shared by app checkout and the counter POS. */
function billFor(items: FoodOrderItem[], opts: { packagingFee: number }) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = Math.round((subtotal * GST_RATE) / 100);
  return {
    subtotal,
    gstRate: GST_RATE,
    taxAmount,
    packagingFee: opts.packagingFee,
    totalAmount: subtotal + taxAmount + opts.packagingFee,
  };
}

/**
 * Quote a basket before the player pays — line prices, GST breakdown and the ETA
 * derived from the owner's per-category prep times. Nothing is persisted.
 */
export async function quoteFoodOrder(input: {
  outletId?: string;
  vendorId?: string;
  items: { menuItemId: string; quantity: number; variantLabel?: string }[];
  orderType?: FoodOrderType;
}) {
  if (input.items.length === 0) throw ApiError.badRequest("Add at least one item to get a quote");

  const { outlet, vendorId } = await resolveOutlet(input);
  const menuItems = await MenuItemModel.find({
    _id: { $in: input.items.map((i) => i.menuItemId) },
    vendorId,
    inStock: true,
  });
  const orderItems = priceBasket(input.items, menuItems);
  const orderType = input.orderType ?? "PostMatch";

  return {
    ...billFor(orderItems, { packagingFee: PACKAGING_FEE }),
    items: orderItems,
    orderType,
    etaMins: etaFor(orderItems, menuItems, outlet, orderType),
  };
}

/** ETA in minutes for a basket, using the outlet's per-category prep times. */
function etaFor(
  orderItems: FoodOrderItem[],
  menuItems: MenuItemDocument[],
  outlet: FoodOutletDocument | null,
  orderType: FoodOrderType
): number {
  return estimateOrderEtaMins({
    lines: orderItems.map((item) => {
      const menuItem = menuItems.find((m) => m._id.toString() === item.menuItemId.toString());
      return { category: menuItem?.category ?? "", prepTimeMins: menuItem?.prepTimeMins };
    }),
    categoryPrepTimes: outlet?.categoryPrepTimes ?? [],
    serviceBufferMins: outlet?.serviceBufferMins ?? 5,
    addServiceBuffer: orderType === "InVenue" || orderType === "DineIn",
  });
}

/** Reject a fulfilment mode the outlet has switched off. */
function assertFulfilmentAllowed(outlet: FoodOutletDocument | null, orderType: FoodOrderType) {
  if (!outlet || orderType === "Counter") return;
  const allowed: Record<Exclude<FoodOrderType, "Counter">, boolean> = {
    PreOrder: outlet.fulfilment?.preOrder ?? true,
    InVenue: outlet.fulfilment?.inVenue ?? true,
    PostMatch: outlet.fulfilment?.postMatch ?? true,
    DineIn: outlet.fulfilment?.dineIn ?? true,
  };
  if (!allowed[orderType]) {
    throw ApiError.badRequest("This restaurant isn't accepting that kind of order right now");
  }
}

export async function createFoodOrder(input: {
  customerId: string;
  customerName: string;
  phone: string;
  /** New clients send outletId; legacy clients send vendorId only. */
  outletId?: string;
  vendorId?: string;
  items: { menuItemId: string; quantity: number; variantLabel?: string }[];
  orderType?: FoodOrderType;
  /** Pre-orders: when the player will arrive to collect. */
  scheduledFor?: string;
  /** Dine-in table, or the court to bring an in-venue order to. */
  serveTo?: string;
  paymentMethod?: string;
  notes?: string;
}) {
  if (input.items.length === 0) {
    throw ApiError.badRequest("Add at least one item to place an order");
  }

  const { outlet, outletId, vendorId } = await resolveOutlet(input);
  const orderType: FoodOrderType = input.orderType ?? "PostMatch";
  assertFulfilmentAllowed(outlet, orderType);

  if (orderType === "PreOrder" && !input.scheduledFor) {
    throw ApiError.badRequest("Pick a pickup time for your pre-order");
  }

  const menuItems = await MenuItemModel.find({
    _id: { $in: input.items.map((i) => i.menuItemId) },
    vendorId,
    inStock: true,
  });

  const orderItems = priceBasket(input.items, menuItems);
  await consumeStock(orderItems, menuItems);

  return FoodOrderModel.create({
    orderId: generateOrderId(),
    vendorId,
    outletId,
    customerId: input.customerId,
    customerName: input.customerName,
    phone: input.phone,
    items: orderItems,
    ...billFor(orderItems, { packagingFee: PACKAGING_FEE }),
    orderType,
    channel: "app" as FoodOrderChannel,
    etaMins: etaFor(orderItems, menuItems, outlet, orderType),
    scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
    serveTo: input.serveTo,
    paymentMethod: input.paymentMethod ?? "Online",
    paymentStatus: "Paid",
    notes: input.notes,
  });
}

/**
 * Counter sale rung up by the Food Owner on the Billing Slide / POS.
 * Same menu, same order pipeline, same revenue dashboard — it just skips the player app,
 * lands already-delivered, and carries no packaging fee.
 */
export async function createCounterOrder(input: {
  vendorId: string;
  outletId: string;
  customerName?: string;
  phone?: string;
  items: { menuItemId: string; quantity: number; variantLabel?: string }[];
  paymentMethod?: string;
  paymentStatus?: "Paid" | "Unpaid";
  notes?: string;
}) {
  if (input.items.length === 0) throw ApiError.badRequest("Add at least one item to the bill");

  const outlet = await FoodOutletModel.findOne({ _id: input.outletId, vendorId: input.vendorId });
  if (!outlet) throw ApiError.notFound("Restaurant not found");

  const menuItems = await MenuItemModel.find({
    _id: { $in: input.items.map((i) => i.menuItemId) },
    vendorId: input.vendorId,
  });

  const orderItems = priceBasket(input.items, menuItems);
  await consumeStock(orderItems, menuItems);

  const bill = billFor(orderItems, { packagingFee: 0 });
  const orderId = generateOrderId();

  return FoodOrderModel.create({
    orderId,
    vendorId: input.vendorId,
    outletId: input.outletId,
    customerName: input.customerName?.trim() || "Counter Customer",
    phone: input.phone?.trim() || "-",
    items: orderItems,
    ...bill,
    status: "Delivered",
    orderType: "Counter" as FoodOrderType,
    channel: "pos" as FoodOrderChannel,
    etaMins: 0,
    paymentMethod: input.paymentMethod ?? "Cash",
    paymentStatus: input.paymentStatus ?? "Paid",
    billNo: orderId,
    checkedIn: true,
    checkedInAt: new Date(),
    notes: input.notes,
  });
}
