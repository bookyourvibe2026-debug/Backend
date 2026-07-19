import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  enrollCoachSchema,
  orderIdParamSchema,
  subscriptionListQuerySchema,
} from "../../validators/coach.validators";
import {
  cancelMyCoachSubscriptionRoute,
  createMyCoachSubscription,
  getMyCoachSubscriptionByOrderId,
  getMyCoachSubscriptions,
} from "./customer.coaches.controller";

const router = Router();

router.use(requireAuth("customer"));

router.post("/", validate({ body: enrollCoachSchema }), createMyCoachSubscription);
router.get("/", validate({ query: subscriptionListQuerySchema }), getMyCoachSubscriptions);
router.get("/:orderId", validate({ params: orderIdParamSchema }), getMyCoachSubscriptionByOrderId);
router.post("/:orderId/cancel", validate({ params: orderIdParamSchema }), cancelMyCoachSubscriptionRoute);

export default router;
