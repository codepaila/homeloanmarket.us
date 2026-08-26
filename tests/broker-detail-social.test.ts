import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const detail = fs.readFileSync('components/sections/broker/BrokerDetailClient.tsx', 'utf8')
const pub = fs.readFileSync('lib/public-broker.ts', 'utf8')
const skeleton = fs.readFileSync('components/design/BrokerDetailSkeleton.tsx', 'utf8')

// ==================== DATA FLOW — socialLinks reaches the public client ====================

test('public client receives socialLinks from the broker record', () => {
  assert.match(detail, /socialLinks,/)
  assert.match(detail, /<SocialSection socialLinks=\{socialLinks\} \/>/)
})

test('public serializer keeps socialLinks while stripping private broker fields', () => {
  // socialLinks survives via the public spread…
  assert.match(pub, /\.\.\.publicBroker/)
  // …while private/administrative fields are explicitly removed.
  assert.match(pub, /email: _email,/)
  assert.match(pub, /phone: _phone,/)
  assert.match(pub, /userId: _userId,/)
  assert.match(pub, /subscription: _subscription,/)
  assert.match(pub, /registrationNumber: _registrationNumber,/)
  assert.match(pub, /panNumber: _panNumber,/)
  assert.match(pub, /mortgageExpertEnabled: _mortgageExpertEnabled,/)
})

// ==================== RENDERING — each platform from socialLinks ====================

test('each supported platform is mapped with a recognizable label and icon', () => {
  assert.match(detail, /key: 'facebook', label: 'Facebook', icon: Facebook/)
  assert.match(detail, /key: 'twitter', label: 'X', icon: Twitter/)
  assert.match(detail, /key: 'linkedin', label: 'LinkedIn', icon: Linkedin/)
  assert.match(detail, /key: 'instagram', label: 'Instagram', icon: Instagram/)
})

test('each rendered social link is an accessible external link', () => {
  assert.match(detail, /target="_blank"/)
  assert.match(detail, /rel="noopener noreferrer"/)
  assert.match(detail, /aria-label=\{accessibleName\}/)
  assert.match(detail, /accessibleName: 'Facebook profile'/)
  assert.match(detail, /accessibleName: 'X \(Twitter\) profile'/)
  assert.match(detail, /accessibleName: 'LinkedIn profile'/)
  assert.match(detail, /accessibleName: 'Instagram profile'/)
})

test('social links are safe: only HTTP(S) values pass the filter', () => {
  assert.match(detail, /isSafeHttpUrl/)
  assert.match(detail, /typeof value === 'string' && isSafeHttpUrl\(value\)/)
})

test('section is omitted when no safe social links exist (no empty cards)', () => {
  assert.match(detail, /if \(links\.length === 0\) return null/)
  // Never render label placeholder rows like "Facebook:" or "Facebook: —".
  assert.doesNotMatch(detail, /Facebook: —|Facebook:\s*\{|: —/)
})

// ==================== COVER IMAGE ====================

test('detail page uses the existing coverImage in the hero banner', () => {
  assert.match(detail, /coverImage \? \(/)
  assert.match(detail, /src=\{coverImage\}/)
  assert.match(detail, /className="object-cover object-center"/)
})

test('cover uses the established muted fallback, not an invented stock image', () => {
  assert.match(detail, /<div className="absolute inset-0 bg-muted" \/>/)
})

// ==================== SKELETON ====================

test('skeleton mirrors the cover placeholder with identical responsive heights', () => {
  assert.match(skeleton, /h-48 w-full rounded-b-3xl md:h-72 lg:h-80/)
})

test('skeleton mirrors the profile header (avatar + name + metadata)', () => {
  assert.match(skeleton, /h-32 w-32 rounded border-2 border-background shadow-large/)
  assert.match(skeleton, /SkeletonHeading className="h-9 w-64 max-w-full md:h-10"/)
})

test('skeleton contains a Social Profiles placeholder matching the loaded section', () => {
  assert.match(skeleton, /Social Profiles: heading/)
  assert.match(skeleton, /SkeletonHeading className="h-6 w-32"/)
  assert.match(skeleton, /flex flex-wrap gap-2/)
  assert.match(skeleton, /h-9 w-24 rounded-lg/)
})

test('skeleton social block is a sibling in the same spacing rhythm as the real page', () => {
  // Real page renders ContactSection + SocialSection as siblings in a
  // space-y-8 aside; skeleton keeps the same rhythm.
  const realAside = detail.slice(detail.indexOf('<aside className="lg:col-span-1'))
  assert.match(realAside, /space-y-8 lg:sticky/)
  assert.match(skeleton, /<aside className="space-y-8 lg:self-start">/)
})

// ==================== RESPONSIVE ====================

test('social pills wrap without horizontal overflow on narrow screens', () => {
  assert.match(detail, /<div className="flex flex-wrap gap-2">/)
})
