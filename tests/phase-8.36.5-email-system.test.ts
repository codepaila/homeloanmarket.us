import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const tokens = read('lib/email-tokens.ts')
const shell = read('lib/email-shell.ts')
const templates = read('lib/email-templates.ts')
const emailService = read('lib/email.ts')
const actions = read('actions/email.action.ts')
const verificationLib = read('lib/broker-verification.ts')
const verifyRoute = read('app/api/auth/verify-email/route.ts')
const webhook = read('app/api/stripe/webhook/route.ts')

// ===========================================================================
// PHASE 8.36.5 — GLOBAL HOMELOANMARKET EMAIL SYSTEM
// ===========================================================================

test('one canonical delivery boundary: Resend is only instantiated in lib/email.ts', () => {
  assert.match(emailService, /new Resend\(/)
  const appSource = ['lib', 'app', 'actions'].map((d) => { let out = ''; const walk = (dir: string) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => { if (e.isDirectory()) walk(`${dir}/${e.name}`); else if (/\.tsx?$/.test(e.name)) out += fs.readFileSync(`${dir}/${e.name}`, 'utf8') }); walk(d); return out }).join('')
  const outsideEmailLib = appSource.replace(emailService, '')
  assert.doesNotMatch(outsideEmailLib, /new Resend\(/, 'no direct Resend instantiation outside lib/email.ts')
})

test('a single shared email shell exists and is used by the templates', () => {
  assert.match(shell, /export function renderEmailShell/)
  // Every active template routes through renderEmailShell.
  const activeTemplates = ['brokerWelcome', 'claimInvitation', 'claimVerification', 'resendVerification', 'brokerVerified', 'newContactMessage', 'contactMessageConfirmation', 'emailChangeVerification', 'passwordReset', 'notification', 'adminNewBroker', 'subscriptionPurchased']
  for (const name of activeTemplates) {
    assert.match(templates, new RegExp(`${name}: `), `${name} template present`)
  }
  assert.ok((templates.match(/renderEmailShell\(/g) || []).length >= activeTemplates.length)
})

test('email-safe tokens are centralized, match the authoritative web brand, and are used by the shell', () => {
  // Authoritative values from app/globals.css (light theme).
  assert.match(tokens, /brand: '#000000'/)
  assert.match(tokens, /primary: '#000000'/)
  assert.match(tokens, /primaryText: '#FFFFFF'/)
  assert.match(tokens, /muted: '#666666'/)
  assert.match(tokens, /border: '#E0E0E0'/)
  assert.match(tokens, /success: '#15803D'/)
  assert.match(tokens, /warning: '#B45309'/)
  assert.match(tokens, /destructive: '#CC0000'/)
  assert.match(tokens, /cta: '#000000'/)
  assert.match(tokens, /ctaText: '#FFFFFF'/)
  assert.match(tokens, /link: '#000000'/)
  assert.match(shell, /import \{ emailTokens as t \} from '@\/lib\/email-tokens'/)
  assert.doesNotMatch(shell, /var\(--/)
})

test('old email blue/slate/purple brand values are gone from the token layer', () => {
  assert.doesNotMatch(tokens, /#2563eb/)
  assert.doesNotMatch(tokens, /#1e40af/)
  assert.doesNotMatch(tokens, /#b91c1c/)
  assert.doesNotMatch(tokens, /#64748b/)
  assert.doesNotMatch(tokens, /#e2e8f0/)
})

test('shared shell renders the canonical HomeLoanMarket logo with a text fallback', () => {
  assert.match(shell, /\/assets\/logo\.png/)
  assert.match(shell, /NEXT_PUBLIC_APP_URL/)
  assert.match(shell, /alt="HomeLoanMarket"/)
  assert.match(shell, /t\.fontFamily/)
  assert.match(tokens, /fontFamily: "Arial, Helvetica, sans-serif"/)
  assert.match(shell, /Connecting homebuyers with trusted mortgage professionals across the United States/)
  // The email must not depend on the image loading.
  assert.doesNotMatch(shell, /display:\s*none/)
})

test('shell is email-client-safe: no web fonts, gradients, pseudo-elements, or emoji watermark', () => {
  assert.doesNotMatch(shell, /@import url/)
  assert.doesNotMatch(shell, /fonts\.googleapis/)
  assert.doesNotMatch(shell, /linear-gradient/)
  assert.doesNotMatch(shell, /::before/)
  assert.doesNotMatch(shell, /content: "🏠"/)
  assert.doesNotMatch(shell, /🏠/)
  assert.doesNotMatch(shell, /<style>/)
})

test('preheader support exists and templates define preheaders', () => {
  assert.match(shell, /preheaderHtml/)
  assert.match(templates, /preheader:/)
  assert.match(templates, /preheader:/)
})

test('HTML escaping is centralized and applied in the shell', () => {
  assert.match(read('lib/email-utils.ts'), /export function escapeHtml/)
  assert.ok((shell.match(/escapeHtml\(/g) || []).length > 4)
})

test('no fabricated social links in the shell; social is conditional', () => {
  assert.doesNotMatch(shell, /twitter\.com\/homeloanmarket/)
  assert.doesNotMatch(shell, /facebook\.com\/homeloanmarket/)
  assert.doesNotMatch(shell, /linkedin\.com\/company\/homeloanmarket/)
  assert.match(shell, /socialHtml\(social/)
  assert.match(shell, /if \(links\.length === 0\) return ''/)
})

test('broker verification email is a single canonical path (no legacy sendBrokerVerificationEmail)', () => {
  assert.doesNotMatch(actions, /export async function sendBrokerVerificationEmail/)
  assert.doesNotMatch(actions, /emailTemplates\.brokerVerified/)
  assert.doesNotMatch(verifyRoute, /sendBrokerVerificationEmail/)
  assert.match(verificationLib, /sendBrokerVerifiedEmail/)
  assert.match(verificationLib, /idempotencyKey: `broker_verified_\$\{params\.profileSlug\}`/)
})

test('email verification does NOT equal broker verification', () => {
  assert.doesNotMatch(verifyRoute, /brokerVerified/)
  assert.doesNotMatch(verifyRoute, /broker account is verified/)
})

test('subscription purchase email has a deterministic key and no cross-product data', () => {
  const durable = read('lib/broker-subscription-email.ts')
  assert.match(actions, /sendSubscriptionPurchaseEmail/)
  // Durable idempotency lives in the canonical durable sender.
  assert.match(durable, /idempotencyKey = `subscription_purchase_\$\{brokerSubscriptionId\}`/)
  assert.match(durable, /idempotencyKey,/)
  assert.doesNotMatch(durable, /subscription_purchase_\$\{[^}]*Date\.now/)
  // Wired to the authoritative webhook owner for broker subscriptions.
  assert.match(webhook, /sendSubscriptionPurchaseEmail\(updated\.id\)/)
  assert.match(webhook, /'brokerId' in updated/)
})

test('no timestamp-only idempotency keys remain in migrated senders', () => {
  assert.doesNotMatch(actions, /idempotencyKey: .*\$\{Date\.now\(\)\}/)
  assert.doesNotMatch(actions, /_\$\{Date\.now\(\)\}/)
  assert.doesNotMatch(actions, /\$\{Date\.now\(\)\}/)
})

test('removed dead email artifacts have no production references', () => {
  const production = actions + templates + read('lib/email.ts') + read('lib/email-shell.ts')
  assert.doesNotMatch(production, /newLead/)
  assert.doesNotMatch(production, /sendNewLeadNotification/)
  assert.doesNotMatch(production, /newMessage: /)
  assert.doesNotMatch(production, /sendNewReviewNotification/)
})

test('HomeLoanMarket sender name capitalization is correct', () => {
  // Env resolution is centralized in lib/platform-config.ts (emailFromName).
  const platformConfig = read('lib/platform-config.ts')
  assert.match(platformConfig, /EMAIL_FROM_NAME \|\| 'HomeLoanMarket'/)
  assert.doesNotMatch(platformConfig, /'Homeloanmarket'/)
  // The service composes the sender from that config, never a hardcoded name.
  assert.match(emailService, /\$\{platformConfig\.emailFromName\}/)
  assert.doesNotMatch(emailService, /'Homeloanmarket'/)
})