import { Types } from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/db";
import { logger } from "../config/logger";
import { ListingModel } from "../models/Listing.model";

/**
 * One-off migration: the old single `lastMinBoost` object field is replaced by an array
 * `lastMinBoosts`, so a listing can carry several independent Sport + Court + Slot boosts
 * at once. Run this once against any environment with pre-existing `lastMinBoost` data
 * (`tsx src/seed/migrateLastMinBoostToArray.ts`).
 */
async function migrateLastMinBoostToArray() {
  await connectDatabase();

  const collection = ListingModel.collection;
  const cursor = collection.find({ lastMinBoost: { $exists: true } });

  let migrated = 0;
  for await (const raw of cursor) {
    const doc = raw as unknown as {
      _id: Types.ObjectId;
      lastMinBoost?: { enabled: boolean; game: string; slotStarts: string[]; discountPct: number; triggerMins: number };
    };
    const legacy = doc.lastMinBoost;
    if (!legacy) continue;

    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          lastMinBoosts: [
            {
              id: `boost-${doc._id}-${Date.now()}`,
              enabled: legacy.enabled,
              game: legacy.game,
              slotStarts: legacy.slotStarts,
              discountPct: legacy.discountPct,
              triggerMins: legacy.triggerMins,
            },
          ],
        },
        $unset: { lastMinBoost: "" },
      }
    );
    migrated += 1;
  }

  logger.info({ migrated }, "Last Min Boost array migration complete");
  await disconnectDatabase();
}

migrateLastMinBoostToArray()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Last Min Boost array migration failed");
    process.exit(1);
  });
