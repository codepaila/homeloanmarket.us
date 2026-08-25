import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  formatCurrencyAmount,
  formatPlanPriceFromCents,
  formatPlanPriceAndInterval,
  formatLoanAmountDollars,
} from '../lib/email-format'
import { emailTemplates, htmlToText } from '../lib/email-templates'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ---------------------------------------------------------------------------
// US currency formatting
// ---------------------------------------------------------------------------

test('formatCurrencyAmount renders USD with two decimals and comma grouping', () => {
  assert.equal(formatCurrencyAmount(15, 'usd'), '$15.00')
  assert.equal(formatCurrencyAmount(49, 'usd'), '$49.00')
  assert.equal(formatCurrencyAmount(99, 'usd'), '$99.00')
  assert.equal(formatCurrencyAmount(1250, 'usd'), '$1,250.00')
  assert.equal(formatCurrencyAmount(725000, 'usd'), '$725,000.00')
})

test('formatPlanPriceFromCents converts cents to dollars', () => {
  assert.equal(formatPlanPriceFromCents(1500, 'usd'), '$15.00')
  assert.equal(formatPlanPriceFromCents(499900, 'usd'), '$4,999.00')
  assert.equal(formatPlanPriceFromCents(0, 'usd'), '$0.00')
})

test('formatPlanPriceAndInterval produces a price plus interval or Free', () => {
  assert.equal(formatPlanPriceAndInterval(1500, 'usd', 'month'), '$15.00/month')
  assert.equal(formatPlanPriceAndInterval(30000, 'usd', 'year'), '$300.00/year')
  assert.equal(formatPlanPriceAndInterval(0, 'usd', 'month'), 'Free')
})

test('formatLoanAmountDollars formats lead amounts as USD', () => {
  assert.equal(formatLoanAmountDollars(350000), '$350,000.00')
  assert.equal(formatLoanAmountDollars('725000'), '$725,000.00')
  assert.equal(formatLoanAmountDollars(null), 'Not specified')
  assert.equal(formatLoanAmountDollars(undefined), 'Not specified')
  assert.equal(formatLoanAmountDollars(''), 'Not specified')
})

// ---------------------------------------------------------------------------
// US localization: no India-specific terms in rendered email content
// ---------------------------------------------------------------------------

test('email templates contain no India-specific currency or copy', () => {
  const source = read('lib/email-templates.ts')
  for (const term of ['India', 'Indian', 'INR', '₹', 'Rupee', 'rupees', '1999', '4999']) {
    assert.doesNotMatch(source, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `email templates must not contain ${term}`)
  }
  // The US tagline is present.
  assert.match(source, /Connecting homebuyers with trusted mortgage professionals across the United States/)
})

test('rendered broker welcome email is US-oriented and includes a verification CTA', () => {
  const t = emailTemplates.brokerWelcome('Jane Doe', 'https://homeloanmarket.com/auth/verify-email?token=x')
  assert.match(t.subject, /Verify your email/)
  assert.match(t.html, /Welcome to HomeLoanMarket/)
  assert.match(t.html, /Verify Your Email/)
  assert.doesNotMatch(t.html, /across India/)
  assert.doesNotMatch(t.html, /₹/)
})

test('rendered subscription email uses the actual plan price, not hardcoded values', () => {
  const plan = { name: 'Featured', price: 1500, currency: 'usd', billingInterval: 'month' }
  const t = emailTemplates.subscriptionPurchased(
    { displayName: 'Acme Mortgage', profileSlug: 'acme' },
    { plan: 'FEATURED', startDate: new Date(), endDate: null },
    plan,
  )
  assert.match(t.html, /\$15\.00\/month/)
  assert.match(t.html, /Featured plan/)
  assert.doesNotMatch(t.html, /1999/)
  assert.doesNotMatch(t.html, /4999/)
  assert.doesNotMatch(t.html, /₹/)
})

test('subscription email without a plan falls back to truthful generic text', () => {
  const t = emailTemplates.subscriptionPurchased(
    { displayName: 'Acme', profileSlug: 'acme' },
    { plan: 'FEATURED', startDate: new Date(), endDate: null },
    undefined,
  )
  assert.match(t.html, /Free|plan is now active/)
})

test('new lead email formats loan amount as USD', () => {
  const t = emailTemplates.newLead(
    { displayName: 'Acme' },
    { id: 'l1', name: 'Bob', phone: '555', email: 'b@x.com', city: 'Houston', loanAmount: 350000, loanType: 'Conventional', propertyType: 'Single Family', timeline: 'Immediate', createdAt: new Date() },
  )
  assert.match(t.html, /\$350,000\.00/)
  assert.doesNotMatch(t.html, /₹/)
  assert.doesNotMatch(t.html, /INR/)
})

test('company/broker/user shared verification wording is generic', () => {
  const t = emailTemplates.resendVerification('Pat', 'https://homeloanmarket.com/auth/verify-email?token=y')
  assert.match(t.html, /verify your email address to finish setting up your HomeLoanMarket account/)
  assert.doesNotMatch(t.html, /broker marketplace|India/)
})

// ---------------------------------------------------------------------------
// Link / URL integrity
// ---------------------------------------------------------------------------

test('email links use the application base URL and correct US routes', () => {
  const t = emailTemplates.passwordReset('Pat', 'https://homeloanmarket.com/auth/reset-password?token=z', 1)
  assert.match(t.html, /https:\/\/homeloanmarket\.com\/auth\/reset-password\?token=z/)
  assert.match(t.html, /Reset Your Password/)
  const footer = emailTemplates.notification('Title', 'Body', {})
  assert.match(footer.html, /\/privacy-policy/)
  assert.match(footer.html, /\/terms-of-service/)
})

test('email links never point to localhost', () => {
  const source = read('lib/email-templates.ts')
  assert.doesNotMatch(source, /http:\/\/localhost/)
})

// ---------------------------------------------------------------------------
// Plain text fallback
// ---------------------------------------------------------------------------

test('htmlToText produces meaningful text and preserves links', () => {
  const text = htmlToText('<p>Hello <a href="https://homeloanmarket.com/dashboard">Open Dashboard</a></p>')
  assert.match(text, /Hello/)
  assert.match(text, /Open Dashboard \(https:\/\/homeloanmarket\.com\/dashboard\)/)
  assert.doesNotMatch(text, /<a|<\/a/)
})

test('email.ts derives plain text via htmlToText (links preserved)', () => {
  const email = read('lib/email.ts')
  assert.match(email, /htmlToText/)
})

// ---------------------------------------------------------------------------
// Variable safety: undefined values do not break output
// ---------------------------------------------------------------------------

test('template helpers tolerate missing optional data', () => {
  const lead = emailTemplates.newLead(
    { displayName: 'Acme' },
    { id: 'l1', name: 'Bob', phone: '555', email: null, city: null, loanAmount: null, loanType: null, propertyType: null, timeline: null, createdAt: new Date() },
  )
  assert.match(lead.html, /Not provided|Not specified/)
})

// ---------------------------------------------------------------------------
// Registration / field localization
// ---------------------------------------------------------------------------

test('wizard no longer contains India-specific GST/Aadhaar fields', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.doesNotMatch(wizard, /gstNumber/)
  assert.doesNotMatch(wizard, /aadhaarCard/)
  assert.doesNotMatch(wizard, /indianCities/)
})

test('wizard labels the broker tax field as a US Tax ID / EIN', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.match(wizard, /Tax ID \/ EIN/)
  assert.doesNotMatch(wizard, /Permanent Account Number/)
})

test('broker profile tax field is labeled as a US tax identifier', () => {
  const edit = read('components/sections/broker/EditProfile.tsx')
  assert.match(edit, /Your business tax identifier \(EIN or individual tax ID\)/)
  assert.doesNotMatch(edit, /Permanent Account Number/)
})

test('admin broker form and export use a US tax label', () => {
  const adminForm = read('app/admin/brokers/create/AdminBrokerForm.tsx')
  const exportRoute = read('app/api/admin/brokers/export/route.ts')
  assert.match(adminForm, /Tax ID \/ EIN/)
  assert.doesNotMatch(adminForm, /PAN \/ tax number/)
  assert.match(exportRoute, /Tax ID \/ EIN/)
  assert.doesNotMatch(exportRoute, /PAN \/ tax number/)
})