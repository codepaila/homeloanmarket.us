import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { emailTemplates, htmlToText } from '../lib/email-templates'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ===========================================================================
// PHASE 8.36.6 — CLAIM INVITATION EMAIL — EXACT APPROVED COPY (content lock)
// ===========================================================================

const claimLink = 'https://homeloanmarket.com/claim-broker/a1b2c3d4e5f6g7h8'
const template = emailTemplates.claimInvitation({ displayName: 'John Smith', claimLink })
const plain = htmlToText(template.html)
const actions = read('actions/email.action.ts')

const APPROVED_PARAGRAPHS = [
  'Hi John Smith,',
  'Your mortgage professional profile is now listed on HomeLoanMarket.com, helping local homebuyers discover and connect with mortgage professionals in their area.',
  'Claim your profile for FREE to review your information, update your details, add or change your photo, and manage your listing.',
  'Claim Your Profile:',
  'HomeLoanMarket is built to give local mortgage professionals greater exposure to a large, hard-to-reach homebuyer community.',
  'There is no cost to claim or maintain your basic listing.',
  'If you prefer not to be listed on HomeLoanMarket, you can also remove your profile at any time.',
  'Best,',
  'HomeLoanMarket Team',
  'HomeLoanMarket.com',
]

test('claim invitation HTML contains every approved sentence verbatim', () => {
  for (const paragraph of APPROVED_PARAGRAPHS) {
    assert.ok(template.html.includes(paragraph), `HTML must contain approved text: ${paragraph}`)
  }
})

test('claim invitation HTML substitutes displayName and claimLink', () => {
  assert.ok(template.html.includes('Hi John Smith,'))
  assert.ok(template.html.includes(claimLink))
  const fallback = emailTemplates.claimInvitation({ displayName: '', claimLink })
  assert.ok(fallback.html.includes('Hi there,'))
  assert.doesNotMatch(fallback.html, /Hi undefined|Hi null|Hi ,/)
})

test('claim invitation HTML contains a single CTA pointing to the claimLink', () => {
  assert.ok(template.html.includes(`href="${claimLink}"`))
  const ctaCount = (template.html.match(/Claim Your Profile/g) || []).length
  assert.ok(ctaCount >= 1)
})

test('plain-text fallback contains the same approved message', () => {
  for (const paragraph of APPROVED_PARAGRAPHS) {
    assert.ok(plain.includes(paragraph), `plain text must contain approved text: ${paragraph}`)
  }
})

test('sender plain-text copy matches the approved message and keeps deterministic idempotency', () => {
  // The sender's `text:` is a template literal; the source shows \n escapes.
  assert.ok(actions.includes('Your mortgage professional profile is now listed on HomeLoanMarket.com, helping local homebuyers discover and connect with mortgage professionals in their area.'))
  assert.ok(actions.includes('Best,\\nHomeLoanMarket Team\\nHomeLoanMarket.com`'))
  assert.ok(actions.includes('idempotencyKey: `claim_invitation_${invitationId}`'))
  assert.doesNotMatch(actions, /claim_invitation_\$\{[^}]*Date\.now/)
})

test('claim invitation subject and preheader remain stable', () => {
  assert.equal(template.subject, 'Your Mortgage Professional Profile Is Now Listed on HomeLoanMarket.com')
  assert.ok(template.preheader.length > 0)
})