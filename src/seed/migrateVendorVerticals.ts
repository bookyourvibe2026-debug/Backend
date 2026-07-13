import { connectDatabase, disconnectDatabase } from "../config/db";
import { logger } from "../config/logger";
import { VendorModel } from "../models/Vendor.model";

/**
 * One-off migration: the old single `vertical` field ("turf" | "food" | "both") is replaced
 * by an array `verticals`. Run this once against any environment with pre-existing vendor
 * documents created before that change (`ts-node src/seed/migrateVendorVerticals.ts`).
 */
async function migrateVendorVerticals() {
  await connectDatabase();

  const legacyMap: Record<string, string[]> = {
    turf: ["turf"],
    food: ["food"],
    both: ["turf", "food"],
  };

  const collection = VendorModel.collection;
  let migrated = 0;

  for (const [legacyValue, verticals] of Object.entries(legacyMap)) {
    const result = await collection.updateMany(
      { vertical: legacyValue, verticals: { $exists: false } },
      { $set: { verticals }, $unset: { vertical: "" } }
    );
    migrated += result.modifiedCount;
  }

  // Any vendor with neither `vertical` nor `verticals` set falls back to ["turf"].
  const fallback = await collection.updateMany(
    { verticals: { $exists: false } },
    { $set: { verticals: ["turf"] } }
  );
  migrated += fallback.modifiedCount;

  logger.info({ migrated }, "Vendor verticals migration complete");
  await disconnectDatabase();
}

migrateVendorVerticals()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Vendor verticals migration failed");
    process.exit(1);
  });
