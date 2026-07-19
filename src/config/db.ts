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

  // Auto-populate missing slugs for existing coaches
  try {
    const { CoachModel } = await import("../models/Coach.model");
    const coaches = await CoachModel.find({ $or: [{ slug: { $exists: false } }, { slug: "" }] });
    if (coaches.length > 0) {
      logger.info(`Found ${coaches.length} existing coaches requiring slug migrations.`);
      for (const coach of coaches) {
        // save() triggers the pre-save hook to populate the slug
        await coach.save();
      }
      logger.info("Existing coach migrations completed successfully.");
    }
  } catch (err) {
    logger.error({ err }, "Error running coach migrations");
  }

  // Food multi-outlet migration: every food vendor gets a default FoodOutlet
  // (from their Vendor profile), and legacy MenuItems/FoodOrders that predate
  // outlets get stamped with it. Idempotent — only touches docs missing outletId.
  try {
    const { VendorModel } = await import("../models/Vendor.model");
    const { FoodOutletModel } = await import("../models/FoodOutlet.model");
    const { MenuItemModel } = await import("../models/MenuItem.model");
    const { FoodOrderModel } = await import("../models/FoodOrder.model");

    const foodVendors = await VendorModel.find({ verticals: "food" }).select(
      "businessName logo banner poster city state categories"
    );
    for (const vendor of foodVendors) {
      let outlet = await FoodOutletModel.findOne({ vendorId: vendor._id }).sort({ createdAt: 1 });
      const orphanFilter = { vendorId: vendor._id, outletId: { $exists: false } };
      const [orphanItems, orphanOrders] = await Promise.all([
        MenuItemModel.countDocuments(orphanFilter),
        FoodOrderModel.countDocuments(orphanFilter),
      ]);
      if (!outlet && orphanItems === 0 && orphanOrders === 0) continue;

      if (!outlet) {
        outlet = await FoodOutletModel.create({
          vendorId: vendor._id,
          name: vendor.businessName || "My Restaurant",
          logo: vendor.logo,
          banner: vendor.banner,
          poster: vendor.poster,
          cuisines: vendor.categories ?? [],
          location: { city: vendor.city },
        });
        logger.info(`Created default food outlet for vendor ${vendor.businessName}`);
      }

      if (orphanItems > 0 || orphanOrders > 0) {
        await Promise.all([
          MenuItemModel.updateMany(orphanFilter, { $set: { outletId: outlet._id } }),
          FoodOrderModel.updateMany(orphanFilter, { $set: { outletId: outlet._id } }),
        ]);
        logger.info(`Backfilled outletId onto ${orphanItems} menu items and ${orphanOrders} orders for ${vendor.businessName}`);
      }
    }
  } catch (err) {
    logger.error({ err }, "Error running food outlet migrations");
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
