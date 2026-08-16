import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const registerPage = read('app/(public)/company/register/page.tsx')
const header = read('components/layout/Header.tsx')
const authConfig = read('lib/auth.config.ts')
const useCurrentUser = read('hooks/useCurrentUser.ts')
const card = read('components/brokers/BrokerGridCard.tsx')
const sessionTypes = read('types/next-auth.d.ts')

test('company register page redirects authenticated brokers to the broker dashboard', () => {
  assert.match(registerPage, /user\?\.isBroker\) redirect\('\/broker\/dashboard'\)/)
})

test('company register page redirects existing company users to the company dashboard', () => {
  assert.match(registerPage, /companyMemberships\.length > 0\) redirect\('\/company\/dashboard'\)/)
})

test('company register page is server-rendered and defers to the client form', () => {
  assert.match(registerPage, /getCurrentUser/)
  assert.match(registerPage, /<CompanyRegisterForm \/>/)
})

test('header shows a role-aware dashboard/company entry', () => {
  assert.match(header, /name: 'Broker Dashboard'/)
  assert.match(header, /name: 'Company Dashboard'/)
  assert.match(header, /name: 'Join As Company'/)
  assert.match(header, /!user/)
  assert.match(header, /user\.isBroker/)
  assert.match(header, /user\.isCompany/)
})

test('Join As Company is only shown for unauthenticated visitors', () => {
  assert.match(header, /!user\s*\?\s*\{ name: 'Join As Company', href: '\/company\/register'/)
})

test('no duplicate dashboard link remains in the mobile menu auth section', () => {
  // The mobile menu auth section must not re-add a broker Dashboard link
  // because the main nav items already include "Broker Dashboard".
  const mobileAuth = header.slice(header.indexOf('function MobileMenu'))
  assert.doesNotMatch(mobileAuth, /user\.isBroker && \(\s*<Link\s*href="\/broker\/dashboard"/)
})

test('account dropdown routes Dashboard to the correct role dashboard', () => {
  assert.match(header, /user\.isCompany && \(\s*<Link\s*href="\/company\/dashboard"/)
  assert.match(header, /user\.isBroker && \(\s*<Link\s*href="\/broker\/dashboard"/)
})

test('session exposes isCompany for navigation', () => {
  assert.match(authConfig, /companyMemberships:/)
  assert.match(authConfig, /where: \{ isActive: true \}/)
  assert.match(authConfig, /token\.isCompany = Boolean\(dbUser\.companyMemberships\?\.length\)/)
  assert.match(authConfig, /isCompany: token\.isCompany as boolean/)
  assert.match(sessionTypes, /isCompany\?: boolean/)
  assert.match(useCurrentUser, /isCompany: user\.isCompany === true/)
})

test('broker card shows only name, company, NMLS, and location', () => {
  assert.match(card, /NMLS #\{nmls\}/)
  assert.match(card, /<MapPin/)
  assert.doesNotMatch(card, /description/)
  assert.doesNotMatch(card, /phone/)
  assert.doesNotMatch(card, /email/)
  assert.doesNotMatch(card, /rating/i)
  assert.doesNotMatch(card, /isVerified/)
  assert.doesNotMatch(card, /isFeatured/)
  assert.doesNotMatch(card, /supportedBanks/)
  assert.doesNotMatch(card, /yearsExperience/)
})
