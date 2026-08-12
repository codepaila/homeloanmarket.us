/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '@/lib/prisma'

type BrokerGeoSearchInput = {
  latitude: number
  longitude: number
  radiusMiles: number
  page: number
  take: number
  city?: string | null
  state?: string | null
  zip?: string | null
  specialization?: string | null
  minRating?: number | null
  minExperience?: number | null
  language?: string | null
  search?: string | null
  verificationStatus?: string | null
  brokerStatus?: string | null
  featuredOnly?: boolean
  admin: boolean
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function regex(value: string) {
  return { $regex: escapeRegex(value), $options: 'i' }
}

function baseMatch(input: BrokerGeoSearchInput) {
  const match: Record<string, unknown> = {}
  if (input.city) match.serviceCities = input.city
  if (input.state) match.state = regex(input.state)
  if (input.zip) match.pinCode = regex(input.zip)
  if (input.specialization) match.specializations = input.specialization
  if (input.minRating) match.avgRating = { $gte: input.minRating }
  if (input.minExperience) match.experienceYears = { $gte: input.minExperience }
  if (input.language) match.languages = input.language
  if (input.featuredOnly) match.brokerStatus = 'FEATURED'
  if (input.verificationStatus) match.verificationStatus = input.verificationStatus
  if (input.brokerStatus) match.brokerStatus = input.brokerStatus
  if (!input.admin) {
    match.isVisible = true
    match.verificationStatus = 'VERIFIED'
    match.brokerStatus = input.featuredOnly || input.brokerStatus === 'FEATURED' ? 'FEATURED' : { $ne: 'SUSPENDED' }
  }
  if (input.search) {
    const value = regex(input.search)
    match.$or = [
      { displayName: value },
      { companyName: value },
      { description: value },
      { officeAddress: value },
      { city: value },
      { state: value },
      { pinCode: value },
    ]
  }
  return match
}

function idValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && '$oid' in value && typeof value.$oid === 'string') return value.$oid
  return value == null ? null : String(value)
}

export async function findBrokerIdsWithinRadius(input: BrokerGeoSearchInput) {
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
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'owner' } },
      { $match: { $or: [{ userId: null }, { owner: { $elemMatch: { isActive: true } } }] } },
    )
  }

  pipeline.push({
    $facet: {
      metadata: [{ $count: 'total' }],
      data: [
        { $sort: { brokerStatus: -1, featuredRank: -1, avgRating: -1, experienceYears: -1, _id: 1 } },
        { $skip: input.take * (input.page - 1) },
        { $limit: input.take },
        { $project: { _id: 1, distanceMeters: 1 } },
      ],
    },
  })

  const result = await prisma.$runCommandRaw({ aggregate: 'brokers', pipeline, cursor: {} } as any) as any
  const batch = result?.cursor?.firstBatch?.[0] || { metadata: [], data: [] }
  const ids = (batch.data || []).map((row: { _id?: unknown }) => idValue(row._id)).filter((id: string | null): id is string => Boolean(id))
  const total = Number(batch.metadata?.[0]?.total || 0)
  return { ids, total }
}
