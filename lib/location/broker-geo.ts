/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '@/lib/prisma'

type BrokerGeoSearchInput = {
  latitude: number
  longitude: number
  radiusMiles: number
  page: number
  take: number
  search?: string | null
  admin: boolean
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function regex(value: string) {
  return { $regex: escapeRegex(value), $options: 'i' }
}

function baseMatch(input: BrokerGeoSearchInput) {
  const conditions: Record<string, unknown>[] = []
  if (!input.admin) {
    conditions.push({ isVisible: true })
    conditions.push({ brokerStatus: { $ne: 'SUSPENDED' } })
    // Mirrors publicBrokerWhere(): ADMIN_CREATED brokers are public regardless
    // of verificationStatus; all other sources must be VERIFIED.
    conditions.push({ $or: [{ creationSource: 'ADMIN_CREATED' }, { verificationStatus: 'VERIFIED' }] })
  }
  if (input.search) {
    const value = regex(input.search)
    conditions.push({
      $or: [
        { displayName: value },
        { companyName: value },
        { description: value },
        { officeAddress: value },
        { city: value },
        { state: value },
        { pinCode: value },
      ],
    })
  }
  return conditions.length ? { $and: conditions } : {}
}

function idValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && '$oid' in value && typeof value.$oid === 'string') return value.$oid
  return value == null ? null : String(value)
}

export async function findBrokerIdsWithinRadius(input: BrokerGeoSearchInput): Promise<{ ids: string[]; total: number }> {
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) throw new Error('Invalid search coordinates')
  if (input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180) throw new Error('Invalid search coordinates')
  if (!Number.isFinite(input.radiusMiles) || input.radiusMiles <= 0 || input.radiusMiles > 100) throw new Error('Invalid search radius')

  const pipeline: Record<string, unknown>[] = [
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [input.longitude, input.latitude] },
        key: 'location',
        distanceField: 'distanceMeters',
        maxDistance: input.radiusMiles * 1609.344,
        spherical: true,
      },
    },
    { $match: baseMatch(input) },
  ]

  if (!input.admin) {
    pipeline.push(
      // Owner must be active AND not an active Company member (an
      // advertising/company account is never a public broker owner). Unowned
      // brokers are always eligible owner-wise. Mirrors publicBrokerWhere().
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'owner' } },
      { $lookup: { from: 'company_memberships', localField: 'userId', foreignField: 'userId', as: 'compMem' } },
      { $match: { $or: [{ userId: null }, { $and: [{ owner: { $elemMatch: { isActive: true } } }, { compMem: { $not: { $elemMatch: { isActive: true } } } }] }] } },
    )
  }

  // The canonical FEATURED definition is an ACTIVE FEATURED subscription (see
  // hasPaidEntitlement). Ordering must put those brokers first, then the
  // admin-managed featuredRank, regardless of whether featuredRank is set.
  // $runCommandRaw serializes JS Date to a string, so use the explicit BSON
  // extended-JSON date form for the expiry comparison.
  const now = { $date: new Date().toISOString() }
  pipeline.push(
    { $lookup: { from: 'broker_subscriptions', localField: '_id', foreignField: 'brokerId', as: 'sub' } },
    {
      $addFields: {
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
        // Same "has usable profile/company image" rule as the plain listing
        // (profileImage || logo), so paid/Mortgage-Export/free brokers with a
        // company logo are ranked consistently everywhere.
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
        { $skip: input.take * (input.page - 1) },
        { $limit: input.take },
        { $project: { _id: 1, distanceMeters: 1 } },
      ],
    },
  })

  let result
  try {
    result = await prisma.$runCommandRaw({ aggregate: 'brokers', pipeline, cursor: {} } as any) as any
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('unable to find index for $geoNear') || message.includes('NoQueryExecutionPlans') || message.includes('GEONEAR')) {
      throw new Error('Radius search is unavailable because the Broker location index is missing. Run yarn db:ensure-broker-location-index.')
    }
    throw error
  }
  const batch = result?.cursor?.firstBatch?.[0] || { metadata: [], data: [] }
  const ids = (batch.data || []).map((row: { _id?: unknown }) => idValue(row._id)).filter((id: string | null): id is string => Boolean(id))
  const total = Number(batch.metadata?.[0]?.total || 0)
  return { ids, total }
}
