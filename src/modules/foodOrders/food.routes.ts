import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { orderIdParamSchema } from "../../validators/booking.validators";
import { createFoodOrderSchema, foodVendorIdParamSchema, myFoodOrdersQuerySchema } from "../../validators/foodOrder.validators";
import {
  getFoodVendorMenu,
  getMyFoodOrderByOrderId,
  getMyFoodOrders,
  listFoodVendors,
  placeFoodOrder,
} from "./food.controller";

const router = Router();

// Public — anyone can browse food vendors and menus, no login required.
router.get("/vendors", listFoodVendors);
router.get("/vendors/:vendorId/menu", validate({ params: foodVendorIdParamSchema }), getFoodVendorMenu);

// Customer-only — placing and viewing orders.
router.post("/orders", requireAuth("customer"), validate({ body: createFoodOrderSchema }), placeFoodOrder);
router.get("/orders/mine", requireAuth("customer"), validate({ query: myFoodOrdersQuerySchema }), getMyFoodOrders);
router.get("/orders/:orderId", requireAuth("customer"), validate({ params: orderIdParamSchema }), getMyFoodOrderByOrderId);

export default router;
