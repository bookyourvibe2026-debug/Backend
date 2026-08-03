import { LastMinuteBoostRule } from "../models/Listing.model";

/**
 * Last Min Boost — the single source of truth for "is this slot discounted right now?".
 *
 * A listing carries zero or more rules, each scoped to one Sport + Court + Slot (or every
 * court hosting that sport, when `courtId` is omitted). The discount itself is never
 * written into slot prices — it is derived here on every read, which is the only way the
 * trigger window can mean anything: a slot starting at 6:00 PM with a 30-minute trigger is
 * full price at 5:29 PM and discounted at 5:30 PM.
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
 * Whether one rule covers this slot at all — enabled, the slot was opted in, the sport
 * matches, and (if the rule targets a specific court) the court matches too. A booking
 * that names no sport is treated as a sport match so the player is never quoted more than
 * the price they were shown; a court-specific rule with no court given is NOT a match,
 * since that would silently apply a single-court discount venue-wide.
 */
export function boostCoversSlot(
  rule: LastMinuteBoostRule | undefined | null,
  slotStart: string,
  sport?: string,
  courtId?: string
): boolean {
  if (!rule?.enabled) return false;
  if (!rule.slotStarts?.includes(slotStart)) return false;
  if (rule.game && sport && rule.game !== sport) return false;
  if (rule.courtId && rule.courtId !== courtId) return false;
  return true;
}

/**
 * The rule currently discounting this slot, or undefined when no deal is running. When
 * several rules match (e.g. a court-specific one and a venue-wide one for the same sport
 * and slot), the court-specific rule wins, then the higher discount.
 */
export function findActiveBoostRule(
  rules: LastMinuteBoostRule[] | undefined | null,
  slotStart: string,
  nowMinutes: number,
  sport?: string,
  courtId?: string
): LastMinuteBoostRule | undefined {
  const matching = (rules ?? []).filter(
    (rule) => boostCoversSlot(rule, slotStart, sport, courtId) && isWindowOpen(slotStart, rule.triggerMins, nowMinutes)
  );
  if (matching.length === 0) return undefined;
  matching.sort((a, b) => {
    if (!!a.courtId !== !!b.courtId) return a.courtId ? -1 : 1;
    return b.discountPct - a.discountPct;
  });
  return matching[0];
}

/** The live discount for a slot, or 0 when no deal is running. Caller checks the slot is unbooked. */
export function activeBoostPct(
  rules: LastMinuteBoostRule[] | undefined | null,
  slotStart: string,
  nowMinutes: number,
  sport?: string,
  courtId?: string
): number {
  const rule = findActiveBoostRule(rules, slotStart, nowMinutes, sport, courtId);
  return rule ? clampBoostPct(rule.discountPct) : 0;
}
