import * as XLSX from 'xlsx'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { buildBrokerImportData, buildBrokerImportIdentity, normalizeEmail, normalizeNmls, normalizePhoneForMatch, type BrokerImportRow } from './broker-import'
import { adminCreatedBrokerDefaults } from '@/lib/admin-broker'
import { resolveBrokerLocation, locationHasValidCoordinates, type BrokerLocationPatch } from '@/lib/location/broker-location'
import { ensureAdminCreatedBrokerFreeSubscription } from '@/lib/broker-plans'

export type BrokerImportResultError = {
  row: number
  rowNumber: number
  status: 'FAILED' | 'SKIPPED'
  name: string
  nmls: string
  errorCode: string
  error: string
}

function uniqueTarget(error: unknown) {
  const meta = error && typeof error === 'object' && 'meta' in error ? error.meta : null
  const target = meta && typeof meta === 'object' && 'target' in meta ? meta.target : null
  return Array.isArray(target) ? target.join(',') : typeof target === 'string' ? target : ''
}

function safeImportError(error: unknown, row: BrokerImportRow) {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'IMPORT_PERSISTENCE_FAILED'
  if (code === 'P2002') {
    const target = uniqueTarget(error).toLowerCase()
    if (target.includes('userid')) return { errorCode: code, error: 'Broker ownership index rejected another unowned broker. Run the ownership-index reconciliation before importing.' }
    if (target.includes('profileslug')) return { errorCode: code, error: `Duplicate Broker detected for generated slug from ${row.values.companyName || row.values.displayName || 'the imported name'}.` }
    if (target.includes('nmls')) return { errorCode: code, error: `Duplicate Broker detected for NMLS ${row.values.nmls || 'the imported row'}.` }
    if (target.includes('email')) return { errorCode: code, error: `Duplicate Broker detected for email ${row.values.email || 'the imported row'}.` }
    if (target.includes('phone')) return { errorCode: code, error: `Duplicate Broker detected for phone ${row.values.phone || 'the imported row'}.` }
    return { errorCode: code, error: 'Broker became a duplicate after preview; import was not applied.' }
  }
  if (code === 'P2014') return { errorCode: code, error: 'Broker relation could not be persisted.' }
  if (code === 'P2025') return { errorCode: code, error: 'Referenced broker record was not found.' }
  return { errorCode: code, error: 'Unable to persist the broker record.' }
}

function importResultError(row: BrokerImportRow, status: BrokerImportResultError['status'], errorCode: string, error: string): BrokerImportResultError {
  return { row: row.rowNumber, rowNumber: row.rowNumber, status, name: row.values.displayName || '', nmls: row.values.nmls || '', errorCode, error }
}

export function brokerWhereFromParams(params: { search?: string; ownership?: string; verificationStatus?: string; brokerStatus?: string; state?: string; city?: string }) {
  const where: Record<string, unknown> = {}
  if (params.search) where.OR = [
    { displayName: { contains: params.search, mode: 'insensitive' } },
    { companyName: { contains: params.search, mode: 'insensitive' } },
    { profileSlug: { contains: params.search, mode: 'insensitive' } },
    { nmls: { contains: params.search, mode: 'insensitive' } },
  ]
  if (params.ownership === 'UNOWNED') where.userId = null
  if (params.ownership === 'OWNED') where.userId = { not: null }
  if (params.verificationStatus) where.verificationStatus = params.verificationStatus
  if (params.brokerStatus) where.brokerStatus = params.brokerStatus
  if (params.state) where.state = { contains: params.state, mode: 'insensitive' }
  if (params.city) where.city = { contains: params.city, mode: 'insensitive' }
  return where
}

type BrokerIdentityRecord = {
  id: string
  nmls: string | null
  email: string | null
  phone: string
  registrationNumber: string | null
  panNumber: string | null
  profileSlug: string
  displayName: string
  companyName: string | null
  officeAddress: string
}

const brokerIdentitySelect = {
  id: true,
  nmls: true,
  email: true,
  phone: true,
  registrationNumber: true,
  panNumber: true,
  profileSlug: true,
  displayName: true,
  companyName: true,
  officeAddress: true,
} as const

async function assertOwnershipIndexSupportsUnownedBrokers() {
  let raw: { cursor?: { firstBatch?: Array<{ key?: Record<string, unknown>; name?: string; isUnique?: boolean; partialUserIdType?: string }> } }
  try {
    // Project only scalar index metadata. Returning the raw partial filter makes
    // Prisma 6's BSON tagged-value deserializer reject Mongo's `$type` key.
    raw = await prisma.$runCommandRaw({
      aggregate: 'brokers',
      pipeline: [
        { $indexStats: {} },
        {
          $project: {
            name: 1,
            key: 1,
            isUnique: { $ifNull: ['$spec.unique', false] },
            partialUserIdType: {
              $getField: {
                field: { $literal: '$type' },
                input: {
                  $ifNull: [
                    { $getField: { field: 'userId', input: { $ifNull: ['$spec.partialFilterExpression', {}] } } },
                    {},
                  ],
                },
              },
            },
          },
        },
      ],
      cursor: {},
    }) as typeof raw
  } catch (error) {
    if (String(error).includes('NamespaceNotFound') || String(error).includes('code 26')) return
    throw error
  }
  const indexes = raw.cursor?.firstBatch || []
  const ownership = indexes.find((index) => index.isUnique === true && index.key?.userId === 1)
  if (!ownership) return
  if (ownership.partialUserIdType !== 'objectId') throw new Error('Broker ownership index is not partial for non-null userId values. Run yarn db:ensure-ownership-index before importing unowned brokers.')
}

function brokerMatchesIdentity(broker: BrokerIdentityRecord, row: BrokerImportRow) {
  const identity = buildBrokerImportIdentity(row)
  return Boolean(
    (identity.nmls && broker.nmls && normalizeNmls(broker.nmls) === identity.nmls) ||
    (identity.email && broker.email && normalizeEmail(broker.email) === identity.email) ||
    (identity.phone && normalizePhoneForMatch(broker.phone) === identity.phone) ||
    (identity.registrationNumber && broker.registrationNumber === identity.registrationNumber) ||
    (identity.panNumber && broker.panNumber === identity.panNumber),
  )
}

async function findBrokerConflict(db: typeof prisma | Prisma.TransactionClient, row: BrokerImportRow) {
  const brokers = await db.broker.findMany({ select: brokerIdentitySelect }) as BrokerIdentityRecord[]
  return brokers.find((broker) => brokerMatchesIdentity(broker, row))
}

export async function annotateBrokerImportRows(rows: BrokerImportRow[]) {
  await assertOwnershipIndexSupportsUnownedBrokers()
  const existing = await prisma.broker.findMany({ select: brokerIdentitySelect }) as BrokerIdentityRecord[]
  return rows.map((row) => {
    if (row.status === 'INVALID' || row.status === 'DUPLICATE_IN_FILE') return row
    const match = existing.find((broker) => brokerMatchesIdentity(broker, row))
    if (!match) return row
    const next = buildBrokerImportData(row, '')
    const changes: Record<string, { old: string; next: string }> = {}
    for (const [field, value] of Object.entries({ displayName: next.displayName, companyName: next.companyName || '', phone: next.phone, email: next.email || '', officeAddress: next.officeAddress, city: next.city || '', state: next.state || '', pinCode: next.pinCode || '', nmls: next.nmls })) {
      const old = String(match[field as keyof typeof match] || '')
      if (old !== value) changes[field] = { old, next: value }
    }
    return { ...row, status: 'EXISTING' as const, existingBrokerId: match.id, changes }
  })
}

export async function importBrokerRows(rows: BrokerImportRow[], mode: 'CREATE_ONLY' | 'UPDATE_ONLY' | 'UPSERT', defaultDescription: string) {
  const result = { imported: 0, updated: 0, skipped: 0, failed: 0, locationResolved: 0, locationMissing: 0, locationFailed: 0, errors: [] as BrokerImportResultError[] }
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  const updateBrokerFields = (data: ReturnType<typeof buildBrokerImportData>) => ({ displayName: data.displayName, nmls: data.nmls, companyName: data.companyName, phone: data.phone, email: data.email, officeAddress: data.officeAddress, city: data.city ?? undefined, state: data.state ?? undefined, pinCode: data.pinCode, description: data.description, website: data.website, experienceYears: data.experienceYears, registrationNumber: data.registrationNumber, panNumber: data.panNumber })
  const mergeLocationPatch = (patch: BrokerLocationPatch | null) => patch ? { normalizedAddress: patch.normalizedAddress, googlePlaceId: patch.googlePlaceId, locationCountryCode: patch.locationCountryCode, location: patch.location } : {}
  const resolveAddress = async (data: ReturnType<typeof buildBrokerImportData>) => {
    const address = [data.officeAddress, data.city, data.state, data.pinCode].filter(Boolean).join(', ')
    if (!address) return { patch: null, attempted: false }
    await delay(120)
    console.info('[LOCATION] resolving broker address', { displayName: data.displayName, city: data.city || null, state: data.state || null })
    const patch = await resolveBrokerLocation({ officeAddress: data.officeAddress, city: data.city, state: data.state, pinCode: data.pinCode })
    if (patch) console.info('[LOCATION] resolved broker address', { displayName: data.displayName, latitude: patch.location.coordinates[1], longitude: patch.location.coordinates[0] })
    return { patch, attempted: true }
  }
  for (const row of rows) {
    if (row.errors.length || row.status === 'DUPLICATE_IN_FILE') {
      result.skipped += 1
      if (row.errors.length) result.errors.push(importResultError(row, 'SKIPPED', 'IMPORT_VALIDATION_FAILED', row.errors.join('; ')))
      continue
    }
    try {
      const data = buildBrokerImportData(row, defaultDescription)
      let existingBrokerId = row.existingBrokerId
      if (!existingBrokerId) {
        const raceMatch = await findBrokerConflict(prisma, row)
        if (raceMatch) existingBrokerId = raceMatch.id
      }
      if (existingBrokerId) {
        if (mode === 'CREATE_ONLY') {
          result.skipped += 1
          continue
        }
        if (mode === 'UPDATE_ONLY' || mode === 'UPSERT') {
          const existing = await prisma.broker.findUnique({ where: { id: existingBrokerId }, select: { location: true } })
          let updateData: Record<string, unknown> = updateBrokerFields(data)
          if (!existing || !locationHasValidCoordinates(existing.location)) {
            const { patch, attempted } = await resolveAddress(data)
            if (patch) { updateData = { ...updateData, ...mergeLocationPatch(patch) }; result.locationResolved += 1 }
            else if (attempted) result.locationFailed += 1
            else result.locationMissing += 1
          }
          await prisma.broker.update({ where: { id: existingBrokerId }, data: updateData })
        }
        result.updated += 1
        continue
      }
      if (mode === 'UPDATE_ONLY') {
        result.skipped += 1
        result.errors.push(importResultError(row, 'SKIPPED', 'IMPORT_NOT_FOUND', 'No existing Broker matched the supported import identity.'))
        continue
      }
      const { patch, attempted } = await resolveAddress(data)
      if (patch) result.locationResolved += 1
      else if (attempted) result.locationFailed += 1
      else result.locationMissing += 1
      await prisma.$transaction(async (tx) => {
        const transactionConflict = await findBrokerConflict(tx, row)
        if (transactionConflict) {
          const conflict = new Error('Broker became a duplicate after preview; import was not applied.')
          Object.assign(conflict, { code: 'IMPORT_RACE_CONFLICT' })
          throw conflict
        }
        const baseSlug = buildBrokerImportIdentity(row).profileSlug
        let profileSlug = baseSlug
        let suffix = 2
        while (await tx.broker.findUnique({ where: { profileSlug } })) profileSlug = `${baseSlug}-${suffix++}`
        const created = await tx.broker.create({
          data: {
            ...data,
            profileSlug,
            userId: adminCreatedBrokerDefaults.userId,
            creationSource: adminCreatedBrokerDefaults.creationSource,
            verificationStatus: adminCreatedBrokerDefaults.verificationStatus,
            verifiedAt: new Date(),
            brokerStatus: adminCreatedBrokerDefaults.brokerStatus,
            isVisible: adminCreatedBrokerDefaults.isVisible,
            ...mergeLocationPatch(patch),
          },
        })
        // Admin-imported brokers automatically receive the active dynamic FREE
        // plan (linked via planId). No Stripe objects are created.
        await ensureAdminCreatedBrokerFreeSubscription(tx as never, created.id)
      })
      result.imported += 1
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : ''
      if ((code === 'P2002' || code === 'IMPORT_RACE_CONFLICT') && mode !== 'CREATE_ONLY') {
        const conflict = await findBrokerConflict(prisma, row)
        if (conflict) {
          const data = buildBrokerImportData(row, defaultDescription)
          await prisma.broker.update({ where: { id: conflict.id }, data: updateBrokerFields(data) })
          result.updated += 1
          result.locationMissing += 1
          continue
        }
      }
      result.failed += 1
      const safe = safeImportError(error, row)
      console.error('Admin broker import row failed', { row: row.rowNumber, nmls: row.values.nmls || null, name: row.values.displayName || null, mode, errorCode: safe.errorCode, error: safe.error })
      result.errors.push(importResultError(row, 'FAILED', safe.errorCode, safe.error))
    }
  }
  return result
}

export function exportBrokers(rows: Array<Record<string, unknown>>, format: 'csv' | 'xlsx') {
  const safeRows = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (typeof value === 'string' && /^[=+\-@]/.test(value)) return [key, `'${value}`]
    return [key, value]
  })))
  const sheet = XLSX.utils.json_to_sheet(safeRows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Brokers')
  return XLSX.write(book, { type: 'buffer', bookType: format === 'csv' ? 'csv' : 'xlsx' }) as Buffer
}
