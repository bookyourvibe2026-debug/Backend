import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

mongoose.set("strictQuery", true);

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
  mongoose.connection.on("error", (err) => logger.error({ err }, "MongoDB connection error"));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));

  await mongoose.connect(env.MONGODB_URI);

  // Auto-populate missing slugs and coverImages for existing listings
  try {
    const { ListingModel } = await import("../models/Listing.model");
    const listings = await ListingModel.find({
      $or: [
        { slug: { $exists: false } },
        { slug: "" },
        { coverImage: { $exists: false } },
        { coverImage: "" }
      ]
    });
    if (listings.length > 0) {
      logger.info(`Found ${listings.length} existing listings requiring slug/coverImage migrations.`);
      for (const listing of listings) {
        if (!listing.coverImage && listing.images && listing.images.length > 0) {
          const firstImage = listing.images[0];
          if (firstImage) {
            listing.coverImage = firstImage.url;
          }
        }
        // save() triggers the pre-save hook to populate the slug
        await listing.save();
      }
      logger.info("Existing listing migrations completed successfully.");
    }
  } catch (err) {
    logger.error({ err }, "Error running listing migrations");
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
