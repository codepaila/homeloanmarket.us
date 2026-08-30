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
//
// Sort (before skip/take so pagination stays server-side and correct):
//   featured desc, featuredRank desc, mortgageExpertEnabled desc,
//   hasImage desc, experienceYears desc, _id asc
import prisma from '@/lib/prisma'

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
    // Mirrors publicBrokerWhere(): ADMIN_CREATED brokers are public regardless
    // of verificationStatus; all other sources must be VERIFIED.
    conditions.push({ $or: [{ creationSource: 'ADMIN_CREATED' }, { verificationStatus: 'VERIFIED' }] })
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
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'owner' } },
      { $match: { $or: [{ userId: null }, { owner: { $elemMatch: { isActive: true } } }] } },
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
        hasImage: {
          $cond: [
            {
              $or: [
                { $and: [{ $ne: ['$profileImage', null] }, { $ne: ['$profileImage', ''] }] },
                { $and: [{ $ne: ['$logo', null] }, { $ne: ['$logo', ''] }] },
              ],
            },
            1,
            0,
          ],
        },
      },
    },
  )

  pipeline.push({
    $facet: {
      metadata: [{ $count: 'total' }],
      data: [
        { $sort: { featured: -1, featuredRank: -1, mortgageExpertEnabled: -1, hasImage: -1, experienceYears: -1, _id: 1 } },
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