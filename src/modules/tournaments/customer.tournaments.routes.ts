import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  orderIdParamSchema,
  registerTeamSchema,
  registrationListQuerySchema,
} from "../../validators/tournament.validators";
import {
  cancelMyRegistrationRoute,
  createMyRegistration,
  getMyRegistrationByOrderId,
  getMyRegistrations,
} from "./customer.tournaments.controller";

const router = Router();

router.use(requireAuth("customer"));

router.post("/", validate({ body: registerTeamSchema }), createMyRegistration);
router.get("/", validate({ query: registrationListQuerySchema }), getMyRegistrations);
router.get("/:orderId", validate({ params: orderIdParamSchema }), getMyRegistrationByOrderId);
router.post("/:orderId/cancel", validate({ params: orderIdParamSchema }), cancelMyRegistrationRoute);

export default router;
