import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import * as XLSX from 'xlsx'
import { exportBrokers } from '@/lib/admin/broker-data'
import { parseBrokerWorkbook } from '@/lib/admin/broker-import'
import { buildBrokerImportData, buildBrokerImportIdentity, normalizeEmail, normalizeNmls, normalizePhoneForMatch, parseImportAddress } from '@/lib/admin/broker-import'

const row = (index: number) => ({
  Name: `Broker ${index}`,
  NMLS: String(1000000 + index),
  'Zip code': index === 1 ? '01234' : '77001',
  Phone: `713555${String(index).padStart(4, '0')}`,
  Address: `1 Main Street, Houston, TX`,
  'Company Name': `Company ${index}`,
  Email: `broker${index}@example.test`,
  State: 'TX',
})

test('CSV parser handles BOM, quoted commas, ZIP padding, and default city', () => {
  const csv = '\uFEFFName,NMLS,"Zip code",Phone,Address,Company Name,Email,State\n' + '"Broker One",1000001,01234,7135550001,"1 Main Street, Houston, TX",Company,broker@example.test,TX\n'
  const parsed = parseBrokerWorkbook(Buffer.from(csv), 'brokers.csv', { defaultCity: 'Houston' })
  assert.equal(parsed.rows.length, 1)
  assert.equal(parsed.rows[0].values.pinCode, '01234')
  assert.equal(parsed.rows[0].values.city, 'Houston')
  assert.equal(parsed.rows[0].values.officeAddress, '1 Main Street, Houston, TX')
  assert.equal(parsed.rows[0].status, 'NEW')
})

test('import normalization unwraps mailto markdown and preserves phone matching semantics', () => {
  const csv = 'Name,NMLS,Zip code,Phone,Address,Company Name,Email,State\nBroker,1001,77001,(713) 555-0001,Address,Company,[broker@example.com](mailto:broker@example.com),TX\n'
  const parsed = parseBrokerWorkbook(Buffer.from(csv), 'brokers.csv', { defaultCity: 'Houston' })
  assert.equal(parsed.rows[0].values.email, 'broker@example.com')
  assert.equal(normalizePhoneForMatch('+1 (713) 555-0001'), normalizePhoneForMatch('7135550001'))
  assert.equal(normalizeNmls('1029135'), '1029135')
  assert.equal(normalizeNmls('1.029135e6'), '1029135')
  assert.equal(normalizeEmail(' "[MOMIN@example.com](mailto:MOMIN@example.com)" '), 'momin@example.com')
})

test('canonical import identity shares the admin slug and null optional fields', () => {
  const parsed = parseBrokerWorkbook(Buffer.from('Name,NMLS,Phone,Address,Company Name,Email\nShamim Momin,2434406,8326143485,1 Main Street,Momin Mortgage,\n'), 'brokers.csv')
  const identity = buildBrokerImportIdentity(parsed.rows[0])
  const data = buildBrokerImportData(parsed.rows[0], '')
  assert.equal(identity.profileSlug, 'momin-mortgage')
  assert.equal(identity.nmls, '2434406')
  assert.equal(identity.phone, '8326143485')
  assert.equal(data.email, null)
  assert.equal(data.registrationNumber, null)
  assert.equal(data.panNumber, null)
})

test('city and state are derived when the address contains them', () => {
  const csv = 'Name,NMLS,Zip code,Phone,Address,Company Name,Email\nBroker,1001,77001,7135550001,"1 Main Street, Houston, TX",Company,broker@example.com\n'
  const parsed = parseBrokerWorkbook(Buffer.from(csv), 'brokers.csv')
  assert.equal(parsed.rows[0].errors.length, 0)
  const data = buildBrokerImportData(parsed.rows[0], '')
  assert.equal(data.city, 'Houston')
  assert.equal(data.state, 'TX')
  assert.equal(data.officeAddress, '1 Main Street, Houston, TX')
})

test('address-first parsing derives city, state, and ZIP without changing officeAddress', () => {
  const first = parseImportAddress('738 E 29th St, Houston, TX 77009')
  assert.deepEqual(first, { officeAddress: '738 E 29th St, Houston, TX 77009', city: 'Houston', state: 'TX', pinCode: '77009' })
  const second = parseImportAddress('13735 Wixford Trail, Richmond, TX 77407')
  assert.equal(second.city, 'Richmond')
  assert.equal(second.state, 'TX')
  assert.equal(second.pinCode, '77407')
  assert.equal(parseImportAddress('123 Main Street, Houston, TX, 77002').pinCode, '77002')
  assert.equal(parseImportAddress('123 Main Street Houston TX 77002').city, 'Houston')
  assert.equal(parseImportAddress('123 Main Street, Houston, TX 77002-1234').pinCode, '77002-1234')
  assert.equal(parseImportAddress('123 Main Street').officeAddress, '123 Main Street')
})

test('explicit spreadsheet location fields take precedence over derived address values', () => {
  const csv = 'Name,NMLS,Zip code,Phone,Address,Company Name,Email,City,State\nBroker,1001,77001,7135550001,"1 Main Street, Houston, TX 77002",Company,broker@example.com,Austin,TX\n'
  const parsed = parseBrokerWorkbook(Buffer.from(csv), 'brokers.csv')
  assert.equal(parsed.rows[0].values.city, 'Austin')
  assert.equal(parsed.rows[0].values.state, 'TX')
  assert.equal(parsed.rows[0].values.pinCode, '77001')
})

test('canonical Houston headers and trailing empty rows are handled automatically', () => {
  const csv = 'Name,NMLS,Zip code,Phone,Address,Company Name,Email,State\nBroker,1029135,77009,281-781-4145,"738 E 29th St, Houston, TX 77009",Odyssey Mortgage Corporation,lashaun@example.com,TX\n,,,,,,,\n'
  const parsed = parseBrokerWorkbook(Buffer.from(csv), 'houston.xlsx')
  assert.equal(parsed.rows.length, 1)
  assert.equal(parsed.mapping.officeAddress, 'Address')
  assert.equal(parsed.mapping.pinCode, 'Zip code')
  assert.equal(parsed.mapping.companyName, 'Company Name')
  assert.equal(parsed.rows[0].values.officeAddress, '738 E 29th St, Houston, TX 77009')
  assert.equal(parsed.rows[0].values.city, 'Houston')
  assert.equal(parsed.rows[0].values.state, 'TX')
  assert.equal(parsed.rows[0].values.pinCode, '77009')
})

test('XLSX parser reads 62 source rows and detects duplicate NMLS values', () => {
  const rows = Array.from({ length: 62 }, (_, index) => row(index + 1))
  rows[61].NMLS = rows[0].NMLS
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '50brokerwithstate')
  const parsed = parseBrokerWorkbook(Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })), 'source.xlsx', { defaultCity: 'Houston' })
  assert.equal(parsed.sheetName, '50brokerwithstate')
  assert.equal(parsed.rows.length, 62)
  assert.equal(parsed.rows.filter((item) => item.status === 'DUPLICATE_IN_FILE').length, 1)
})

test('legacy XLS extension is accepted by the same parser boundary', () => {
  const sheet = XLSX.utils.json_to_sheet([row(1)])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Brokers')
  const parsed = parseBrokerWorkbook(Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'biff8' })), 'source.xls', { defaultCity: 'Houston' })
  assert.equal(parsed.rows.length, 1)
})

test('exports contain safe Broker fields in CSV and XLSX formats', () => {
  const records = [{ ID: 'broker-1', NMLS: '1000001', Name: '=Broker One', Email: 'broker@example.test' }]
  const csv = exportBrokers(records, 'csv').toString('utf8')
  const xlsx = exportBrokers(records, 'xlsx')
  assert.match(csv, /NMLS/)
  assert.doesNotMatch(csv, /password/i)
  assert.match(csv, /'=Broker One/)
  assert.ok(xlsx.byteLength > 0)
})

test('confirm import exposes safe structured row errors', () => {
  const source = fs.readFileSync('lib/admin/broker-data.ts', 'utf8')
  const ui = fs.readFileSync('app/admin/brokers/import/page.tsx', 'utf8')
  assert.match(source, /status: 'FAILED' \| 'SKIPPED'/)
  assert.match(source, /errorCode: string/)
  assert.match(source, /P2002/)
  assert.match(source, /Admin broker import row failed/)
  assert.match(source, /Broker ownership index is not partial/)
  assert.match(source, /Broker became a duplicate after preview/)
  assert.match(source, /IMPORT_NOT_FOUND/)
  assert.match(ui, /Import row errors/)
  assert.match(ui, /item\.errorCode/)
  assert.match(ui, /Office address/)
  assert.match(ui, /Parsing and validating/)
})
