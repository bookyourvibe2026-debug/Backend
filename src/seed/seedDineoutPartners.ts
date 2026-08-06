/**
 * Seeds the Dineout marketplace with a handful of partner restaurants.
 *
 * Each partner gets a real, loginable food-vendor account, one `kind: "dining"` outlet
 * with photos + opening hours + dineout settings, and a full menu. Everything is upserted
 * by a stable key (vendor email, outlet name, dish name), so re-running the script updates
 * the existing rows instead of creating duplicates. Nothing is ever deleted.
 *
 *   npm run seed:dineout
 *
 * Photos come from Pexels when PEXELS_API_KEY is set, and fall back to generated gradient
 * cards otherwise — the seed never leaves an outlet with broken images.
 */
import { connectDatabase, disconnectDatabase } from "../config/db";
import { logger } from "../config/logger";
import { FoodOutletModel, OutletWeeklyDay } from "../models/FoodOutlet.model";
import { MenuItemModel } from "../models/MenuItem.model";
import { VendorModel } from "../models/Vendor.model";
import { hashPassword } from "../utils/password";

interface SeedDish {
  name: string;
  description: string;
  price: number;
  category: string;
  prepTimeMins: number;
}

interface SeedPartner {
  /** Vendor login — handed to the restaurant owner. */
  ownerName: string;
  businessName: string;
  email: string;
  phone: string;
  password: string;
  city: string;
  state: string;
  /** The customer-facing restaurant. */
  outletName: string;
  description: string;
  offer: string;
  cuisines: string[];
  area: string;
  address: string;
  lat: number;
  lng: number;
  opensAt: string;
  closesAt: string;
  costForTwo: number;
  flatDiscountPct: number;
  slotMinutes: number;
  tablesPerSlot: number;
  maxPartySize: number;
  /** Pexels searches: [ambience, food]. Three ambience shots + two food shots per outlet. */
  photoQueries: [string, string];
  categoryPrepTimes: Array<{ category: string; prepTimeMins: number }>;
  menu: SeedDish[];
}

const PARTNERS: SeedPartner[] = [
  {
    ownerName: "Rehan Mirza",
    businessName: "Marigold Hospitality",
    email: "marigold.rooftop@bookyourvibe.in",
    phone: "9000000101",
    password: "Marigold@2026",
    city: "Udaipur",
    state: "Rajasthan",
    outletName: "Marigold Rooftop Kitchen",
    description:
      "A candle-lit rooftop above Lake Palace Road with an open kitchen, a wood-fired grill, and live acoustic sets on weekends. The terrace looks straight out over the old city, so sunset tables go first.",
    offer: "Flat 15% off for BYV players",
    cuisines: ["North Indian", "Continental", "Mediterranean", "Desserts"],
    area: "Lake Palace Road",
    address: "3rd Floor, Ashoka Haveli, Lake Palace Road, Udaipur, Rajasthan 313001",
    lat: 24.5761,
    lng: 73.6791,
    opensAt: "09:00",
    closesAt: "23:45",
    costForTwo: 1400,
    flatDiscountPct: 15,
    slotMinutes: 90,
    tablesPerSlot: 12,
    maxPartySize: 16,
    photoQueries: ["rooftop restaurant evening lights", "grilled kebab platter restaurant"],
    categoryPrepTimes: [
      { category: "Starters", prepTimeMins: 18 },
      { category: "From the Grill", prepTimeMins: 25 },
      { category: "Main Course", prepTimeMins: 22 },
      { category: "Desserts", prepTimeMins: 12 },
      { category: "Beverages", prepTimeMins: 6 },
    ],
    menu: [
      {
        name: "Marigold Mezze Platter",
        description: "Hummus, muhammara, labneh and beetroot dip with warm pita and olives.",
        price: 520,
        category: "Starters",
        prepTimeMins: 15,
      },
      {
        name: "Smoked Paneer Tikka",
        description: "Hung-curd marinade, charcoal finish, mint chutney and pickled onion.",
        price: 440,
        category: "Starters",
        prepTimeMins: 18,
      },
      {
        name: "Rooftop Grill Platter",
        description: "Chef's assortment of veg and chicken kebabs with charred vegetables.",
        price: 890,
        category: "From the Grill",
        prepTimeMins: 28,
      },
      {
        name: "Lemon Herb Chicken Steak",
        description: "Grilled breast, rosemary jus, mashed potato and buttered greens.",
        price: 720,
        category: "From the Grill",
        prepTimeMins: 25,
      },
      {
        name: "Dal Marigold",
        description: "Black lentils simmered overnight, finished with white butter and cream.",
        price: 380,
        category: "Main Course",
        prepTimeMins: 20,
      },
      {
        name: "Truffle Mushroom Risotto",
        description: "Arborio rice, wild mushrooms, parmesan and a drizzle of truffle oil.",
        price: 610,
        category: "Main Course",
        prepTimeMins: 24,
      },
      {
        name: "Molten Chocolate Dome",
        description: "Warm dark chocolate centre with vanilla bean ice cream.",
        price: 340,
        category: "Desserts",
        prepTimeMins: 12,
      },
      {
        name: "Saffron Pista Kulfi",
        description: "Slow-set kulfi with saffron, pistachio and rose falooda.",
        price: 260,
        category: "Desserts",
        prepTimeMins: 8,
      },
      {
        name: "Sunset Cooler",
        description: "Orange, mint and lime over crushed ice with a chilli-salt rim.",
        price: 220,
        category: "Beverages",
        prepTimeMins: 6,
      },
      {
        name: "Masala Chai (Pot for Two)",
        description: "Kadak chai brewed with ginger, cardamom and lemongrass.",
        price: 180,
        category: "Beverages",
        prepTimeMins: 8,
      },
    ],
  },
  {
    ownerName: "Sunita Rathore",
    businessName: "Haveli Chulha Hospitality",
    email: "haveli.chulha@bookyourvibe.in",
    phone: "9000000102",
    password: "Haveli@2026",
    city: "Udaipur",
    state: "Rajasthan",
    outletName: "Haveli Chulha",
    description:
      "A 90-year-old haveli courtyard serving a proper Mewari thali — bajra roti off the chulha, ker sangri, laal maas and gatte ki sabzi, refilled until you give up. Folk music every evening from 7 PM.",
    offer: "Flat 12% off for BYV players",
    cuisines: ["Rajasthani", "North Indian", "Thali", "Pure Veg"],
    area: "Chandpole",
    address: "Near Chandpole Gate, Brahmpuri Road, Udaipur, Rajasthan 313001",
    lat: 24.5854,
    lng: 73.682,
    opensAt: "08:00",
    closesAt: "23:00",
    costForTwo: 850,
    flatDiscountPct: 12,
    slotMinutes: 60,
    tablesPerSlot: 18,
    maxPartySize: 24,
    photoQueries: ["traditional indian courtyard restaurant", "indian thali food platter"],
    categoryPrepTimes: [
      { category: "Thali", prepTimeMins: 25 },
      { category: "Mewari Specials", prepTimeMins: 22 },
      { category: "Breads", prepTimeMins: 10 },
      { category: "Sweets", prepTimeMins: 8 },
      { category: "Beverages", prepTimeMins: 5 },
    ],
    menu: [
      {
        name: "Royal Mewari Thali",
        description: "Unlimited thali — 4 sabzi, dal baati churma, kadhi, rice, breads and two sweets.",
        price: 649,
        category: "Thali",
        prepTimeMins: 25,
      },
      {
        name: "Chulha Special Veg Thali",
        description: "Everyday thali with 3 sabzi, dal, rice, salad, papad and one sweet.",
        price: 399,
        category: "Thali",
        prepTimeMins: 20,
      },
      {
        name: "Dal Baati Churma",
        description: "Wood-fired baati soaked in ghee, panchmel dal and hand-crushed churma.",
        price: 320,
        category: "Mewari Specials",
        prepTimeMins: 22,
      },
      {
        name: "Ker Sangri",
        description: "Desert berries and beans tempered with red chilli and mustard.",
        price: 280,
        category: "Mewari Specials",
        prepTimeMins: 18,
      },
      {
        name: "Gatte Ki Sabzi",
        description: "Gram-flour dumplings in a spiced yoghurt curry.",
        price: 260,
        category: "Mewari Specials",
        prepTimeMins: 20,
      },
      {
        name: "Bajra Roti with White Butter",
        description: "Millet roti off the chulha, served with a knob of home-churned butter.",
        price: 90,
        category: "Breads",
        prepTimeMins: 10,
      },
      {
        name: "Missi Roti",
        description: "Gram-flour and wheat roti with ajwain and green chilli.",
        price: 80,
        category: "Breads",
        prepTimeMins: 10,
      },
      {
        name: "Malpua with Rabri",
        description: "Warm saffron malpua served with thick rabri.",
        price: 210,
        category: "Sweets",
        prepTimeMins: 12,
      },
      {
        name: "Ghevar",
        description: "Traditional honeycomb ghevar topped with pistachio.",
        price: 190,
        category: "Sweets",
        prepTimeMins: 6,
      },
      {
        name: "Masala Chaas",
        description: "Chilled buttermilk with roasted cumin, curry leaf and black salt.",
        price: 90,
        category: "Beverages",
        prepTimeMins: 5,
      },
    ],
  },
  {
    ownerName: "Aditya Nair",
    businessName: "Bean & Basil Hospitality",
    email: "bean.basil@bookyourvibe.in",
    phone: "9000000103",
    password: "BeanBasil@2026",
    city: "Udaipur",
    state: "Rajasthan",
    outletName: "Bean & Basil Cafe",
    description:
      "A bright, plant-filled all-day cafe a two-minute walk from Fateh Sagar. Single-origin pour-overs, a sourdough counter, fast Wi-Fi and plug points at every table — the go-to for long work mornings and lazy brunches.",
    offer: "Flat 10% off for BYV players",
    cuisines: ["Cafe", "Italian", "Continental", "Bakery", "Beverages"],
    area: "Fateh Sagar",
    address: "12 Rani Road, opposite Fateh Sagar Lake, Udaipur, Rajasthan 313004",
    lat: 24.5975,
    lng: 73.679,
    opensAt: "07:30",
    closesAt: "23:30",
    costForTwo: 700,
    flatDiscountPct: 10,
    slotMinutes: 60,
    tablesPerSlot: 14,
    maxPartySize: 10,
    photoQueries: ["bright plant filled cafe interior", "brunch coffee pastry table"],
    categoryPrepTimes: [
      { category: "Coffee", prepTimeMins: 6 },
      { category: "All-Day Brunch", prepTimeMins: 18 },
      { category: "Pizza & Pasta", prepTimeMins: 20 },
      { category: "Bakery", prepTimeMins: 5 },
    ],
    menu: [
      {
        name: "Single-Origin Pour Over",
        description: "Rotating Indian estate beans, brewed to order. Ask for today's lot.",
        price: 260,
        category: "Coffee",
        prepTimeMins: 8,
      },
      {
        name: "Honey Oat Latte",
        description: "Double shot, oat milk and a spoon of wild honey.",
        price: 240,
        category: "Coffee",
        prepTimeMins: 6,
      },
      {
        name: "House Cold Brew",
        description: "Twenty-hour steep, served over a single clear ice block.",
        price: 220,
        category: "Coffee",
        prepTimeMins: 4,
      },
      {
        name: "Sourdough Shakshuka",
        description: "Eggs baked in spiced tomato with feta, herbs and toasted sourdough.",
        price: 420,
        category: "All-Day Brunch",
        prepTimeMins: 20,
      },
      {
        name: "Avocado & Feta Toast",
        description: "Smashed avocado, whipped feta, chilli flakes and microgreens.",
        price: 380,
        category: "All-Day Brunch",
        prepTimeMins: 15,
      },
      {
        name: "Big Basil Breakfast",
        description: "Two eggs your way, hash browns, grilled tomato, beans and toast.",
        price: 440,
        category: "All-Day Brunch",
        prepTimeMins: 18,
      },
      {
        name: "Margherita Sourdough Pizza",
        description: "San Marzano tomato, fior di latte and fresh basil on a 48-hour base.",
        price: 460,
        category: "Pizza & Pasta",
        prepTimeMins: 22,
      },
      {
        name: "Basil Pesto Penne",
        description: "House pesto, cherry tomatoes, toasted pine nuts and parmesan.",
        price: 420,
        category: "Pizza & Pasta",
        prepTimeMins: 20,
      },
      {
        name: "Burnt Basque Cheesecake",
        description: "Caramelised top, custardy centre. Sells out most evenings.",
        price: 320,
        category: "Bakery",
        prepTimeMins: 5,
      },
      {
        name: "Cinnamon Roll",
        description: "Soft, laminated and finished with cream cheese glaze.",
        price: 190,
        category: "Bakery",
        prepTimeMins: 5,
      },
    ],
  },
  {
    ownerName: "Karan Chandel",
    businessName: "Copper Lane Hospitality",
    email: "copper.lane@bookyourvibe.in",
    phone: "9000000104",
    password: "Copper@2026",
    city: "Udaipur",
    state: "Rajasthan",
    outletName: "Copper Lane Social",
    description:
      "A loud, happy brick-and-copper gastropub in Hiran Magri built for after-match plans — big sharing boards, a long bar, screens for live sport and a resident DJ from 9 PM on Fridays and Saturdays.",
    offer: "Flat 12% off for BYV players",
    cuisines: ["Continental", "Asian", "Pub Fare", "Bar"],
    area: "Hiran Magri",
    address: "Sector 11, Hiran Magri, Udaipur, Rajasthan 313002",
    lat: 24.561,
    lng: 73.702,
    opensAt: "09:00",
    closesAt: "23:45",
    costForTwo: 1200,
    flatDiscountPct: 12,
    slotMinutes: 90,
    tablesPerSlot: 16,
    maxPartySize: 20,
    photoQueries: ["industrial gastropub bar interior", "loaded nachos burger sharing platter"],
    categoryPrepTimes: [
      { category: "Sharing Boards", prepTimeMins: 18 },
      { category: "Burgers & Mains", prepTimeMins: 22 },
      { category: "Asian Street", prepTimeMins: 18 },
      { category: "Bar Bites", prepTimeMins: 10 },
      { category: "Coolers & Mocktails", prepTimeMins: 8 },
    ],
    menu: [
      {
        name: "Copper Lane Loaded Nachos",
        description: "Cheddar sauce, jalapenos, pico de gallo, sour cream and black beans.",
        price: 420,
        category: "Sharing Boards",
        prepTimeMins: 15,
      },
      {
        name: "Game Night Platter",
        description: "Wings, fries, nachos, chilli cheese toast and two dips. Feeds four.",
        price: 890,
        category: "Sharing Boards",
        prepTimeMins: 25,
      },
      {
        name: "Smoky BBQ Chicken Wings",
        description: "Six pieces, slow-smoked and tossed in house BBQ glaze.",
        price: 460,
        category: "Sharing Boards",
        prepTimeMins: 20,
      },
      {
        name: "Double Smash Burger",
        description: "Two seared patties, cheddar, burger sauce and skin-on fries.",
        price: 590,
        category: "Burgers & Mains",
        prepTimeMins: 22,
      },
      {
        name: "Crispy Paneer Burger",
        description: "Panko paneer, slaw, sriracha mayo and fries.",
        price: 490,
        category: "Burgers & Mains",
        prepTimeMins: 20,
      },
      {
        name: "Bangkok Basil Rice",
        description: "Wok-tossed rice with holy basil, chilli and a fried egg on top.",
        price: 440,
        category: "Asian Street",
        prepTimeMins: 18,
      },
      {
        name: "Chilli Garlic Noodles",
        description: "Hakka noodles tossed with burnt garlic, chilli oil and spring onion.",
        price: 380,
        category: "Asian Street",
        prepTimeMins: 16,
      },
      {
        name: "Peri Peri Cheese Fries",
        description: "Crispy fries under molten cheese and peri peri dust.",
        price: 290,
        category: "Bar Bites",
        prepTimeMins: 12,
      },
      {
        name: "Masala Peanut Chaat",
        description: "Crunchy peanuts tossed with onion, tomato, lime and coriander.",
        price: 180,
        category: "Bar Bites",
        prepTimeMins: 8,
      },
      {
        name: "Virgin Mojito Pitcher",
        description: "Mint, lime and soda by the pitcher — built for a table of four.",
        price: 420,
        category: "Coolers & Mocktails",
        prepTimeMins: 8,
      },
    ],
  },
];

/** All seven days on the same hours — dining outlets here trade every day. */
function weeklyHours(startTime: string, endTime: string): OutletWeeklyDay[] {
  return Array.from({ length: 7 }, (_, day) => ({ day, isOpen: true, startTime, endTime }));
}

/** Gradient placeholder used when Pexels is unavailable, so a card is never image-less. */
function gradientCard(title: string, from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${from}" /><stop offset="100%" stop-color="${to}" />
    </linearGradient></defs>
    <rect width="1200" height="800" fill="url(#g)" />
    <circle cx="210" cy="190" r="110" fill="rgba(255,255,255,0.10)" />
    <circle cx="980" cy="610" r="180" fill="rgba(255,255,255,0.08)" />
    <text x="64" y="120" fill="rgba(255,255,255,0.9)" font-size="44" font-weight="700" font-family="Arial, sans-serif">${title}</text>
    <text x="64" y="690" fill="rgba(255,255,255,0.75)" font-size="26" font-weight="600" font-family="Arial, sans-serif">BookYourVibe Dineout</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function searchPexels(query: string, count: number): Promise<string[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`;
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) {
      logger.warn({ query, status: res.status }, "Pexels search failed — using gradient fallback");
      return [];
    }
    const body = (await res.json()) as { photos?: Array<{ src?: { large2x?: string; large?: string } }> };
    return (body.photos ?? [])
      .map((photo) => photo.src?.large2x ?? photo.src?.large)
      .filter((src): src is string => Boolean(src));
  } catch (err) {
    logger.warn({ err, query }, "Pexels request errored — using gradient fallback");
    return [];
  }
}

/** Three ambience shots + two plated-food shots, with gradient cards padding any shortfall. */
async function buildImages(partner: SeedPartner): Promise<{ hero: string; gallery: string[] }> {
  const [ambience, food] = await Promise.all([
    searchPexels(partner.photoQueries[0], 3),
    searchPexels(partner.photoQueries[1], 2),
  ]);
  const photos = [...ambience, ...food];
  const fallbacks = [
    gradientCard(partner.outletName, "#0f172a", "#14532d"),
    gradientCard(`${partner.outletName} — Dining`, "#1f2937", "#7c2d12"),
    gradientCard(`${partner.outletName} — Kitchen`, "#312e81", "#0f766e"),
    gradientCard(`${partner.outletName} — Table`, "#3f2c1f", "#7c4a25"),
    gradientCard(`${partner.outletName} — Bar`, "#111827", "#4c1d95"),
  ];
  while (photos.length < 5) photos.push(fallbacks[photos.length]!);

  return { hero: photos[0]!, gallery: photos.slice(0, 5) };
}

async function upsertVendor(partner: SeedPartner) {
  const existing = await VendorModel.findOne({ email: partner.email });
  const verticals = Array.from(new Set([...(existing?.verticals ?? []), "food"]));

  if (existing) {
    existing.set({
      ownerName: partner.ownerName,
      businessName: partner.businessName,
      phone: partner.phone,
      state: partner.state,
      city: partner.city,
      verticals,
      status: "approved",
      approvedOn: existing.approvedOn ?? new Date(),
      businessType: "Individual / Proprietor",
      categories: partner.cuisines,
      address: { street: partner.address, country: "India" },
      // Reset the password so the handed-out credentials always work.
      passwordHash: await hashPassword(partner.password),
    });
    await existing.save();
    return { vendor: existing, created: false };
  }

  const vendor = await VendorModel.create({
    ownerName: partner.ownerName,
    businessName: partner.businessName,
    email: partner.email,
    phone: partner.phone,
    passwordHash: await hashPassword(partner.password),
    state: partner.state,
    city: partner.city,
    verticals: ["food"],
    status: "approved",
    approvedOn: new Date(),
    businessType: "Individual / Proprietor",
    categories: partner.cuisines,
    address: { street: partner.address, country: "India" },
  });
  return { vendor, created: true };
}

async function seedDineoutPartners() {
  await connectDatabase();

  const summary: Array<Record<string, string>> = [];

  for (const partner of PARTNERS) {
    const { vendor, created } = await upsertVendor(partner);
    const { hero, gallery } = await buildImages(partner);

    // Keyed on vendor + name so a re-run refreshes the same restaurant.
    const outlet =
      (await FoodOutletModel.findOne({ vendorId: vendor._id, name: partner.outletName })) ??
      new FoodOutletModel({ vendorId: vendor._id, name: partner.outletName });

    outlet.set({
      kind: "dining",
      offer: partner.offer,
      description: partner.description,
      cuisines: partner.cuisines,
      logo: hero,
      banner: hero,
      poster: hero,
      gallery,
      location: {
        address: partner.address,
        area: partner.area,
        city: partner.city,
        lat: partner.lat,
        lng: partner.lng,
      },
      weeklyAvailability: weeklyHours(partner.opensAt, partner.closesAt),
      categoryPrepTimes: partner.categoryPrepTimes,
      dineout: {
        tableBooking: true,
        payBill: true,
        flatDiscountPct: partner.flatDiscountPct,
        slotMinutes: partner.slotMinutes,
        tablesPerSlot: partner.tablesPerSlot,
        maxPartySize: partner.maxPartySize,
        advanceDays: 30,
        costForTwo: partner.costForTwo,
        autoConfirm: true,
      },
      serviceBufferMins: 5,
      // Dining partners are walk-in-and-sit-down: no court-side delivery.
      fulfilment: { preOrder: false, inVenue: false, postMatch: false, dineIn: true },
      status: "Active",
    });
    await outlet.save();

    for (const dish of partner.menu) {
      await MenuItemModel.findOneAndUpdate(
        { outletId: outlet._id, name: dish.name },
        {
          ...dish,
          vendorId: vendor._id,
          outletId: outlet._id,
          inStock: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    summary.push({
      restaurant: partner.outletName,
      slug: outlet.slug ?? "",
      email: partner.email,
      password: partner.password,
      vendor: created ? "created" : "updated",
      dishes: String(partner.menu.length),
    });

    logger.info(
      { outlet: partner.outletName, slug: outlet.slug, vendorId: vendor._id.toString(), dishes: partner.menu.length },
      created ? "Created dineout partner" : "Updated dineout partner"
    );
  }

  logger.info("Dineout partner seed complete");
  // eslint-disable-next-line no-console
  console.table(summary);

  await disconnectDatabase();
}

seedDineoutPartners()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Dineout partner seed failed");
    process.exit(1);
  });
