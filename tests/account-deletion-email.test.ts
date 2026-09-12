import assert from 'node:assert/strict'
import test from 'node:test'

// Import the pure function directly to avoid @/ alias resolution issues in vitest.
// The accountDeletionConfirmation template uses renderEmailShell internally.
// We test the template by importing the module via its relative path.

import { emailTemplates } from '../lib/email-templates'

test('accountDeletionConfirmation renders user deletion', () => {
  const result = emailTemplates.accountDeletionConfirmation({
    name: 'Jane Doe',
    accountType: 'User',
    deletedAt: new Date('2025-09-10T12:00:00Z'),
  })
  assert.ok(result.subject.includes('User'), 'subject mentions User')
  assert.ok(result.subject.includes('deleted'), 'subject mentions deleted')
  assert.ok(result.html.includes('Jane Doe'), 'html contains name')
  assert.ok(result.html.includes('permanently deleted'), 'html mentions permanent deletion')
})

test('accountDeletionConfirmation renders broker deletion with Mortgage Originator terminology', () => {
  const result = emailTemplates.accountDeletionConfirmation({
    name: 'John Smith',
    accountType: 'Broker',
    deletedAt: new Date('2025-09-10T12:00:00Z'),
  })
  assert.ok(result.subject.includes('Mortgage Originator'), 'subject uses customer-facing Mortgage Originator terminology')
  assert.ok(!result.subject.includes('Broker'), 'subject must not expose the internal Broker account label')
  assert.ok(result.html.includes('John Smith'), 'html contains name')
  assert.ok(result.html.includes('mortgage originator'), 'html uses mortgage originator terminology')
})

test('accountDeletionConfirmation renders company deletion', () => {
  const result = emailTemplates.accountDeletionConfirmation({
    name: 'Acme Corp',
    accountType: 'Company',
    deletedAt: new Date('2025-09-10T12:00:00Z'),
  })
  assert.ok(result.subject.includes('Company'), 'subject mentions Company')
  assert.ok(result.html.includes('Acme Corp'), 'html contains name')
  assert.ok(result.html.includes('company'), 'html mentions company')
})

test('accountDeletionConfirmation escapes HTML in name', () => {
  const result = emailTemplates.accountDeletionConfirmation({
    name: '<script>alert("xss")</script>',
    accountType: 'User',
    deletedAt: new Date('2025-09-10T12:00:00Z'),
  })
  assert.ok(!result.html.includes('<script>'), 'no raw script tag')
  assert.ok(result.html.includes('&lt;script&gt;'), 'script tag is escaped')
})

test('accountDeletionConfirmation returns subject, preheader, and html', () => {
  const result = emailTemplates.accountDeletionConfirmation({
    name: 'Test',
    accountType: 'User',
    deletedAt: new Date(),
  })
  assert.equal(typeof result.subject, 'string')
  assert.equal(typeof result.preheader, 'string')
  assert.equal(typeof result.html, 'string')
  assert.ok(result.subject.length > 0, 'subject is non-empty')
  assert.ok(result.html.length > 0, 'html is non-empty')
})
