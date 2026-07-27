import { LastMinBoost } from "../models/Listing.model";

/**
 * Last Min Boost — the single source of truth for "is this slot discounted right now?".
 *
 * The vendor's rule is stored on the listing; the discount itself is never written into
 * slot prices. It is derived here on every read, which is the only way the trigger window
 * can mean anything: a slot starting at 6:00 PM with a 30-minute trigger is full price at
 * 5:29 PM and discounted at 5:30 PM.
 *
 * Mirrored on the client in lib/lastMinBoost.ts — keep the two in step.
 */

export const BOOST_MIN_PCT = 10;
export const BOOST_MAX_PCT = 30;

/** Minutes since midnight for a "HH:mm" time. */
function toMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
}

/** The discount band is a product rule, so clamp on read too — stored data can predate it. */
export function clampBoostPct(pct: number): number {
  return Math.min(BOOST_MAX_PCT, Math.max(BOOST_MIN_PCT, Math.round(pct)));
}

/** Price after the boost, never below ₹1. */
export function boostedPrice(basePrice: number, discountPct: number): number {
  return Math.max(1, Math.round((basePrice * (100 - clampBoostPct(discountPct))) / 100));
}

/**
 * Whether `now` falls inside the deal window for a slot: [start - triggerMins, start).
 * Handled on a 24-hour circle so a 00:30 slot with a 60-minute trigger correctly opens
 * at 23:30 the evening before.
 */
export function isWindowOpen(slotStart: string, triggerMins: number, nowMinutes: number): boolean {
  const start = toMinutes(slotStart);
  const opensAt = start - triggerMins;
  if (opensAt < 0) return nowMinutes >= opensAt + 1440 || nowMinutes < start;
  return nowMinutes >= opensAt && nowMinutes < start;
}

/**
 * Whether the boost covers this slot at all — enabled, the slot was opted in, and the
 * sport matches. A booking that names no sport is treated as a match so the player is
 * never quoted more than the price they were shown.
 */
export function boostCoversSlot(
  boost: LastMinBoost | undefined | null,
  slotStart: string,
  sport?: string
): boolean {
  if (!boost?.enabled) return false;
  if (!boost.slotStarts?.includes(slotStart)) return false;
  if (boost.game && sport && boost.game !== sport) return false;
  return true;
}

/** The live discount for a slot, or 0 when no deal is running. Caller checks the slot is unbooked. */
export function activeBoostPct(
  boost: LastMinBoost | undefined | null,
  slotStart: string,
  nowMinutes: number,
  sport?: string
): number {
  if (!boostCoversSlot(boost, slotStart, sport)) return 0;
  if (!isWindowOpen(slotStart, boost!.triggerMins, nowMinutes)) return 0;
  return clampBoostPct(boost!.discountPct);
}
