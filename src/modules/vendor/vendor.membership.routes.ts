import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { requireVendorVertical } from "../../middleware/vendorScope.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createMembershipSchema,
  createSubscriptionSchema,
  membershipIdParamSchema,
  updateMembershipSchema,
  updateSubscriptionStatusSchema,
} from "../../validators/vendor.validators";
import {
  createMembership,
  createSubscription,
  deleteMembership,
  listMemberships,
  listSubscriptions,
  updateMembership,
  updateSubscriptionStatus,
} from "./vendor.membership.controller";

const router = Router();

router.use(requireVendorVertical("turf"));

router.get("/", requireVendorPermission("membership", "view"), listMemberships);
router.post("/", requireVendorPermission("membership", "create"), validate({ body: createMembershipSchema }), createMembership);
router.put(
  "/:id",
  requireVendorPermission("membership", "edit"),
  validate({ params: membershipIdParamSchema, body: updateMembershipSchema }),
  updateMembership
);
router.delete("/:id", requireVendorPermission("membership", "delete"), validate({ params: membershipIdParamSchema }), deleteMembership);

router.get("/subscriptions/all", requireVendorPermission("membership", "view"), listSubscriptions);
router.post(
  "/subscriptions",
  requireVendorPermission("membership", "create"),
  validate({ body: createSubscriptionSchema }),
  createSubscription
);
router.patch(
  "/subscriptions/:id/status",
  requireVendorPermission("membership", "edit"),
  validate({ params: membershipIdParamSchema, body: updateSubscriptionStatusSchema }),
  updateSubscriptionStatus
);

export default router;
