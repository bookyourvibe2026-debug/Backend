import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { resolveVendorScope } from "../../middleware/vendorScope.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  addFixtureSchema,
  createTournamentSchema,
  fixtureParamSchema,
  orderIdParamSchema,
  registrationListQuerySchema,
  tournamentIdParamSchema,
  updateFixtureResultSchema,
  updateTournamentSchema,
  vendorTournamentQuerySchema,
} from "../../validators/tournament.validators";
import {
  addVendorTournamentFixture,
  checkInVendorRegistration,
  createVendorTournament,
  getVendorTournamentById,
  getVendorTournamentRegistrations,
  getVendorTournaments,
  updateVendorTournament,
  updateVendorTournamentFixtureResult,
} from "./vendor.tournaments.controller";

const router = Router();

router.use(requireAuth("vendor"), resolveVendorScope);

router.get("/", requireVendorPermission("tournaments", "view"), validate({ query: vendorTournamentQuerySchema }), getVendorTournaments);
router.post("/", requireVendorPermission("tournaments", "create"), validate({ body: createTournamentSchema }), createVendorTournament);

router.get(
  "/registrations",
  requireVendorPermission("tournaments", "view"),
  validate({ query: registrationListQuerySchema }),
  getVendorTournamentRegistrations
);
router.post(
  "/registrations/:orderId/checkin",
  requireVendorPermission("tournaments", "edit"),
  validate({ params: orderIdParamSchema }),
  checkInVendorRegistration
);

router.get("/:id", requireVendorPermission("tournaments", "view"), validate({ params: tournamentIdParamSchema }), getVendorTournamentById);
router.put(
  "/:id",
  requireVendorPermission("tournaments", "edit"),
  validate({ params: tournamentIdParamSchema, body: updateTournamentSchema }),
  updateVendorTournament
);

router.post(
  "/:id/fixtures",
  requireVendorPermission("tournaments", "edit"),
  validate({ params: tournamentIdParamSchema, body: addFixtureSchema }),
  addVendorTournamentFixture
);
router.patch(
  "/:id/fixtures/:fixtureId",
  requireVendorPermission("tournaments", "edit"),
  validate({ params: fixtureParamSchema, body: updateFixtureResultSchema }),
  updateVendorTournamentFixtureResult
);

export default router;
