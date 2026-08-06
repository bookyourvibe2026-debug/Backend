import { CategoryPrepTime } from "../models/FoodOutlet.model";

/**
 * Fallback prep times, in minutes, when the Food Owner hasn't set one for a category.
 * Mirrors the client brief: fast items ~5 min, hot food ~15 min.
 */
const DEFAULT_CATEGORY_PREP_MINS: Record<string, number> = {
  beverages: 5,
  "juices & shakes": 5,
  "shakes & ice cream": 5,
  desserts: 5,
  "desserts & bakery": 5,
  snacks: 8,
  "snacks & chaat": 8,
  starters: 12,
  "fast food": 12,
  "burgers & sandwiches": 12,
  breads: 10,
  "rolls & momos": 12,
  "main course": 15,
  chinese: 15,
  "rice & biryani": 20,
  biryani: 20,
  "pizza & pasta": 18,
  combos: 20,
};

/** Used when neither the owner nor the preset table knows the category. */
export const FALLBACK_PREP_MINS = 15;

/** The owner's default for a category, else a sensible preset, else the fallback. */
export function prepTimeForCategory(category: string, categoryPrepTimes: CategoryPrepTime[] = []): number {
  const key = (category || "").trim().toLowerCase();
  const owned = categoryPrepTimes.find((c) => c.category.trim().toLowerCase() === key);
  if (owned && Number.isFinite(owned.prepTimeMins)) return owned.prepTimeMins;
  return DEFAULT_CATEGORY_PREP_MINS[key] ?? FALLBACK_PREP_MINS;
}

/**
 * ETA for a whole basket. The kitchen cooks in parallel, so the order is ready when
 * its slowest dish is — not the sum of every dish. A courtside/table delivery adds the
 * outlet's service buffer on top; counter pickup does not.
 */
export function estimateOrderEtaMins(input: {
  lines: { category: string; prepTimeMins?: number }[];
  categoryPrepTimes?: CategoryPrepTime[];
  serviceBufferMins?: number;
  /** Only in-venue and dine-in orders are carried to the player. */
  addServiceBuffer?: boolean;
}): number {
  if (input.lines.length === 0) return 0;
  const slowest = Math.max(
    ...input.lines.map((line) =>
      line.prepTimeMins && line.prepTimeMins > 0
        ? line.prepTimeMins
        : prepTimeForCategory(line.category, input.categoryPrepTimes)
    )
  );
  const buffer = input.addServiceBuffer ? input.serviceBufferMins ?? 5 : 0;
  return slowest + buffer;
}
