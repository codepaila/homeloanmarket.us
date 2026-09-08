import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { emailTemplates } from '../lib/email-templates'

// ---------------------------------------------------------------------------
// Admin → Mortgage Professional Claim Invitation Email
// ---------------------------------------------------------------------------
// This tests the ONLY customer-facing email copy that changed: the invitation
// email sent when an admin claims a profile for an existing Mortgage Professional.
// All other email templates remain unchanged and are tested elsewhere.
// ---------------------------------------------------------------------------

const mockBroker = {
  id: 'broker_abc123',
  displayName: 'John Smith',
  companyName: 'Smith Home Loans',
  profileSlug: 'john-smith',
}

const mockClaimLink = 'https://homeloanmarket.com/claim-broker/a1b2c3d4e5f6g7h8'

// ---------------------------------------------------------------------------
// 1. Correct subject
// ---------------------------------------------------------------------------
test('subject is the exact required subject line', () => {
  const template = emailTemplates.claimInvitation({ displayName: mockBroker.displayName, claimLink: mockClaimLink })
  assert.equal(
    template.subject,
    'Your Mortgage Professional Profile Is Now Listed on HomeLoanMarket.com',
  )
})

// ---------------------------------------------------------------------------
// 2. First-name rendering
// ---------------------------------------------------------------------------
test('renders displayName in greeting', () => {
  const template = emailTemplates.claimInvitation({ displayName: mockBroker.displayName, claimLink: mockClaimLink })
  assert.match(template.html, /Hi John Smith/)
})

test('renders fallback greeting when displayName is missing', () => {
  const brokerNoName = { ...mockBroker, displayName: '' }
  const template = emailTemplates.claimInvitation({ displayName: brokerNoName.displayName, claimLink: mockClaimLink })
  assert.match(template.html, /Hi there/)
  assert.doesNotMatch(template.html, /Hi undefined/)
  assert.doesNotMatch(template.html, /Hi null/)
  assert.doesNotMatch(template.html, /Hi ,/)
})

// ---------------------------------------------------------------------------
// 3. Claim URL rendering
// ---------------------------------------------------------------------------
test('claim link points to the canonical claim URL', () => {
  const template = emailTemplates.claimInvitation({ displayName: mockBroker.displayName, claimLink: mockClaimLink })
  assert.match(template.html, new RegExp(mockClaimLink))
})

test('"Claim Your Profile" button links to the canonical claim URL', () => {
  const template = emailTemplates.claimInvitation({ displayName: mockBroker.displayName, claimLink: mockClaimLink })
  assert.match(template.html, new RegExp(`href="${mockClaimLink}"`))
})

// ---------------------------------------------------------------------------
// 4. Exact required paragraphs present
// ---------------------------------------------------------------------------
test('subject matches exactly', () => {
  const template = emailTemplates.claimInvitation({ displayName: mockBroker.displayName, claimLink: mockClaimLink })
  assert.equal(
    template.subject,
    'Your Mortgage Professional Profile Is Now Listed on HomeLoanMarket.com',
  )
})

test('contains all required body paragraphs', () => {
  const template = emailTemplates.claimInvitation({ displayName: mockBroker.displayName, claimLink: mockClaimLink })
  assert.match(template.html, /Your mortgage professional profile is now listed on HomeLoanMarket\.com/)
  assert.match(template.html, /helping local homebuyers discover and connect with mortgage professionals in their area/)
  assert.match(template.html, /Claim your profile for FREE/)
  assert.match(template.html, /review your information, update your details, add or change your photo, and manage your listing/)
  assert.match(template.html, /built to give local mortgage professionals greater exposure/)
  assert.match(template.html, /hard-to-reach homebuyer community/)
  assert.match(template.html, /no cost to claim or maintain your basic listing/)
  assert.match(template.html, /prefer not to be listed/)
  assert.match(template.html, /remove your profile at any time/)
})

// ---------------------------------------------------------------------------
// 5. "Claim Your Profile" CTA
// ---------------------------------------------------------------------------
test('button text is exactly "Claim Your Profile"', () => {
  const template = emailTemplates.claimInvitation({ displayName: mockBroker.displayName, claimLink: mockClaimLink })
  assert.match(template.html, /Claim Your Profile/)
})

// ---------------------------------------------------------------------------
// 6. No internal IDs / tokens leak
// ---------------------------------------------------------------------------
test('does not expose broker database ID', () => {
  const template = emailTemplates.claimInvitation({ displayName: mockBroker.displayName, claimLink: mockClaimLink })
  assert.doesNotMatch(template.html, /broker_abc123/)
})

test('does not expose raw token hash', () => {
  const template = emailTemplates.claimInvitation({ displayName: mockBroker.displayName, claimLink: mockClaimLink })
  // The claim link contains only the raw token (in the URL), not the hash.
  // Verify no sha256 hash pattern appears.
  assert.doesNotMatch(template.html, /[a-f0-9]{64}/)
})

test('does not expose internal invitation ID', () => {
  const template = emailTemplates.claimInvitation({ displayName: mockBroker.displayName, claimLink: mockClaimLink })
  assert.doesNotMatch(template.html, /invitationId/)
  assert.doesNotMatch(template.html, /invitation_id/)
})

// ---------------------------------------------------------------------------
// 7. No customer-facing "Broker" terminology in rendered email
// ---------------------------------------------------------------------------
test('uses "Mortgage Professional" not "Broker" in customer-facing text', () => {
  const template = emailTemplates.claimInvitation({ displayName: mockBroker.displayName, claimLink: mockClaimLink })
  assert.match(template.html, /mortgage professional/)
  // "broker" should not appear in the customer-visible message text
  // (it may appear in internal code or info item keys, but not rendered body)
  const bodySection = template.html.split('Claim Your Profile')[0]
  assert.doesNotMatch(bodySection, /\bBroker\b/)
})

// ---------------------------------------------------------------------------
// 8. Unchanged templates remain unchanged
// ---------------------------------------------------------------------------
test('brokerWelcome template is unchanged', () => {
  const template = emailTemplates.brokerWelcome('Test User', 'https://example.com/verify')
  assert.match(template.subject, /Welcome to HomeLoanMarket, Test User/)
  assert.match(template.html, /Verify your email to activate your account/)
})

test('claimVerification template is unchanged', () => {
  const template = emailTemplates.claimVerification('Test User', 'https://example.com/verify')
  assert.match(template.subject, /Verify your email to continue your HomeLoanMarket claim/)
  assert.match(template.html, /Continue claiming your existing business profile/)
})

test('resendVerification template is unchanged', () => {
  const template = emailTemplates.resendVerification('Test User', 'https://example.com/verify')
  assert.match(template.subject, /Verify your HomeLoanMarket account, Test User/)
})

test('passwordReset template is unchanged', () => {
  const template = emailTemplates.passwordReset({ name: 'Test User', resetLink: 'https://example.com/reset', expiryHours: 1 })
  assert.match(template.subject, /Reset your HomeLoanMarket password/)
})

// ---------------------------------------------------------------------------
// 9. Invitation still creates/sends the same type
// ---------------------------------------------------------------------------
test('sendBrokerClaimInvitationEmail function exists in actions/email.action.ts', () => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
  const action = fs.readFileSync(
    path.join(ROOT, 'actions', 'email.action.ts'),
    'utf8',
  )
  assert.match(action, /sendBrokerClaimInvitationEmail/)
  assert.match(action, /emailTemplates\.claimInvitation/)
  assert.match(action, /sendEmail/)
})

// ---------------------------------------------------------------------------
// 10. Same claim URL generation (static audit)
// ---------------------------------------------------------------------------
test('claim URL generation is unchanged (structural)', () => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
  const route = fs.readFileSync(
    path.join(ROOT, 'app', 'api', 'admin', 'brokers', '[id]', 'claim-invitations', 'route.ts'),
    'utf8',
  )
  assert.match(route, /claim-broker/)
  assert.match(route, /rawToken/)
})

// ---------------------------------------------------------------------------
// 11. Resend uses the same invitation template
// ---------------------------------------------------------------------------
test('resend route calls issueBrokerClaimInvitation and sendBrokerClaimInvitationEmail', () => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
  const resend = fs.readFileSync(
    path.join(ROOT, 'app', 'api', 'admin', 'claim-invitations', '[id]', 'resend', 'route.ts'),
    'utf8',
  )
  assert.match(resend, /issueBrokerClaimInvitation/)
  assert.match(resend, /sendBrokerClaimInvitationEmail/)
})
