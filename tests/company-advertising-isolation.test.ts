import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const registerPage = read('app/(public)/company/register/CompanyRegisterForm.tsx')
const registerRoute = read('app/api/company/register/route.ts')
const checkout = read('app/api/company/subscription/checkout/route.ts')
const verifyEmail = read('app/api/auth/verify-email/route.ts')
const plansSelectPage = read('app/company/subscription/select/page.tsx')
const companyIntent = read('app/api/auth/company-intent/route.ts')
const companyIntentLib = read('lib/company-intent.ts')
const subscription = read('lib/subscription.ts')
const companyPlan = read('lib/company-plan.ts')
const schema = read('prisma/schema.prisma')
const onboardingPage = read('app/company/onboarding/page.tsx')
const onboardingRoute = read('app/api/company/onboarding/route.ts')
const dashboardPage = read('app/company/dashboard/page.tsx')
const couponLib = read('lib/company-coupon.ts')

test('company registration form is account-only (Full name, email, password, confirm)', () => {
  assert.match(registerPage, /label="Full name"/)
  assert.match(registerPage, /confirmPassword/)
  assert.match(registerPage, /payload = \{ name: data\.name, email: data\.email, password: data\.password \}/)
  assert.doesNotMatch(registerPage, /companyName/)
  assert.doesNotMatch(registerPage, /bannerAddress/)
  assert.doesNotMatch(registerPage, /contactPosition/)
})

test('company registration API does not require company business fields', () => {
  assert.doesNotMatch(registerRoute, /body\.companyName/)
  assert.doesNotMatch(registerRoute, /body\.bannerAddress/)
  assert.doesNotMatch(registerRoute, /body\.contactPosition/)
  assert.match(registerRoute, /type: 'OTHER'/)
  assert.match(registerRoute, /status: 'PENDING'/)
})

test('company registration never creates broker entities', () => {
  assert.match(registerRoute, /role: 'USER'/)
  assert.doesNotMatch(registerRoute, /brokerSubscription/)
  assert.doesNotMatch(registerRoute, /brokerRegistration/)
  assert.doesNotMatch(registerRoute, /role: 'BROKER'/)
})

test('company checkout has no global price fallback and fails clearly', () => {
  assert.doesNotMatch(checkout, /STRIPE_COMPANY_AD_PRICE_ID/)
  assert.match(checkout, /Company advertising plan is not configured for checkout/)
})

test('verified company is routed to company advertising plans, not the dashboard', () => {
  assert.match(verifyEmail, /companyMemberships\?\.length \? '\/company\/subscription\/select'/)
  assert.doesNotMatch(verifyEmail, /companyMemberships\?\.length \? '\/company\/dashboard'/)
})

test('company plan selection page loads plans and submits the selected planId', () => {
  assert.match(plansSelectPage, /\/api\/company\/subscription\/plans/)
  assert.match(plansSelectPage, /planId: plan\.id/)
})

test('an explicit inactive or missing planId never silently substitutes another plan', () => {
  assert.match(companyPlan, /if \(planId\) \{\s*return getCompanyAdvertisingPlan\(planId\)/)
  assert.doesNotMatch(companyPlan, /plans\[0\]\s*\}\s*\}/)
})

test('webhook dispatcher routes company events by ownerType and never into broker models', () => {
  assert.match(subscription, /ownerType === 'COMPANY'/)
  assert.match(subscription, /ownerType === 'BROKER_REGISTRATION'/)
  assert.match(subscription, /updateCompanySubscriptionFromStripe\(/)
})

test('Google company intent exists and establishes Company + Membership', () => {
  assert.match(companyIntentLib, /companyMembership\.findFirst/)
  assert.match(companyIntentLib, /company\.create/)
  assert.match(companyIntentLib, /memberships: \{ create:/)
  assert.match(companyIntent, /company-intent/ig)
})

test('company models remain isolated from the broker SubscriptionPlan enum', () => {
  const companySub = schema.slice(schema.indexOf('model CompanySubscription'), schema.indexOf('model CompanyAdvertisingPlan'))
  assert.match(companySub, /planId\s+String\?\s+@db\.ObjectId/)
  assert.doesNotMatch(companySub, /SubscriptionPlan/)
  assert.match(schema, /advertisingPlan\s+CompanyAdvertisingPlan\?/)
})

test('company onboarding collects business fields with the exact company type options', () => {
  assert.match(onboardingPage, /Company name/)
  assert.match(onboardingPage, /Company address/)
  assert.match(onboardingPage, /Your position/)
  assert.match(onboardingPage, /bannerAddress/)
  assert.match(onboardingPage, /Home Loan Company/)
  assert.match(onboardingPage, /HELOC Company/)
  assert.match(onboardingPage, /DSCR Loan Company/)
  assert.match(onboardingPage, /Title Company/)
  assert.match(onboardingPage, /Home Insurance Company/)
  assert.match(onboardingPage, /Other/)
})

test('company onboarding completes the company and marks it active', () => {
  assert.match(onboardingRoute, /status: 'ACTIVE'/)
  assert.match(onboardingRoute, /onboardedAt:/)
  assert.match(onboardingRoute, /getCurrentCompany/)
  assert.doesNotMatch(onboardingRoute, /brokerSubscription/)
})

test('company dashboard redirects to onboarding until the company is onboarded', () => {
  assert.match(dashboardPage, /onboardedAt/)
  assert.match(dashboardPage, /redirect\('\/company\/onboarding'\)/)
})

test('company coupon validation is server-side via Stripe promotion codes and fails closed', () => {
  assert.match(couponLib, /promotionCodes\.list\(\{ code/)
  assert.match(couponLib, /Coupon validation is unavailable|This promotion code is not valid/)
  assert.doesNotMatch(couponLib, /process\.env\.STRIPE_SECRET_KEY\s*=\s*/)
  assert.doesNotMatch(couponLib, /stripe\.coupons\.retrieve\(normalized\)/)
})

test('checkout applies a server-validated promotion code and never trusts client discounts', () => {
  assert.match(checkout, /validateCompanyCoupon/)
  assert.match(checkout, /discounts: \[\{ promotion_code: coupon\.promotionCodeId \}\]/)
})
