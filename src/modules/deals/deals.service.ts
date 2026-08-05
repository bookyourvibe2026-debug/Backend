import { Court, ListingModel } from "../../models/Listing.model";
import { IST, getBookedRangesForDates, istTimeHHmm, rangesOverlap, timeToMinutes, bookableCourts, type BookedRange } from "../../services/booking.service";
import { boostedPrice, clampBoostPct, isWindowOpen } from "../../services/lastMinBoost.service";

export interface LastMinuteDealDto {
  /** Composite id: `${listingId}:${ruleId}:${courtId ?? "any"}` — unique per card. */
  id: string;
  listingId: string;
  slug?: string;
  title: string;
  city?: string;
  coverImage?: string;
  sport: string;
  courtId?: string;
  courtName?: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  /** ISO datetime the slot starts at, in IST — the client computes its countdown from this. */
  slotStartsAt: string;
  originalPrice: number;
  discountedPrice: number;
  discountPct: number;
  triggerMins: number;
}

/** Which of a listing's courts are still free for one slot window, given its booked ranges. */
function isCourtFree(
  ranges: BookedRange[],
  slotStart: number,
  slotEnd: number,
  courtId: string | undefined,
  courts: Court[]
): boolean {
  const taken = new Set(
    ranges
      .filter((r) => {
        const rStart = timeToMinutes(r.startTime);
        const rEnd = timeToMinutes(r.endTime);
        return rangesOverlap(slotStart, slotEnd, rStart, rEnd);
      })
      .map((r) => r.courtId || courts[0]?.id)
  );
  return !taken.has(courtId || courts[0]?.id);
}

/**
 * Every Last Minute Boost rule currently inside its trigger window, for a slot that is
 * still genuinely bookable (checked against real bookings, not just `slot.blocked`). One
 * DTO per (listing, rule, court) — a rule with no `courtId` fans out into one card per
 * active court that hosts the rule's sport.
 */
export async function getActiveLastMinuteDeals(): Promise<LastMinuteDealDto[]> {
  const listings = await ListingModel.find({
    status: "Active",
    isPrivate: false,
    type: { $in: ["Turf", "Game"] },
    "lastMinBoosts.enabled": true,
  }).lean();

  const nowIst = new Date();
  const dateStr = nowIst.toLocaleDateString("en-CA", { timeZone: IST });
  const nowMin = timeToMinutes(istTimeHHmm(nowIst));

  const deals: LastMinuteDealDto[] = [];

  // One batched query for every boosted listing's booked ranges today, instead of one
  // query per listing inside the loop — this endpoint is polled every ~8-10s per client.
  const rangesByListing = await getBookedRangesForDates(
    listings.map((l) => String(l._id)),
    dateStr
  );

  for (const listing of listings) {
    const override = listing.dateOverrides?.find((o) => o.date === dateStr);
    if (override?.isHoliday) continue;
    const slots = override ? override.slots : listing.slotsList;
    if (!slots?.length) continue;

    const courts = listing.courts ?? [];
    const bookedRanges = rangesByListing.get(String(listing._id)) ?? [];

    for (const rule of listing.lastMinBoosts ?? []) {
      if (!rule.enabled) continue;

      for (const slotStart of rule.slotStarts) {
        if (!isWindowOpen(slotStart, rule.triggerMins, nowMin)) continue;

        const slot = slots.find((s) => s.startTime === slotStart);
        if (!slot || slot.blocked) continue;

        const slotStartMin = timeToMinutes(slot.startTime);
        const slotEndMin = timeToMinutes(slot.endTime);
        const originalPrice = slot.price > 0 ? slot.price : listing.price;
        const discountedPrice = boostedPrice(originalPrice, rule.discountPct);

        const candidateCourts: (Court | undefined)[] = rule.courtId
          ? [courts.find((c) => c.id === rule.courtId && c.active)]
          : courts.length > 0
            ? bookableCourts(courts, rule.game)
            : [undefined];

        for (const court of candidateCourts) {
          if (rule.courtId && !court) continue; // the boosted court no longer exists/active
          if (!isCourtFree(bookedRanges, slotStartMin, slotEndMin, court?.id, courts)) continue;

          deals.push({
            id: `${listing._id}:${rule.id}:${court?.id ?? "any"}`,
            listingId: String(listing._id),
            slug: listing.slug,
            title: listing.title,
            city: listing.city,
            coverImage: listing.coverImage,
            sport: rule.game,
            courtId: court?.id,
            courtName: court?.name,
            date: dateStr,
            slotStart: slot.startTime,
            slotEnd: slot.endTime,
            slotStartsAt: new Date(`${dateStr}T${slot.startTime}:00+05:30`).toISOString(),
            originalPrice,
            discountedPrice,
            discountPct: clampBoostPct(rule.discountPct),
            triggerMins: rule.triggerMins,
          });
        }
      }
    }
  }

  deals.sort((a, b) => a.slotStartsAt.localeCompare(b.slotStartsAt) || b.discountPct - a.discountPct);
  return deals;
}
