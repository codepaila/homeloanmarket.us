import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync('app/admin/brokers/import/page.tsx', 'utf8')

test('broker import UI uses a branded accessible upload zone', () => {
  assert.match(source, /type="file"/)
  assert.match(source, /className="sr-only"/)
  assert.match(source, /onDrop={handleDrop}/)
  assert.match(source, /onKeyDown=/)
  assert.match(source, /accept="\.csv,\.xlsx,\.xls"/)
  assert.match(source, /Drag & drop your broker file here/)
  assert.match(source, /Browse files/)
  assert.match(source, /Change file/)
})

test('preview remains the explicit existing import action', () => {
  assert.match(source, /Preview and validate/)
  assert.match(source, /disabled={loading \|\| !file}/)
  assert.match(source, /\/api\/admin\/brokers\/import\/preview/)
})
