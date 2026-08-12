import * as XLSX from 'xlsx'

export const MAX_BROKER_IMPORT_BYTES = 10 * 1024 * 1024
export const MAX_BROKER_IMPORT_ROWS = 10_000

export type BrokerImportField = 'displayName' | 'nmls' | 'pinCode' | 'phone' | 'officeAddress' | 'companyName' | 'email' | 'state' | 'city' | 'description' | 'website' | 'experienceYears' | 'specializations' | 'serviceCities' | 'languages' | 'registrationNumber' | 'panNumber'

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
  displayName: ['name', 'display name', 'broker name'],
  nmls: ['nmls', 'nmls number', 'nmls id'],
  pinCode: ['zip', 'zip code', 'zipcode', 'postal code', 'postal'],
  phone: ['phone', 'phone number', 'telephone'],
  officeAddress: ['address', 'office address', 'office', 'street address', 'business address'],
  companyName: ['company', 'company name', 'firm', 'firm name'],
  email: ['email', 'email address', 'e-mail'],
  state: ['state', 'state code'],
  city: ['city', 'town'],
  description: ['description', 'bio', 'about'],
  website: ['website', 'web site', 'url'],
  experienceYears: ['experience', 'experience years', 'years experience'],
  specializations: ['specializations', 'specialties', 'specialty'],
  serviceCities: ['service cities', 'service areas'],
  languages: ['languages', 'language'],
  registrationNumber: ['registration number', 'license', 'license number'],
  panNumber: ['pan', 'tax number', 'tax id'],
}

function normalizeHeader(value: unknown) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ')
}

function normalizeValue(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeEmail(value: string) {
  const markdown = value.match(/^\[([^\]]+)\]\(mailto:([^\s)]+)\)$/i)
  const unwrapped = markdown ? markdown[2] : value.replace(/^mailto:/i, '').trim()
  return unwrapped.toLowerCase()
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
  const digits = value.replace(/\D/g, '')
  return digits.length > 0 && digits.length < 5 ? digits.padStart(5, '0') : digits || value
}

export function normalizePhoneForMatch(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : digits
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
  const rows: BrokerImportRow[] = records.map((record, index) => {
    const values: Partial<Record<BrokerImportField, string>> = {}
    for (const field of Object.keys(mapping) as BrokerImportField[]) {
      const header = mapping[field]
      if (header) {
        const value = normalizeValue(record[header])
        values[field] = field === 'pinCode' ? normalizeZip(value) : field === 'email' ? normalizeEmail(value) : field === 'nmls' ? normalizeNmls(value) : value
      }
    }
    if (!values.city && options.defaultCity?.trim()) values.city = options.defaultCity.trim()
    for (const field of ['specializations', 'serviceCities', 'languages'] as BrokerImportField[]) {
      if (values[field]) values[field] = values[field]!.split(/[;,]/).map((item) => item.trim()).filter(Boolean).join(', ')
    }
    const errors: string[] = []
    for (const field of ['displayName', 'nmls', 'phone', 'officeAddress'] as BrokerImportField[]) {
      if (!values[field]) errors.push(`${field} is required`)
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push('email is invalid')
    const phoneDigits = values.phone?.replace(/\D/g, '') || ''
    if (phoneDigits && (phoneDigits.length < 7 || phoneDigits.length > 15)) errors.push('phone is invalid')
    return { rowNumber: index + 2, values, errors, status: errors.length ? 'INVALID' : 'NEW' }
  })

  const seenNmls = new Set<string>()
  const seenEmails = new Set<string>()
  const seenPhones = new Set<string>()
  for (const row of rows) {
    if (row.errors.length) continue
    const email = row.values.email?.toLowerCase()
    const phone = row.values.phone ? normalizePhoneForMatch(row.values.phone) : ''
    const duplicate = Boolean(
      (row.values.nmls && seenNmls.has(row.values.nmls)) ||
      (email && seenEmails.has(email)) ||
      (phone && seenPhones.has(phone)),
    )
    if (duplicate) row.status = 'DUPLICATE_IN_FILE'
    if (row.values.nmls) seenNmls.add(row.values.nmls)
    if (email) seenEmails.add(email)
    if (phone) seenPhones.add(phone)
  }
  return { sheetName: selectedSheet, sheetNames: workbook.SheetNames, mapping, rows, defaultDescription: options.defaultDescription?.trim() || '' }
}

export function buildBrokerImportData(row: BrokerImportRow, defaultDescription: string) {
  return {
    displayName: row.values.displayName!,
    nmls: row.values.nmls!,
    companyName: row.values.companyName || null,
    description: row.values.description || defaultDescription || 'Imported broker profile pending admin completion.',
    phone: row.values.phone!,
    email: row.values.email || null,
    officeAddress: row.values.officeAddress!,
    city: row.values.city || null,
    state: row.values.state || null,
    pinCode: row.values.pinCode || null,
    experienceYears: Number(row.values.experienceYears || 0) || 0,
    specializations: row.values.specializations ? row.values.specializations.split(',').map((item) => item.trim()).filter(Boolean) : ['Home Loan'],
    serviceCities: row.values.serviceCities ? row.values.serviceCities.split(',').map((item) => item.trim()).filter(Boolean) : row.values.city ? [row.values.city] : [],
    languages: row.values.languages ? row.values.languages.split(',').map((item) => item.trim()).filter(Boolean) : ['English'],
    website: row.values.website || null,
    registrationNumber: row.values.registrationNumber || null,
    panNumber: row.values.panNumber || null,
  }
}
