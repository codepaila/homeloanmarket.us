import * as XLSX from 'xlsx'
import prisma from '@/lib/prisma'
import { buildBrokerImportData, normalizePhoneForMatch, type BrokerImportRow } from './broker-import'
import { slugifyAdminBroker, adminCreatedBrokerDefaults } from '@/lib/admin-broker'

export type BrokerImportResultError = {
  row: number
  rowNumber: number
  status: 'FAILED' | 'SKIPPED'
  name: string
  nmls: string
  errorCode: string
  error: string
}

function safeImportError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'IMPORT_PERSISTENCE_FAILED'
  if (code === 'P2002') return { errorCode: code, error: 'Unique constraint violation while creating the broker record.' }
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

export async function annotateBrokerImportRows(rows: BrokerImportRow[]) {
  const nmls = rows.map((row) => row.values.nmls).filter((value): value is string => Boolean(value))
  const emails = rows.map((row) => row.values.email).filter((value): value is string => Boolean(value))
  const phones = rows.map((row) => row.values.phone).filter((value): value is string => Boolean(value))
  const phoneCandidates = phones.map((value) => normalizePhoneForMatch(value)).filter(Boolean)
  const phoneWhere = phoneCandidates.map((value) => ({ phone: { contains: value } }))
  const existing = await prisma.broker.findMany({
    where: { OR: [{ nmls: { in: nmls } }, { email: { in: emails } }, ...phoneWhere] },
    select: { id: true, nmls: true, email: true, phone: true, displayName: true, companyName: true, officeAddress: true },
  })
  const byIdentity = new Map<string, (typeof existing)[number]>()
  for (const broker of existing) {
    if (broker.nmls) byIdentity.set(`nmls:${broker.nmls}`, broker)
    if (broker.email) byIdentity.set(`email:${broker.email.toLowerCase()}`, broker)
    if (broker.phone) byIdentity.set(`phone:${normalizePhoneForMatch(broker.phone)}`, broker)
  }
  return rows.map((row) => {
    if (row.status === 'INVALID' || row.status === 'DUPLICATE_IN_FILE') return row
    const match = (row.values.nmls && byIdentity.get(`nmls:${row.values.nmls}`)) ||
      (row.values.email && byIdentity.get(`email:${row.values.email.toLowerCase()}`)) ||
      (row.values.phone && byIdentity.get(`phone:${normalizePhoneForMatch(row.values.phone)}`))
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
  for (const row of rows) {
    if (row.errors.length || row.status === 'DUPLICATE_IN_FILE') {
      result.skipped += 1
      if (row.errors.length) result.errors.push(importResultError(row, 'SKIPPED', 'IMPORT_VALIDATION_FAILED', row.errors.join('; ')))
      continue
    }
    try {
      const data = buildBrokerImportData(row, defaultDescription)
      if (row.existingBrokerId) {
        if (mode === 'CREATE_ONLY') {
          result.skipped += 1
          continue
        }
        if (mode === 'UPDATE_ONLY' || mode === 'UPSERT') await prisma.broker.update({ where: { id: row.existingBrokerId }, data: { displayName: data.displayName, nmls: data.nmls, companyName: data.companyName, phone: data.phone, email: data.email, officeAddress: data.officeAddress, city: data.city ?? undefined, state: data.state ?? undefined, pinCode: data.pinCode, description: data.description, website: data.website, experienceYears: data.experienceYears, specializations: data.specializations, serviceCities: data.serviceCities, languages: data.languages, registrationNumber: data.registrationNumber, panNumber: data.panNumber } })
        result.updated += 1
        result.locationMissing += 1
        continue
      }
      if (mode === 'UPDATE_ONLY') {
        result.skipped += 1
        continue
      }
      await prisma.$transaction(async (tx) => {
        const baseSlug = slugifyAdminBroker(data.companyName || data.displayName)
        let profileSlug = baseSlug
        let suffix = 2
        while (await tx.broker.findUnique({ where: { profileSlug } })) profileSlug = `${baseSlug}-${suffix++}`
        await tx.broker.create({
          data: {
            ...data,
            profileSlug,
            userId: adminCreatedBrokerDefaults.userId,
            creationSource: adminCreatedBrokerDefaults.creationSource,
            verificationStatus: adminCreatedBrokerDefaults.verificationStatus,
            brokerStatus: adminCreatedBrokerDefaults.brokerStatus,
            isVisible: adminCreatedBrokerDefaults.isVisible,
            subscription: { create: { plan: 'FREE', isActive: true, startDate: new Date(), endDate: null } },
          },
        })
      })
      result.imported += 1
      result.locationMissing += 1
    } catch (error) {
      result.failed += 1
      const safe = safeImportError(error)
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
