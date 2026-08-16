import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const api = read('app/api/brokers/route.ts')
const page = read('app/(public)/brokers/page.tsx')

test('pagination sanitizes invalid page values to 1', () => {
  assert.match(api, /const requestedPage = Number\.isInteger\(pageParam\) && pageParam >= 1 \? pageParam : 1/)
})

test('pagination clamps an out-of-range page to the last valid page', () => {
  assert.match(api, /const totalPages = total > 0 \? Math\.ceil\(total \/ take\) : 1/)
  assert.match(api, /if \(page > totalPages\) page = totalPages/)
})

test('total count uses the same where as the broker query', () => {
  assert.match(api, /prisma\.broker\.count\(\{ where \}\)/)
  assert.match(api, /where: geoResult \? \{ \.\.\.geoWhere, id: \{ in: geoResult\.ids \} \} : where/)
})

test('pagination applies a stable secondary sort key', () => {
  assert.match(api, /\{ id: 'asc' \}/)
})

test('client resets page to 1 when search/filter changes', () => {
  assert.match(page, /setPage\(1\)/)
})

test('client normalizes page beyond the final page', () => {
  assert.match(page, /if \(totalPages > 0 && page > totalPages\)/)
  assert.match(page, /setPage\(totalPages\)/)
})

test('pagination UI disables Previous on first page and Next on last page', () => {
  assert.match(page, /disabled=\{page <= 1\}/)
  assert.match(page, /disabled=\{page >= totalPages\}/)
})

test('pagination UI shows ellipsis gaps for many pages', () => {
  assert.match(page, /ellipsis-start/)
  assert.match(page, /ellipsis-end/)
})
