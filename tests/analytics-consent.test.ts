import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (p: string) => fs.readFileSync(p, 'utf8')

const consent = read('lib/analytics/consent.ts')
const provider = read('lib/analytics/provider.tsx')
const events = read('lib/analytics/events.ts')
const banner = read('components/analytics/CookieBanner.tsx')
const layout = read('app/layout.tsx')
const envExample = read('.env.example')
const privacy = read('app/(public)/privacy-policy/page.tsx')

// ---------------------------------------------------------------------------
// 1 & 2. Environment-variable handling (no hardcoded IDs)
// ---------------------------------------------------------------------------

test('GA / GTM IDs are read from env vars, never hardcoded', () => {
  assert.match(provider, /NEXT_PUBLIC_GA_MEASUREMENT_ID/)
  assert.match(provider, /NEXT_PUBLIC_GTM_ID/)
  assert.doesNotMatch(provider, /G-[A-Z0-9]{6,}/, 'no hardcoded GA measurement id')
  assert.doesNotMatch(provider, /GTM-[A-Z0-9]{6,}/, 'no hardcoded GTM container id')
})

test('.env.example documents both vars as empty', () => {
  assert.match(envExample, /NEXT_PUBLIC_GA_MEASUREMENT_ID=/)
  assert.match(envExample, /NEXT_PUBLIC_GTM_ID=/)
})

// ---------------------------------------------------------------------------
// 3. Missing IDs => analytics disabled
// ---------------------------------------------------------------------------

test('scripts only mount when consent is accepted', () => {
  assert.match(provider, /consent !== "accepted"\) return null/)
})

test('both GA and GTM are gated behind an env ID', () => {
  assert.match(provider, /GTM_ID && <GoogleTagManager/)
  assert.match(provider, /GA_ID && <GoogleAnalytics/)
})

// ---------------------------------------------------------------------------
// 4, 5, 6, 7, 8. Consent state / persistence / change
// ---------------------------------------------------------------------------

test('default consent state is denied (Consent Mode)', () => {
  assert.match(provider, /pushConsentDefault\("denied"\)/)
  assert.match(provider, /analytics_storage: state/)
})

test('consent persists via localStorage helper', () => {
  assert.match(consent, /getStoredConsent/)
  assert.match(consent, /setStoredConsent/)
  // Store the choice so a reload restores it.
  assert.match(consent, /localStorage\.setItem/)
})

test('accepted / rejected consent updates the Google consent state', () => {
  assert.match(provider, /choice === "accepted" \? "granted" : "denied"/)
  assert.match(provider, /pushConsentUpdate/)
})

test('reject keeps analytics storage denied and blocks ad signals', () => {
  assert.match(provider, /ad_storage: "denied"/)
  assert.match(provider, /ad_user_data: "denied"/)
  assert.match(provider, /ad_personalization: "denied"/)
})

test('a manage/change preference path exists', () => {
  assert.match(provider, /resetConsent/)
  assert.match(banner, /Reject Analytics/)
  assert.match(banner, /Accept Analytics/)
})

// ---------------------------------------------------------------------------
// 9. No analytics before consent
// ---------------------------------------------------------------------------

test('no analytics scripts are rendered before consent', () => {
  // GoogleScripts refuses to render any third-party script while consent is pending/denied.
  assert.match(provider, /if \(consent !== "accepted"\) return null/)
  // Both third-party components are mounted only inside the accepted branch.
  const acceptedOnly = /accepted"\) return null[\s\S]*<GoogleTagManager[\s\S]*<GoogleAnalytics/
  assert.match(provider, acceptedOnly)
})

// ---------------------------------------------------------------------------
// 10. No duplicate initialization
// ---------------------------------------------------------------------------

test('GoogleAnalytics and GoogleTagManager are each mounted at most once', () => {
  assert.match(provider, /<GoogleTagManager gtmId=\{GTM_ID\} \/>/)
  assert.match(provider, /<GoogleAnalytics gaId=\{GA_ID\} \/>/)
})

// ---------------------------------------------------------------------------
// 11. No PII in event helper
// ---------------------------------------------------------------------------

test('event helper strips PII fields before pushing', () => {
  assert.match(events, /\.includes\("email"\)/)
  assert.match(events, /\.includes\("phone"\)/)
  assert.match(events, /\.includes\("name"\)/)
  assert.match(events, /\.includes\("nmls"\)/)
  assert.match(events, /typeof window === "undefined"\) return/)
  assert.match(events, /!window\.dataLayer\) return/)
})

// ---------------------------------------------------------------------------
// 12. SSR safety
// ---------------------------------------------------------------------------

test('consent helpers guard against window access during SSR', () => {
  assert.match(consent, /typeof window === "undefined"\) return null/)
  assert.match(consent, /typeof window === "undefined"\) return/)
  assert.match(events, /typeof window === "undefined"\) return/)
})

// ---------------------------------------------------------------------------
// 13. Mounted centrally in root layout, no per-page scripts
// ---------------------------------------------------------------------------

test('analytics provider is mounted once in the root layout', () => {
  assert.match(layout, /AnalyticsProvider/)
  assert.match(layout, /<AnalyticsProvider>/)
})

test('no analytics scripts placed inside individual page components', () => {
  const pages = fs
    .readdirSync('app', { recursive: true })
    .filter((f) => typeof f === 'string' && f.endsWith('.tsx') && f.includes('page'))
  for (const page of pages) {
    const text = read(`app/${page}`)
    assert.doesNotMatch(text, /GoogleAnalytics/, `no GA in ${page}`)
    assert.doesNotMatch(text, /GoogleTagManager/, `no GTM in ${page}`)
  }
})

// ---------------------------------------------------------------------------
// Privacy documentation
// ---------------------------------------------------------------------------

test('privacy policy documents analytics cookies and consent behavior', () => {
  assert.match(privacy, /Analytics & Cookies/)
  assert.match(privacy, /Google Analytics/)
  assert.match(privacy, /Google Tag Manager/)
  assert.match(privacy, /consent/)
})

// ---------------------------------------------------------------------------
// Accessibility of banner
// ---------------------------------------------------------------------------

test('banner uses a semantic region and accessible labels', () => {
  assert.match(banner, /role="region"/)
  assert.match(banner, /aria-label="Cookie consent"/)
  assert.match(banner, /aria-hidden="true"/)
})
