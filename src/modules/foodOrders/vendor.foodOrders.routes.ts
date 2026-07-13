import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { requireVendorVertical } from "../../middleware/vendorScope.middleware";
import { validate } from "../../middleware/validate.middleware";
import { orderIdParamSchema } from "../../validators/booking.validators";
import { foodOrderListQuerySchema, updateFoodOrderStatusSchema } from "../../validators/foodOrder.validators";
import { checkInVendorFoodOrder, getVendorFoodOrders, updateVendorFoodOrderStatus } from "./vendor.foodOrders.controller";

const router = Router();

router.use(requireVendorVertical("food"));

router.get("/", requireVendorPermission("foodOrders", "view"), validate({ query: foodOrderListQuerySchema }), getVendorFoodOrders);
router.patch(
  "/:orderId/status",
  requireVendorPermission("foodOrders", "edit"),
  validate({ params: orderIdParamSchema, body: updateFoodOrderStatusSchema }),
  updateVendorFoodOrderStatus
);
router.post(
  "/:orderId/checkin",
  requireVendorPermission("foodOrders", "edit"),
  validate({ params: orderIdParamSchema }),
  checkInVendorFoodOrder
);

export default router;
