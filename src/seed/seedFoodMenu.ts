import { connectDatabase, disconnectDatabase } from "../config/db";
import { logger } from "../config/logger";
import { VendorModel } from "../models/Vendor.model";
import { MenuItemModel } from "../models/MenuItem.model";

const VENDOR_EMAIL = "senpriyansh414@gmail.com";

const FOOD_PACKAGES = [
  {
    name: "Classic Margherita Pizza",
    description: "Wood-fired pizza with mozzarella, basil, and tomato sauce.",
    price: 249,
    category: "Pizza",
    prepTimeMins: 20,
  },
  {
    name: "Farmhouse Pizza",
    description: "Loaded with onion, capsicum, mushroom, and corn.",
    price: 299,
    category: "Pizza",
    prepTimeMins: 22,
  },
  {
    name: "Peri Peri Fries",
    description: "Crispy fries tossed in peri peri seasoning.",
    price: 129,
    category: "Sides",
    prepTimeMins: 10,
  },
  {
    name: "Cheesy Nachos",
    description: "Loaded nachos with cheese sauce, jalapenos, and salsa.",
    price: 179,
    category: "Sides",
    prepTimeMins: 12,
  },
  {
    name: "Paneer Tikka Roll",
    description: "Grilled paneer tikka wrapped in a soft rumali roti.",
    price: 159,
    category: "Rolls & Wraps",
    prepTimeMins: 15,
  },
  {
    name: "Chicken Seekh Roll",
    description: "Smoky chicken seekh kebab rolled with mint chutney.",
    price: 189,
    category: "Rolls & Wraps",
    prepTimeMins: 15,
  },
  {
    name: "Veg Burger Combo",
    description: "Crispy veg patty burger served with fries and a soft drink.",
    price: 219,
    category: "Combos",
    prepTimeMins: 18,
  },
  {
    name: "Chicken Burger Combo",
    description: "Grilled chicken patty burger served with fries and a soft drink.",
    price: 259,
    category: "Combos",
    prepTimeMins: 18,
  },
  {
    name: "Cold Coffee",
    description: "Chilled coffee blended with ice cream.",
    price: 99,
    category: "Beverages",
    prepTimeMins: 5,
  },
  {
    name: "Fresh Lime Soda",
    description: "Refreshing lime soda, sweet or salted.",
    price: 79,
    category: "Beverages",
    prepTimeMins: 5,
  },
];

async function seedFoodMenu() {
  await connectDatabase();

  const vendor = await VendorModel.findOne({ email: VENDOR_EMAIL });
  if (!vendor) {
    throw new Error(`No vendor found with email ${VENDOR_EMAIL}. Create the vendor first.`);
  }

  let touched = false;
  if (!vendor.verticals.includes("food")) {
    vendor.verticals = [...vendor.verticals, "food"];
    touched = true;
  }
  if (vendor.status !== "approved") {
    vendor.status = "approved";
    vendor.approvedOn = new Date();
    touched = true;
  }
  if (touched) {
    await vendor.save();
    logger.info({ id: vendor._id.toString() }, "Updated vendor to be a live food vendor");
  }

  for (const pkg of FOOD_PACKAGES) {
    await MenuItemModel.findOneAndUpdate(
      { vendorId: vendor._id, name: pkg.name },
      { ...pkg, vendorId: vendor._id, inStock: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  logger.info({ vendorId: vendor._id.toString(), count: FOOD_PACKAGES.length }, "Seeded food packages");

  await disconnectDatabase();
}

seedFoodMenu()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Seed food menu failed");
    process.exit(1);
  });
