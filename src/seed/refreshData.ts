import { connectDatabase, disconnectDatabase } from "../config/db";
import { logger } from "../config/logger";
import { ListingModel } from "../models/Listing.model";
import { VendorModel } from "../models/Vendor.model";
import { CustomerModel } from "../models/Customer.model";
import { BookingModel } from "../models/Booking.model";
import { hashPassword } from "../utils/password";

async function refreshData() {
  logger.info("Starting Data Refresh Process...");
  await connectDatabase();

  try {
    // 1. Delete all existing data
    logger.info("Clearing existing Vendors, Customers, Listings, and Bookings...");
    await VendorModel.deleteMany({});
    await CustomerModel.deleteMany({});
    await ListingModel.deleteMany({});
    await BookingModel.deleteMany({});
    logger.info("Existing data cleared.");

    // 2. Create new Owner (Vendor)
    logger.info("Creating new Owner...");
    const ownerPassword = await hashPassword("Owner@12345");
    const vendor = await VendorModel.create({
      ownerName: "Test Owner",
      businessName: "Premium Sports Arena",
      email: "owner@bookyourvibe.in",
      phone: "9988776655",
      passwordHash: ownerPassword,
      state: "Maharashtra",
      city: "Mumbai",
      status: "approved",
      approvedOn: new Date(),
      categories: ["Cricket", "Turf", "Football"],
      address: { street: "Andheri West", pinCode: "400053", country: "India" },
    });
    logger.info(`Owner created: ${vendor.email}`);

    // 3. Create new Customer
    logger.info("Creating new Customer...");
    const customerPassword = await hashPassword("Customer@12345");
    const customer = await CustomerModel.create({
      name: "Test Customer",
      email: "customer@bookyourvibe.in",
      phone: "9988776644",
      passwordHash: customerPassword,
      status: "active",
      provider: "local"
    });
    logger.info(`Customer created: ${customer.email}`);

    // 4. Create new Venue (Listing)
    logger.info("Creating new Venue records...");
    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(now.getFullYear() + 1);

    const listing = await ListingModel.create({
      title: "Premium Box Cricket",
      type: "Turf",
      categories: ["cricket"],
      subCategories: ["box-cricket"],
      price: 1000,
      status: "Active",
      trending: true,
      isPrivate: false,
      access: "Vendor Owned",
      vendorId: vendor._id,
      ownerName: vendor.ownerName,
      sharedWithVendors: true,
      coverImage: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=1200&h=750&fit=crop",
      images: [
        { id: "img-1", url: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=1200&h=750&fit=crop", label: "Netted turf, night view" },
      ],
      country: "India",
      city: "Mumbai",
      state: "Maharashtra",
      cityMode: "single",
      cities: ["Mumbai"],
      address: "Andheri West, Mumbai",
      startingPoint: "Andheri West",
      endingPoint: "Andheri West",
      reportingStartTime: "06:00",
      reportingEndTime: "23:00",
      description: "Premium enclosed box-cricket ground. Synthetic turf, floodlit for evening games.",
      highlights: ["Fully enclosed netting", "Floodlit for night matches"],
      inclusions: ["Turf access", "Match ball"],
      exclusions: ["Bats & gloves"],
      itinerary: [
        { day: 1, title: "Match Slot", description: "60-minute box cricket slot." },
      ],
      tags: ["cricket", "box-cricket", "mumbai", "turf"],
      priceTiers: [
        { id: "tier-weekday", label: "Weekday", amount: 1000 },
        { id: "tier-weekend", label: "Weekend", amount: 1500 },
      ],
      bookingType: "Recurring",
      availableFrom: now,
      availableTill: oneYearFromNow,
      slotsPerDay: 10,
    });
    logger.info(`Venue created: ${listing.title}`);

    logger.info("Data refresh complete!");
  } catch (error) {
    logger.error({ error }, "Error during data refresh");
  } finally {
    await disconnectDatabase();
  }
}

refreshData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
