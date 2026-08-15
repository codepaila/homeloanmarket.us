import * as XLSX from 'xlsx'
import { slugifyAdminBroker } from '@/lib/admin-broker'

export const MAX_BROKER_IMPORT_BYTES = 10 * 1024 * 1024
export const MAX_BROKER_IMPORT_ROWS = 10_000

export type BrokerImportField = 'displayName' | 'nmls' | 'pinCode' | 'phone' | 'officeAddress' | 'companyName' | 'email' | 'state' | 'city' | 'description' | 'website' | 'experienceYears' | 'registrationNumber' | 'panNumber'

export type BrokerImportOptions = {
  mapping?: Partial<Record<BrokerImportField, string>>
  sheetName?: string
  defaultCity?: string
  defaultDescription?: string
}

export type BrokerImportRow = {
  rowNumber: number
  values: Partial<Record<BrokerImportField, string>>
  errors: string[]
  status: 'INVALID' | 'DUPLICATE_IN_FILE' | 'NEW' | 'EXISTING'
  existingBrokerId?: string
  changes?: Record<string, { old: string; next: string }>
}

const FIELD_ALIASES: Record<BrokerImportField, string[]> = {
  displayName: ['name', 'full name', 'display name', 'broker name', 'contact name'],
  nmls: ['nmls', 'nmls number', 'nmls id', 'nmls#'],
  pinCode: ['zip', 'zip code', 'zipcode', 'postal code', 'postalcode', 'postal_code', 'postal'],
  phone: ['phone', 'phone number', 'telephone', 'mobile', 'mobile phone'],
  officeAddress: ['address', 'office address', 'office', 'street address', 'business address', 'business_address', 'company address', 'company_address', 'mailing address', 'street_address'],
  companyName: ['company', 'company name', 'firm', 'firm name', 'business name'],
  email: ['email', 'email address', 'e-mail'],
  state: ['state', 'state code', 'state_code', 'province'],
  city: ['city', 'town', 'municipality'],
  description: ['description', 'bio', 'about'],
  website: ['website', 'web site', 'url'],
  experienceYears: ['experience', 'experience years', 'years experience'],
  registrationNumber: ['registration number', 'license', 'license number'],
  panNumber: ['pan', 'tax number', 'tax id'],
}

function normalizeHeader(value: unknown) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim().replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ')
}

function normalizeValue(value: unknown) {
  return String(value ?? '').trim()
}

export function normalizeEmail(value: string) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '')
  const markdown = trimmed.match(/^\[[^\]]*\]\(\s*mailto:([^\s)]+)\s*\)$/i)
  const unwrapped = markdown ? markdown[1] : trimmed.replace(/^mailto:/i, '').trim()
  return unwrapped.replace(/[<>\s]/g, '').toLowerCase()
}

export function normalizeNmls(value: string) {
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return trimmed
  if (/^\d+\.0+$/.test(trimmed)) return trimmed.replace(/\.0+$/, '')
  const scientific = Number(trimmed)
  if (/^[\d.]+e[+-]?\d+$/i.test(trimmed) && Number.isSafeInteger(scientific)) return scientific.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 })
  return trimmed
}

function normalizeZip(value: string) {
  const trimmed = value.trim()
  const zipPlusFour = trimmed.match(/^\d{5}-\d{4}$/)
  if (zipPlusFour) return zipPlusFour[0]
  if (/^\d+\.0+$/.test(trimmed)) return trimmed.replace(/\.0+$/, '')
  const digits = trimmed.replace(/\D/g, '')
  return digits.length > 0 && digits.length < 5 ? digits.padStart(5, '0') : digits || trimmed
}

export function parseImportAddress(value: string) {
  const officeAddress = value.trim()
  const result: { officeAddress: string; city: string | null; state: string | null; pinCode: string | null } = { officeAddress, city: null, state: null, pinCode: null }
  const stateZip = officeAddress.match(/(?:^|[\s,])([A-Za-z]{2})\s*,?\s*(\d{5}(?:-\d{4})?)\s*$/)
  const stateOnly = officeAddress.match(/(?:^|,\s*|\s)([A-Za-z]{2})\s*$/)
  const state = stateZip?.[1] || stateOnly?.[1]
  if (!state) return result
  const suffixStart = stateZip ? stateZip.index! : stateOnly!.index!
  const beforeState = officeAddress.slice(0, suffixStart).replace(/[,\s]+$/, '').trim()
  const segments = beforeState.split(',').map((segment) => segment.trim()).filter(Boolean)
  result.city = segments.length > 1 ? segments[segments.length - 1] : beforeState.split(/\s+/).pop() || null
  result.state = state.toUpperCase()
  if (stateZip?.[2]) result.pinCode = normalizeZip(stateZip[2])
  return result
}

export function normalizePhoneForMatch(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : digits
}

export function buildBrokerImportIdentity(row: BrokerImportRow) {
  const companyOrName = row.values.companyName || row.values.displayName || ''
  return {
    nmls: row.values.nmls ? normalizeNmls(row.values.nmls) : null,
    email: row.values.email ? normalizeEmail(row.values.email) : null,
    phone: row.values.phone ? normalizePhoneForMatch(row.values.phone) : null,
    registrationNumber: row.values.registrationNumber?.trim() || null,
    panNumber: row.values.panNumber?.trim() || null,
    profileSlug: slugifyAdminBroker(companyOrName),
  }
}

function detectMapping(headers: string[], requested?: Partial<Record<BrokerImportField, string>>) {
  const normalizedHeaders = headers.map(normalizeHeader)
  const mapping: Partial<Record<BrokerImportField, string>> = {}
  for (const field of Object.keys(FIELD_ALIASES) as BrokerImportField[]) {
    const requestedHeader = requested?.[field]
    if (requestedHeader && headers.includes(requestedHeader)) {
      mapping[field] = requestedHeader
      continue
    }
    const index = normalizedHeaders.findIndex((header) => FIELD_ALIASES[field].includes(header))
    if (index >= 0) mapping[field] = headers[index]
  }
  return mapping
}

export function parseBrokerWorkbook(buffer: Buffer, filename: string, options: BrokerImportOptions = {}) {
  if (buffer.byteLength > MAX_BROKER_IMPORT_BYTES) throw new Error('Import file exceeds the 10 MB limit')
  const extension = filename.toLowerCase().split('.').pop()
  if (extension !== 'csv' && extension !== 'xlsx' && extension !== 'xls') throw new Error('Only CSV, XLSX, and XLS files are supported')

  const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: false, cellHTML: false, cellNF: false })
  if (workbook.SheetNames.length === 0) throw new Error('Workbook contains no sheets')
  const sheetName = options.sheetName
  const selectedSheet = sheetName && workbook.SheetNames.includes(sheetName) ? sheetName : workbook.SheetNames[0]
  const sheet = workbook.Sheets[selectedSheet]
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
  if (records.length > MAX_BROKER_IMPORT_ROWS) throw new Error(`Import exceeds the ${MAX_BROKER_IMPORT_ROWS.toLocaleString()} row limit`)
  const headers = records.length > 0 ? Object.keys(records[0]) : []
  const mapping = detectMapping(headers, options.mapping)
  const rows: BrokerImportRow[] = records.flatMap((record, index) => {
    const mappedHeaders = Object.values(mapping).filter((header): header is string => Boolean(header))
    if (mappedHeaders.length === 0 || mappedHeaders.every((header) => !normalizeValue(record[header]))) return []
    const values: Partial<Record<BrokerImportField, string>> = {}
    for (const field of Object.keys(mapping) as BrokerImportField[]) {
      const header = mapping[field]
      if (header) {
        const value = normalizeValue(record[header])
        values[field] = field === 'pinCode' ? normalizeZip(value) : field === 'email' ? normalizeEmail(value) : field === 'nmls' ? normalizeNmls(value) : field === 'phone' ? value.trim() : value
      }
    }
    const parsedAddress = values.officeAddress ? parseImportAddress(values.officeAddress) : null
    if (!values.city && parsedAddress?.city) values.city = parsedAddress.city
    if (!values.state && parsedAddress?.state) values.state = parsedAddress.state
    if (!values.pinCode && parsedAddress?.pinCode) values.pinCode = parsedAddress.pinCode
    if (!values.city && options.defaultCity?.trim()) values.city = options.defaultCity.trim()
    const errors: string[] = []
    for (const field of ['displayName', 'nmls', 'phone', 'officeAddress'] as BrokerImportField[]) {
      if (!values[field]) errors.push(`${field} is required`)
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push('email is invalid')
    const phoneDigits = values.phone?.replace(/\D/g, '') || ''
    if (phoneDigits && (phoneDigits.length < 7 || phoneDigits.length > 15)) errors.push('phone is invalid')
    return [{ rowNumber: index + 2, values, errors, status: errors.length ? 'INVALID' : 'NEW' }]
  })

  const seenNmls = new Set<string>()
  const seenEmails = new Set<string>()
  const seenPhones = new Set<string>()
  const seenRegistrationNumbers = new Set<string>()
  const seenPanNumbers = new Set<string>()
  for (const row of rows) {
    if (row.errors.length) continue
    const email = row.values.email ? normalizeEmail(row.values.email) : ''
    const phone = row.values.phone ? normalizePhoneForMatch(row.values.phone) : ''
    const registrationNumber = row.values.registrationNumber?.trim() || ''
    const panNumber = row.values.panNumber?.trim() || ''
    const duplicate = Boolean(
      (row.values.nmls && seenNmls.has(row.values.nmls)) ||
      (email && seenEmails.has(email)) ||
      (phone && seenPhones.has(phone)) ||
      (registrationNumber && seenRegistrationNumbers.has(registrationNumber)) ||
      (panNumber && seenPanNumbers.has(panNumber)),
    )
    if (duplicate) row.status = 'DUPLICATE_IN_FILE'
    if (row.values.nmls) seenNmls.add(row.values.nmls)
    if (email) seenEmails.add(email)
    if (phone) seenPhones.add(phone)
    if (registrationNumber) seenRegistrationNumbers.add(registrationNumber)
    if (panNumber) seenPanNumbers.add(panNumber)
  }
  return { sheetName: selectedSheet, sheetNames: workbook.SheetNames, mapping, rows, defaultDescription: options.defaultDescription?.trim() || '' }
}

export function buildBrokerImportData(row: BrokerImportRow, defaultDescription: string) {
  const email = row.values.email ? normalizeEmail(row.values.email) : null
  return {
    displayName: row.values.displayName!,
    nmls: row.values.nmls!,
    companyName: row.values.companyName || null,
    description: row.values.description || defaultDescription || 'Imported broker profile pending admin completion.',
    phone: row.values.phone!,
    email,
    officeAddress: row.values.officeAddress!,
    city: row.values.city || null,
    state: row.values.state || null,
    pinCode: row.values.pinCode || null,
    experienceYears: Number(row.values.experienceYears || 0) || 0,
    website: row.values.website || null,
    registrationNumber: row.values.registrationNumber || null,
    panNumber: row.values.panNumber || null,
  }
}
