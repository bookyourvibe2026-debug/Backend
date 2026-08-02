import { connectDatabase, disconnectDatabase } from "../config/db";
import { logger } from "../config/logger";
import { ListingModel } from "../models/Listing.model";

async function main() {
  await connectDatabase();

  const listing = await ListingModel.findOne({ status: "Active" });
  if (!listing) {
    logger.error("No active listing found to add boost");
    await disconnectDatabase();
    return;
  }

  // Calculate a slot that starts in the near future (e.g. 1 hour and 30 minutes from now)
  const now = new Date();
  const target = new Date(now.getTime() + 90 * 60 * 1000);
  const slotStart = `${String(target.getHours()).padStart(2, "0")}:00`;
  const slotEnd = `${String((target.getHours() + 1) % 24).padStart(2, "0")}:00`;

  // Make sure this slot is in the slotsList
  if (!listing.slotsList) {
    listing.slotsList = [];
  }
  
  const hasSlot = listing.slotsList.some(s => s.startTime === slotStart);
  if (!hasSlot) {
    listing.slotsList.push({
      startTime: slotStart,
      endTime: slotEnd,
      label: `${slotStart} - ${slotEnd}`,
      price: listing.price,
      blocked: false
    });
  }

  listing.lastMinBoost = {
    enabled: true,
    game: listing.categories[0] || "Cricket",
    slotStarts: [slotStart],
    discountPct: 20,
    triggerMins: 120
  };

  // Mark the listing cover image to mock if not present
  if (!listing.coverImage) {
    listing.coverImage = "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=1200&h=750&fit=crop";
  }

  await listing.save();
  logger.info(`Successfully added active last-minute boost to listing: ${listing.title} for slot: ${slotStart}`);

  await disconnectDatabase();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Boost seeding failed");
    process.exit(1);
  });
