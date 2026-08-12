import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import * as XLSX from 'xlsx'
import { exportBrokers } from '@/lib/admin/broker-data'
import { parseBrokerWorkbook } from '@/lib/admin/broker-import'
import { buildBrokerImportData, normalizeNmls, normalizePhoneForMatch } from '@/lib/admin/broker-import'

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
})

test('city and state are optional for address-first imports', () => {
  const csv = 'Name,NMLS,Zip code,Phone,Address,Company Name,Email\nBroker,1001,77001,7135550001,"1 Main Street, Houston, TX",Company,broker@example.com\n'
  const parsed = parseBrokerWorkbook(Buffer.from(csv), 'brokers.csv')
  assert.equal(parsed.rows[0].errors.length, 0)
  const data = buildBrokerImportData(parsed.rows[0], '')
  assert.equal(data.city, null)
  assert.equal(data.state, null)
  assert.equal(data.officeAddress, '1 Main Street, Houston, TX')
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
  assert.match(ui, /Import row errors/)
  assert.match(ui, /item\.errorCode/)
})
