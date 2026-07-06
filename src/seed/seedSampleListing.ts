import { connectDatabase, disconnectDatabase } from "../config/db";
import { logger } from "../config/logger";
import { ListingModel } from "../models/Listing.model";
import { VendorModel } from "../models/Vendor.model";
import { hashPassword } from "../utils/password";

const DEMO_VENDOR_EMAIL = "demo.vendor@bookyourvibe.in";

// Demonstrates every field a single package (Listing) can carry —
// filled in with the "Box Cricket Arena" example from the venue detail page.
async function seedSampleListing() {
  await connectDatabase();

  let vendor = await VendorModel.findOne({ email: DEMO_VENDOR_EMAIL });
  if (!vendor) {
    const passwordHash = await hashPassword("Demo@12345");
    vendor = await VendorModel.create({
      ownerName: "Rohit Sharma",
      businessName: "Savina Sports Arena",
      email: DEMO_VENDOR_EMAIL,
      phone: "9900011223",
      passwordHash,
      state: "Rajasthan",
      city: "Udaipur",
      status: "approved",
      approvedOn: new Date(),
      categories: ["Cricket", "Turf"],
      address: { street: "Savina, Udaipur", pinCode: "313001", country: "India" },
    });
    logger.info({ id: vendor._id.toString() }, "Created demo vendor: Savina Sports Arena");
  }

  const now = new Date();
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(now.getFullYear() + 1);

  const listing = await ListingModel.findOneAndUpdate(
    { title: "Box Cricket Arena" },
    {
      title: "Box Cricket Arena",
      type: "Turf",
      category: "Cricket",
      subCategory: "Box Cricket",
      price: 800,
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
        { id: "img-2", url: "https://images.unsplash.com/photo-1595435742656-5272d0b3fa82?w=1200&h=750&fit=crop", label: "Entrance & seating" },
        { id: "img-3", url: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&h=750&fit=crop", label: "Floodlights" },
      ],

      country: "India",
      city: "Udaipur",
      state: "Rajasthan",
      cityMode: "single",
      cities: ["Udaipur"],
      address: "Savina, Udaipur",
      startingPoint: "Savina Circle, Udaipur",
      endingPoint: "Savina Circle, Udaipur",
      reportingStartTime: "06:00",
      reportingEndTime: "23:00",

      description:
        "Enclosed box-cricket ground with netting all around, perfect for corporate matches. Synthetic turf, floodlit for evening games, and easy parking right outside.",
      highlights: [
        "Fully enclosed netting",
        "Corporate match ready",
        "Floodlit for night matches",
        "On-site parking",
      ],
      inclusions: ["Turf access", "Match ball", "First-aid kit", "Drinking water"],
      exclusions: ["Bats & gloves", "Umpire", "Refreshments"],

      itinerary: [
        { day: 1, title: "Match Slot", description: "90-minute box cricket slot, including 10 minutes warm-up time." },
      ],
      faqs: [
        { question: "Can we bring our own bats and balls?", answer: "Yes, you're welcome to bring your own gear — we also provide a match ball." },
        { question: "Is the turf covered for rain?", answer: "Yes, the arena is fully roofed and enclosed, so matches continue in light rain." },
        { question: "Do you provide an umpire?", answer: "Not by default — you can add one via the 'Scoreboard operator' add-on desk on request." },
      ],
      tags: ["cricket", "box-cricket", "udaipur", "turf", "indoor"],

      priceTiers: [
        { id: "tier-weekday-day", label: "Weekday (Day)", amount: 800 },
        { id: "tier-weekday-night", label: "Weekday (Night)", amount: 1000 },
        { id: "tier-weekend", label: "Weekend", amount: 1200 },
      ],
      addOns: [
        { id: "addon-ball", label: "Extra match ball", price: 100 },
        { id: "addon-scoreboard", label: "Scoreboard operator", price: 300 },
      ],
      coupons: [{ id: "coupon-first", code: "FIRSTGAME10", discountPercent: 10 }],

      bookingType: "Recurring",
      availableFrom: now,
      availableTill: oneYearFromNow,
      slotsPerDay: 12,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  logger.info({ id: listing._id.toString() }, "Seeded sample listing: Box Cricket Arena");

  await disconnectDatabase();
}

seedSampleListing()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Seed sample listing failed");
    process.exit(1);
  });
