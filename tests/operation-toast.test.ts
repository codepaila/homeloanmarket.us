import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { classifyImport, classifyInvitations, classifyRetry } from '@/lib/operation-toast'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const importPage = read('app/admin/brokers/import/page.tsx')
const bulkUi = read('app/admin/brokers/AdminBulkInvitations.tsx')

test('import — success classifies as success', () => {
  const result = classifyImport({ imported: 247, updated: 12, skipped: 0, failed: 0 })
  assert.equal(result.kind, 'success')
  assert.match(result.message, /259 brokers processed/)
})

test('import — partial classifies as warning with counts', () => {
  const result = classifyImport({ imported: 247, updated: 12, skipped: 0, failed: 3 })
  assert.equal(result.kind, 'warning')
  assert.match(result.message, /259 processed, 3 failed/)
})

test('import — empty classifies as success with "no brokers"', () => {
  const result = classifyImport({ imported: 0, updated: 0, skipped: 0, failed: 0 })
  assert.equal(result.kind, 'success')
  assert.match(result.message, /no brokers were imported/)
})

test('import — all-failed classifies as error', () => {
  const result = classifyImport({ imported: 0, updated: 0, skipped: 0, failed: 2 })
  assert.equal(result.kind, 'error')
  assert.match(result.message, /2 brokers could not be imported/)
})

test('invitations — all success', () => {
  const result = classifyInvitations({ total: 2, sent: 2, failed: 0, skipped: 0 })
  assert.equal(result.kind, 'success')
  assert.match(result.message, /accepted — 2 invitations/)
})

test('invitations — partial', () => {
  const result = classifyInvitations({ total: 2, sent: 1, failed: 1, skipped: 0 })
  assert.equal(result.kind, 'warning')
  assert.match(result.message, /1 accepted, 1 failed/)
})

test('invitations — all failed', () => {
  const result = classifyInvitations({ total: 2, sent: 0, failed: 2, skipped: 0 })
  assert.equal(result.kind, 'error')
  assert.match(result.message, /could not be sent/)
})

test('invitations — all skipped', () => {
  const result = classifyInvitations({ total: 2, sent: 0, failed: 0, skipped: 2 })
  assert.equal(result.kind, 'warning')
  assert.match(result.message, /No new invitations sent — 2 brokers already have active invitations/)
})

test('invitations — mixed sent + skipped (no failure) is success', () => {
  const result = classifyInvitations({ total: 3, sent: 2, failed: 0, skipped: 1 })
  assert.equal(result.kind, 'success')
  assert.match(result.message, /accepted — 2 invitations/)
})

test('retry — success', () => {
  const result = classifyRetry({ total: 2, sent: 2, failed: 0, skipped: 0 })
  assert.equal(result.kind, 'success')
  assert.match(result.message, /Retry completed — 2 invitation emails accepted/)
})

test('retry — partial', () => {
  const result = classifyRetry({ total: 2, sent: 1, failed: 1, skipped: 0 })
  assert.equal(result.kind, 'warning')
  assert.match(result.message, /Retry completed with issues — 1 accepted, 1 failed/)
})

test('retry — failure', () => {
  const result = classifyRetry({ total: 2, sent: 0, failed: 2, skipped: 0 })
  assert.equal(result.kind, 'error')
  assert.match(result.message, /Retry failed — the invitation emails could not be sent/)
})

test('toast wording never claims email delivery', () => {
  const source = `${importPage}\n${bulkUi}`
  assert.doesNotMatch(source, /delivered/)
  assert.match(bulkUi, /accepted by the email provider/)
})

test('a bulk operation emits one summary toast, not a per-row toast', () => {
  assert.match(bulkUi, /classifyInvitations\(data\.summary\)/)
  assert.match(bulkUi, /classifyRetry\(data\.summary\)/)
  assert.doesNotMatch(bulkUi, /results\.map\(\(result\) => toast\./)
})

test('import shows one summary toast from the result summary', () => {
  assert.match(importPage, /showToast\(classifyImport\(data\.result\)\)/)
  assert.match(importPage, /toast\.error\(response\.status === 422/)
})
