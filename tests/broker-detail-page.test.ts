import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const detail = fs.readFileSync('components/sections/broker/BrokerDetailClient.tsx', 'utf8')
const page = fs.readFileSync('app/(public)/brokers/[slug]/page.tsx', 'utf8')
const avatar = fs.readFileSync('components/brokers/BrokerAvatar.tsx', 'utf8')

test('profile image renders via BrokerAvatar with profileImage then logo fallback', () => {
  assert.match(detail, /<BrokerAvatar src=\{profileImage \|\| logo\}/)
})

test('neutral fallback initials render when no image is available', () => {
  assert.match(avatar, /const initials =/)
  assert.match(avatar, /\.split\(' '\)/)
  assert.match(avatar, /onError=\{\(\) => setError\(true\)\}/)
})

test('broker detail never uses User.image as the broker photo', () => {
  assert.doesNotMatch(detail, /BrokerAvatar src=\{logo\}/)
  const header = detail.slice(detail.indexOf('<header className="mt-20'), detail.indexOf('</header>'))
  assert.doesNotMatch(header, /user\?\.image/)
})

test('broker name, NMLS, and company are shown in order', () => {
  const header = detail.slice(detail.indexOf('<header className="mt-20'), detail.indexOf('</header>'))
  assert.match(header, /<h1[^>]*>\s*\{displayName\}/)
  assert.ok(header.indexOf('{displayName}') < header.indexOf('{nmls}'), 'name precedes NMLS')
  assert.ok(header.indexOf('NMLS #{nmls}') < header.indexOf('{companyName}'), 'NMLS precedes company')
  assert.match(header, /\{nmls &&/)
  assert.match(header, /\{companyName &&/)
})

test('phone, email, and website use safe links', () => {
  assert.match(detail, /href=\{`tel:\$\{phone\}`\}/)
  assert.match(detail, /href=\{`mailto:\$\{email\}`\}/)
  assert.match(detail, /target="_blank"/)
  assert.match(detail, /rel="noopener noreferrer"/)
})

test('website URL is normalized to a valid external href', () => {
  assert.match(detail, /websiteHref = website && !\/\^https\?:/)
  assert.match(detail, /`https:\/\/\$\{website\}` : website/)
  assert.match(detail, /websiteDisplay = \(website \|\| ''\)\.replace\(/)
  assert.match(detail, /\.replace\(\/\^https\?:/)
})

test('address composes street, city, state, and zip without empty parts', () => {
  assert.match(detail, /\[officeAddress, city, state, pinCode\]\.filter\(Boolean\)\.join\(', '\)/)
})

test('missing optional fields render no empty rows', () => {
  assert.match(detail, /\{phone && \(/)
  assert.match(detail, /\{email && \(/)
  assert.match(detail, /\{website && websiteHref && \(/)
  assert.match(detail, /addressLines && \(/)
  assert.match(detail, /\{averageResponseTime && \(/)
  assert.doesNotMatch(detail, />Phone:<|>Email:<|>Website:<|>Address:</)
})

test('long contact values never overflow horizontally', () => {
  assert.match(detail, /min-w-0 flex-1/)
  assert.match(detail, /break-all/)
  assert.match(detail, /break-words/)
  assert.match(detail, /shrink-0/)
})

test('contact section uses flat rows with subtle dividers, not rounded cards', () => {
  assert.match(detail, /divide-y divide-border border-y border-border/)
  assert.doesNotMatch(detail, /Contact Information/)
  assert.match(detail, /<h2 className="text-lg font-bold text-text-main">Contact<\/h2>/)
})

test('accessibility: decorative icons are hidden and tabs expose current selection', () => {
  assert.match(detail, /aria-hidden="true"/)
  assert.match(detail, /aria-current=\{isActive \? 'page' : undefined\}/)
  assert.match(detail, /aria-label="Broker information"/)
})

test('loading state preserves a stable placeholder layout', () => {
  assert.match(detail, /Skeleton className="h-64 w-full rounded-b-3xl mb-8"/)
})

test('SEO metadata preserves title, canonical, description, and structured data', () => {
  assert.match(page, /generateMetadata/)
  assert.match(page, /canonicalUrl\(`\/brokers\/\$\{slug\}`\)/)
  assert.match(page, /type="application\/ld\+json"/)
  assert.match(page, /'@type': 'LocalBusiness'/)
  assert.match(page, /robots: \{ index: true, follow: true \}/)
})
