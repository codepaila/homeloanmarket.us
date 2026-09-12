/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/broker-listing.ts
//
// Live business-priority ordering for the public broker listing.
//
// MongoDB cannot express "has an active paid subscription" inside a Prisma
// orderBy (the subscription is a related document whose entitlement also
// depends on plan + endDate at query time), so the listing page orders with a
// small aggregation that mirrors the radius search path (lib/location/broker-geo.ts).
// It resolves the SAME public eligibility + search + filter conditions as the
// Prisma `where`, then computes two live flags before sorting:
//
//   featured  -> 1 when ANY subscription is FEATURED + active + not expired
//                (identical to hasPaidEntitlement; an expired/cancelled/absent
//                 subscription never sets it)
//   hasImage  -> 1 when profileImage OR logo is a non-empty value (matches what
//                the listing card actually renders via `profileImage || logo`)
//   tier      -> 1 = paid active subscription, 2 = admin-enabled Mortgage
//                Expert (no paid plan), 3 = profile image, 4 = no qualifying
//                signal. Tier is RANK-ONLY: every tier is publicly eligible.
//                A no-image broker (tier 4) is still listed; image presence
//                affects ORDER, never eligibility.
//
// Sort (before skip/take so pagination stays server-side and correct):
//   tier asc, featuredRank desc, experienceYears desc, _id asc
import prisma from '@/lib/prisma'
import { findBrokerIdsWithinRadius } from '@/lib/location/broker-geo'

type PublicListingMatchInput = {
  search?: string | null
  state?: string | null
  zip?: string | null
  minRating?: string | null
  verificationStatus?: string | null
  brokerStatus?: string | null
  minExperience?: string | null
  // radius === 0 "exact location" constraints (verified city/state/zip). Only
  // applied when the corresponding free-text state/zip filter is absent, mirroring
  // the route's Prisma where. Never set for radius searches (geo path).
  locationCity?: string | null
  locationState?: string | null
  locationZip?: string | null
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function regex(value: string) {
  return { $regex: escapeRegex(value), $options: 'i' }
}

// Translates the public broker listing's visibility + search + filter
// conditions into a MongoDB $match. Mirrors the Prisma `where` built in
// app/api/brokers/route.ts so the aggregation page aligns exactly with the
// Prisma count used for totalPages.
function buildListingMatch(input: PublicListingMatchInput, isAdmin: boolean): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = []
  if (!isAdmin) {
    conditions.push({ isVisible: true })
    conditions.push({ brokerStatus: { $ne: 'SUSPENDED' } })
    // Canonical public eligibility (mirrors publicBrokerWhere()):
    // profile completeness, not verification/creationSource as a ranking tier.
    // A self-registered broker with a valid, complete, published profile is public.
    conditions.push({ displayName: { $nin: [null, ''] } })
    conditions.push({ description: { $nin: [null, ''] } })
    conditions.push({ phone: { $nin: [null, ''] } })
    conditions.push({ officeAddress: { $nin: [null, ''] } })
    conditions.push({ profileSlug: { $nin: [null, ''] } })
    // Source-aware verification gate (mirrors publicBrokerWhere()): ADMIN_CREATED
    // brokers are eligible by construction; SELF_REGISTERED (or null-source)
    // brokers must be admin VERIFIED to appear in the listing.
    conditions.push({
      $or: [
        { creationSource: 'ADMIN_CREATED' },
        { verificationStatus: 'VERIFIED' },
      ],
    })
  }
  if (input.search) {
    conditions.push({
      $or: [
        { displayName: regex(input.search) },
        { companyName: regex(input.search) },
        { description: regex(input.search) },
        { officeAddress: regex(input.search) },
        { city: regex(input.search) },
        { state: regex(input.search) },
        { pinCode: regex(input.search) },
      ],
    })
  }
  if (input.state) conditions.push({ state: regex(input.state) })
  if (input.zip) conditions.push({ pinCode: regex(input.zip) })
  if (input.minRating) conditions.push({ avgRating: { $gte: parseFloat(input.minRating) } })
  if (input.verificationStatus) conditions.push({ verificationStatus: input.verificationStatus })
  if (input.brokerStatus) conditions.push({ brokerStatus: input.brokerStatus })
  if (input.minExperience) conditions.push({ experienceYears: { $gte: parseInt(input.minExperience) } })
  // radius === 0 exact-location constraints: a verified city constrains city,
  // a verified state/zip constrains state/pinCode only when not overridden by
  // an explicit free-text filter.
  if (input.locationCity) conditions.push({ city: regex(input.locationCity) })
  if (!input.state && input.locationState) conditions.push({ state: regex(input.locationState) })
  if (!input.zip && input.locationZip) conditions.push({ pinCode: regex(input.locationZip) })
  return conditions.length ? { $and: conditions } : {}
}

function idValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && '$oid' in value && typeof value.$oid === 'string') return value.$oid
  return value == null ? null : String(value)
}

export type PublicListingPageResult = { ids: string[]; total: number }

// Returns the page of broker IDs in business-priority order plus the total
// count, applying the SAME match, ordering and pagination that the listing
// route previously split across count + findMany. Keeps server-side pagination
// (ordering happens before skip/take) without any N+1 queries.
export async function getPublicListingPage(
  matchInput: PublicListingMatchInput,
  opts: { page: number; take: number; admin: boolean },
): Promise<PublicListingPageResult> {
  const match = buildListingMatch(matchInput, opts.admin)
  // $runCommandRaw serializes JS Date to a string, which would corrupt the
  // date comparison below; use the explicit BSON extended-JSON date form.
  const now = { $date: new Date().toISOString() }

  const pipeline: Record<string, unknown>[] = [
    { $match: match },
  ]

  if (!opts.admin) {
    pipeline.push(
      // Owner is required to be active AND not an active Company member (an
      // advertising/company account is never a public broker owner). Unowned
      // (userId: null) brokers are always eligible owner-wise. Mirrors the
      // publicBrokerWhere() ownership clause.
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'owner' } },
      { $lookup: { from: 'company_memberships', localField: 'userId', foreignField: 'userId', as: 'compMem' } },
      { $match: { $or: [{ userId: null }, { $and: [{ owner: { $elemMatch: { isActive: true } } }, { compMem: { $not: { $elemMatch: { isActive: true } } } }] }] } },
    )
  }

  pipeline.push(
    { $lookup: { from: 'broker_subscriptions', localField: '_id', foreignField: 'brokerId', as: 'sub' } },
    {
      $addFields: {
        // Live paid entitlement: any FEATURED + active + not-expired
        // subscription. Expired/cancelled/FREE/absent subscriptions never count.
        featured: {
          $cond: [
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: '$sub',
                      as: 's',
                      cond: {
                        $and: [
                          { $eq: ['$$s.plan', 'FEATURED'] },
                          { $eq: ['$$s.isActive', true] },
                          { $or: [{ $eq: ['$$s.endDate', null] }, { $gt: ['$$s.endDate', now] }] },
                        ],
                      },
                    },
                  },
                },
                0,
              ],
            },
            1,
            0,
          ],
        },
        // Has a usable profile/company image: matches the card's `profileImage || logo`.
        // $type 'string' excludes null AND missing fields (a `$ne` alone would
        // let a missing field through as "has image").
        hasImage: {
          $cond: [
            {
              $or: [
                { $and: [{ $ne: ['$profileImage', ''] }, { $eq: [{ $type: '$profileImage' }, 'string'] }] },
                { $and: [{ $ne: ['$logo', ''] }, { $eq: [{ $type: '$logo' }, 'string'] }] },
              ],
            },
            1,
            0,
          ],
        },
      },
    },
    {
      // Business-priority tier, computed separately from eligibility so the
      // ranked listing can surface only qualifying brokers:
      //   1 = paid active subscription (featured)
      //   2 = admin-enabled Mortgage Expert (no paid plan)
      //   3 = usable profile image
      //   4 = no qualifying signal
      //
      // Deliberately a SECOND aggregation stage: MongoDB resolves a field
      // reference inside the same stage against the input document, not
      // against fields computed earlier in that stage, so `$featured`/`$hasImage`
      // above would always read as missing here (and every broker would fall to
      // tier 4). Splitting the stage materializes them first.
      $addFields: {
        tier: {
          $cond: [
            { $eq: ['$featured', 1] },
            1,
            {
              $cond: [
                { $eq: ['$mortgageExpertEnabled', true] },
                2,
                { $cond: [{ $eq: ['$hasImage', 1] }, 3, 4] },
              ],
            },
          ],
        },
      },
    },
  )

  // Tier is a RANKING signal, never a visibility gate. All four tiers are
  // publicly eligible: a broker without an image, Mortgage Expert badge, or
  // paid subscription is still listed (it simply sorts after higher-ranked
  // brokers). Eligibility is entirely determined by the $match stages above
  // (isVisible, suspension, completeness, ownership). No $match on `tier`.
  pipeline.push({
    $facet: {
      metadata: [{ $count: 'total' }],
      data: [
        { $sort: { tier: 1, featuredRank: -1, experienceYears: -1, _id: 1 } },
        { $skip: opts.take * (opts.page - 1) },
        { $limit: opts.take },
        { $project: { _id: 1 } },
      ],
    },
  })

  const result = await prisma.$runCommandRaw({ aggregate: 'brokers', pipeline, cursor: {} } as any) as any
  const batch = result?.cursor?.firstBatch?.[0] || { metadata: [], data: [] }
  const ids = (batch.data || [])
    .map((row: { _id?: unknown }) => idValue(row._id))
    .filter((id: string | null): id is string => Boolean(id))
  const total = Number(batch.metadata?.[0]?.total || 0)
  return { ids, total }
}

// Radius (miles) for the first, strongest "related brokers" tier. Matches the
// listing's default radius so the nearby pool is consistent with a radius search.
export const RELATED_BROKER_RADIUS_MILES = 25

export type RelatedBrokerQuery = {
  brokerId: string
  latitude?: number | null
  longitude?: number | null
  city?: string | null
  state?: string | null
  take: number
}

// Geographically-relevant related brokers, reusing the canonical geo + listing
// services rather than a new scoring system.
//
// Tier A — coordinates within RELATED_BROKER_RADIUS_MILES (canonical $geoNear
//          aggregation; only runs when the broker has valid coordinates and the
//          2dsphere index exists, otherwise it is skipped).
// Tier B — same city (+ state when known) via the canonical listing match.
// Tier C — same state.
// Tier D — the canonical global listing (previous behaviour).
//
// Within every tier the canonical public eligibility and ranking apply
// (admin:false). The current broker is always excluded, and results are
// de-duplicated so a broker appears only once, at its strongest tier.
export async function getRelatedBrokerIds(input: RelatedBrokerQuery): Promise<string[]> {
  const take = Math.max(1, input.take)
  const collected: string[] = []
  const seen = new Set<string>([input.brokerId])

  const add = (ids: string[]) => {
    for (const id of ids) {
      if (collected.length >= take) return
      if (seen.has(id)) continue
      seen.add(id)
      collected.push(id)
    }
  }

  if (Number.isFinite(input.latitude) && Number.isFinite(input.longitude)) {
    try {
      const nearby = await findBrokerIdsWithinRadius({
        latitude: input.latitude as number,
        longitude: input.longitude as number,
        radiusMiles: RELATED_BROKER_RADIUS_MILES,
        page: 1,
        take: take + 1,
        admin: false,
      })
      add(nearby.ids)
    } catch {
      // No 2dsphere index (or invalid coordinates): fall through to the string
      // location tiers, which never depend on the geo index.
    }
  }

  if (collected.length < take && input.city) {
    const byCity = await getPublicListingPage(
      { locationCity: input.city, locationState: input.state ?? null },
      { page: 1, take: take + 1, admin: false },
    )
    add(byCity.ids)
  }

  if (collected.length < take && input.state) {
    const byState = await getPublicListingPage(
      { locationState: input.state },
      { page: 1, take: take + 1, admin: false },
    )
    add(byState.ids)
  }

  if (collected.length < take) {
    const global = await getPublicListingPage({}, { page: 1, take: take + 1, admin: false })
    add(global.ids)
  }

  return collected.slice(0, take)
}
