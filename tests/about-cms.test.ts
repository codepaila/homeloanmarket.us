import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ────────────────────────────────────────────────────────────────
// Runtime imports (pure values, no DB required)
// ────────────────────────────────────────────────────────────────
import {
  ABOUT_PAGE_ID,
  DYNAMIC_STAT_TYPES,
  ABOUT_BENEFIT_ICONS,
  STATIC_STAT_TYPE,
} from '../lib/about/about'

// ════════════════════════════════════════════════════════════════
// 1. CONSTANT / CONFIGURATION INVARIANTS
// ════════════════════════════════════════════════════════════════

test('ABOUT_PAGE_ID is a valid 24-char hex MongoDB ObjectId', () => {
  assert.equal(ABOUT_PAGE_ID.length, 24)
  assert.ok(/^[0-9a-f]{24}$/.test(ABOUT_PAGE_ID), `Expected hex ObjectId, got: ${ABOUT_PAGE_ID}`)
})

test('DYNAMIC_STAT_TYPES includes exactly the three expected types', () => {
  assert.deepEqual([...DYNAMIC_STAT_TYPES], [
    'DYNAMIC_ORIGINATORS',
    'DYNAMIC_STATES',
    'DYNAMIC_CITIES',
  ])
})

test('STATIC_STAT_TYPE is the string STATIC', () => {
  assert.equal(STATIC_STAT_TYPE, 'STATIC')
})

test('ABOUT_BENEFIT_ICONS contains only valid Lucide icon names', () => {
  const expected = ['Users', 'TrendingUp', 'Shield', 'Award', 'Home', 'MapPin', 'Sparkles', 'CheckCircle2']
  assert.deepEqual([...ABOUT_BENEFIT_ICONS], expected)
})

// ════════════════════════════════════════════════════════════════
// 2. PRISMA SCHEMA INVARIANTS
// ════════════════════════════════════════════════════════════════

test('schema defines AboutPage model with singleton id', () => {
  const schema = read('prisma/schema.prisma')
  assert.ok(schema.includes('model AboutPage'), 'AboutPage model must exist')
  assert.ok(schema.includes('id           String @id'), 'AboutPage must have String @id')
  assert.ok(schema.includes('@@map("about_page")'), 'AboutPage must map to about_page')
})

test('schema defines AboutStat model with foreign key to AboutPage', () => {
  const schema = read('prisma/schema.prisma')
  assert.ok(schema.includes('model AboutStat'), 'AboutStat model must exist')
  assert.ok(schema.includes('aboutPage    AboutPage'), 'AboutStat must reference AboutPage')
  assert.ok(schema.includes('onDelete: Cascade'), 'AboutStat must cascade on delete')
  assert.ok(schema.includes('@@map("about_stats")'), 'AboutStat must map to about_stats')
})

test('schema defines AboutBenefit model with foreign key to AboutPage', () => {
  const schema = read('prisma/schema.prisma')
  assert.ok(schema.includes('model AboutBenefit'), 'AboutBenefit model must exist')
  assert.ok(schema.includes('aboutPage   AboutPage @relation'), 'AboutBenefit must have relation to AboutPage')
  assert.ok(schema.includes('@@map("about_benefits")'), 'AboutBenefit must map to about_benefits')
})

test('schema defines AboutStatType enum with exactly 4 values', () => {
  const schema = read('prisma/schema.prisma')
  assert.ok(schema.includes('enum AboutStatType'), 'AboutStatType enum must exist')
  const match = schema.match(/enum AboutStatType\s*\{([^}]+)\}/)
  assert.ok(match, 'AboutStatType enum must have a body')
  const values = match[1].trim().split('\n').map((v: string) => v.trim()).filter(Boolean)
  assert.equal(values.length, 4, `Expected 4 enum values, got ${values.length}: ${values.join(', ')}`)
  assert.ok(values.includes('DYNAMIC_ORIGINATORS'))
  assert.ok(values.includes('DYNAMIC_STATES'))
  assert.ok(values.includes('DYNAMIC_CITIES'))
  assert.ok(values.includes('STATIC'))
})

test('AboutStat has displayOrder index', () => {
  const schema = read('prisma/schema.prisma')
  assert.ok(schema.includes('@@index([aboutPageId, displayOrder])'), 'AboutStat must have composite index on aboutPageId+displayOrder')
})

test('AboutBenefit has displayOrder index', () => {
  const schema = read('prisma/schema.prisma')
  const benefitSection = schema.substring(schema.indexOf('model AboutBenefit'))
  assert.ok(benefitSection.includes('@@index([aboutPageId, displayOrder])'), 'AboutBenefit must have composite index on aboutPageId+displayOrder')
})

test('AboutPage has all required section fields', () => {
  const schema = read('prisma/schema.prisma')
  const pageSection = schema.substring(schema.indexOf('model AboutPage'), schema.indexOf('model AboutStat'))
  const requiredFields = [
    'isActive', 'heroEnabled', 'heroEyebrow', 'heroTitle', 'heroDescription', 'heroImageUrl', 'heroImageAlt',
    'statsEnabled',
    'missionEnabled', 'missionTitle', 'missionContent', 'missionContent2', 'missionChecklist', 'missionImageUrl', 'missionImageAlt',
    'benefitsEnabled',
    'contactEnabled', 'contactTitle', 'contactEmail',
    'seoTitle', 'seoDescription', 'seoOgImageUrl',
  ]
  for (const field of requiredFields) {
    assert.ok(pageSection.includes(field), `AboutPage must have field: ${field}`)
  }
})

// ════════════════════════════════════════════════════════════════
// 3. PUBLIC PAGE ARCHITECTURE
// ════════════════════════════════════════════════════════════════

test('public about page uses getAboutPublicData (CMS-backed, not hardcoded)', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes('getAboutPublicData'), 'Must import getAboutPublicData')
  assert.ok(page.includes('getAboutSeo'), 'Must import getAboutSeo')
})

test('public about page generates metadata dynamically (not static export)', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes('generateMetadata'), 'Must export generateMetadata function')
  assert.ok(!page.match(/export\s+const\s+metadata\s*[:=]/), 'Must NOT use static metadata export')
})

test('public about page has JSON-LD structured data', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes('application/ld+json'), 'Must render JSON-LD script tags')
  assert.ok(page.includes('organizationJsonLd'), 'Must generate Organization schema via organizationJsonLd')
  assert.ok(page.includes("'@type': 'AboutPage'"), 'Must include AboutPage schema')
  assert.ok(page.includes('mainEntity'), 'AboutPage must link to Organization via mainEntity')
})

test('public about page uses safeJsonLd from lib/seo', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes('safeJsonLd'), 'Must use safeJsonLd for XSS-safe JSON serialization')
  assert.ok(page.includes("from '@/lib/seo'"), 'Must import from canonical seo module')
})

test('public about page uses organizationJsonLd from lib/seo', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes('organizationJsonLd'), 'Must use organizationJsonLd helper')
})

test('public about page returns notFound when inactive', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes('notFound()'), 'Must call notFound() when page is inactive')
})

test('public about page does not have hardcoded marketing text', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(!page.includes('5,000+'), 'Must not hardcode fabricated stat 5,000+')
  assert.ok(!page.includes('15,000+'), 'Must not hardcode fabricated stat 15,000+')
  assert.ok(!page.includes('4.9/5'), 'Must not hardcode fabricated stat 4.9/5')
  assert.ok(!page.includes('Trusted since 2018'), 'Must not hardcode eyebrow text')
})

test('public about page uses StatCard with value+label (no hardcoded icon prop)', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes('<StatCard'), 'Must render StatCard components')
  assert.ok(page.includes('value={stat.value}'), 'StatCard must receive value from CMS')
  assert.ok(page.includes('label={stat.label}'), 'StatCard must receive label from CMS')
})

test('public about page respects section enable/disable', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes('sections.hero &&'), 'Hero section must be conditional')
  assert.ok(page.includes('sections.stats &&'), 'Stats section must be conditional')
  assert.ok(page.includes('sections.mission &&'), 'Mission section must be conditional')
  assert.ok(page.includes('sections.benefits &&'), 'Benefits section must be conditional')
  assert.ok(page.includes('sections.contact &&'), 'Contact section must be conditional')
})

test('public about page has correct heading hierarchy', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes('<h1 '), 'Must have h1 for hero title')
  assert.ok(page.includes('<h2 '), 'Must have h2 for mission/contact titles')
  assert.ok(page.includes('<h3 '), 'Must have h3 for benefit titles')
})

test('public about page uses benefit icons from BENEFIT_ICONS map with fallback', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes('BENEFIT_ICONS'), 'Must define BENEFIT_ICONS lookup')
  assert.ok(page.includes('ShieldCheck'), 'Must have ShieldCheck fallback for unknown icons')
})

// ════════════════════════════════════════════════════════════════
// 4. ADMIN PAGE ARCHITECTURE
// ════════════════════════════════════════════════════════════════

test('admin about page uses getAboutAdminData', () => {
  const page = read('app/admin/content/about/page.tsx')
  assert.ok(page.includes('getAboutAdminData'), 'Must import getAboutAdminData')
})

test('admin about page renders AboutAdminForm', () => {
  const page = read('app/admin/content/about/page.tsx')
  assert.ok(page.includes('AboutAdminForm'), 'Must render AboutAdminForm component')
})

test('admin about page sets robots noindex', () => {
  const layout = read('app/admin/layout.tsx')
  assert.ok(layout.includes('robots'), 'Admin layout must set robots')
})

// ════════════════════════════════════════════════════════════════
// 5. ADMIN FORM ARCHITECTURE
// ════════════════════════════════════════════════════════════════

test('admin form uses useActionState with saveAboutPage', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(form.includes('useActionState'), 'Must use useActionState')
  assert.ok(form.includes('saveAboutPage'), 'Must use saveAboutPage action')
})

test('admin form has section toggle switches', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(form.includes('heroEnabled'), 'Must have hero toggle')
  assert.ok(form.includes('statsEnabled'), 'Must have stats toggle')
  assert.ok(form.includes('missionEnabled'), 'Must have mission toggle')
  assert.ok(form.includes('benefitsEnabled'), 'Must have benefits toggle')
  assert.ok(form.includes('contactEnabled'), 'Must have contact toggle')
  assert.ok(form.includes('isActive'), 'Must have master active toggle')
})

test('admin form uses MediaSelector for image fields', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(form.includes('MediaSelector'), 'Must use MediaSelector for image selection')
  assert.ok(form.includes('media/MediaSelector'), 'Must import from canonical media module')
})

test('admin form has repeatable stats CRUD', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(form.includes('Add Stat'), 'Must have add stat button')
  assert.ok(form.includes('Trash2'), 'Must have delete button for stats')
  assert.ok(form.includes('MoveUp'), 'Must have move-up button for reorder')
  assert.ok(form.includes('MoveDown'), 'Must have move-down button for reorder')
})

test('admin form has repeatable benefits CRUD', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(form.includes('Add Benefit'), 'Must have add benefit button')
  assert.ok(form.includes('benefitsId'), 'Must have hidden input for benefit IDs')
})

test('admin form has mission checklist management', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(form.includes('missionChecklist'), 'Must manage mission checklist')
  assert.ok(form.includes('Add Item'), 'Must have add checklist item button')
})

test('admin form submits boolean toggles as hidden inputs', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(form.includes('type="hidden" name="isActive"'), 'isActive must be submitted as hidden input')
  assert.ok(form.includes('type="hidden" name="heroEnabled"'), 'heroEnabled must be submitted as hidden input')
  assert.ok(form.includes('type="hidden" name="statsEnabled"'), 'statsEnabled must be submitted as hidden input')
  assert.ok(form.includes('type="hidden" name="missionEnabled"'), 'missionEnabled must be submitted as hidden input')
  assert.ok(form.includes('type="hidden" name="benefitsEnabled"'), 'benefitsEnabled must be submitted as hidden input')
  assert.ok(form.includes('type="hidden" name="contactEnabled"'), 'contactEnabled must be submitted as hidden input')
})

test('admin form shows success/error state from server action', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(form.includes('state?.error'), 'Must display error messages')
  assert.ok(form.includes('state?.ok'), 'Must display success messages')
})

test('admin form disables submit button while pending', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(form.includes('disabled={pending || !isDirty}'), 'Submit button must be disabled while pending or clean')
  assert.ok(form.includes("'Saving…'"), 'Must show saving state text')
})

test('admin form uses icon allowlist from lib/about/about', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(form.includes("from '@/lib/about/about'"), 'Must import from canonical about module')
  assert.ok(form.includes('ABOUT_BENEFIT_ICONS'), 'Must use ABOUT_BENEFIT_ICONS allowlist')
})

test('admin form uses stat type allowlist from lib/about/about', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(form.includes('DYNAMIC_STAT_TYPES'), 'Must use DYNAMIC_STAT_TYPES allowlist')
  assert.ok(form.includes('STATIC_STAT_TYPE'), 'Must use STATIC_STAT_TYPE constant')
})

// ════════════════════════════════════════════════════════════════
// 6. SERVER ACTION ARCHITECTURE
// ════════════════════════════════════════════════════════════════

test('server action requires admin authentication', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('requireAdmin'), 'Must call requireAdmin()')
  assert.ok(action.includes("user.role !== 'ADMIN'"), 'Must check ADMIN role')
  assert.ok(action.includes('Unauthorized'), 'Must return Unauthorized error')
})

test('server action uses getCurrentUser from canonical module', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes("from '@/lib/currentUser'"), 'Must import from canonical currentUser module')
})

test('server action validates images against MediaAsset', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('mediaAsset'), 'Must validate against MediaAsset')
  assert.ok(action.includes('isDeleted: false'), 'Must check isDeleted flag')
  assert.ok(action.includes('validateImageUrl'), 'Must have image validation function')
})

test('server action validates stat types against allowlist', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('ALL_STAT_TYPES'), 'Must validate against stat type allowlist')
  assert.ok(action.includes('invalid type'), 'Must return error for invalid stat type')
})

test('server action validates benefit icon keys against allowlist', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('ALLOWED_ICONS'), 'Must validate against icon allowlist')
  assert.ok(action.includes('unsupported icon'), 'Must return error for invalid icon')
})

test('server action validates email format', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('email'), 'Must validate email')
  assert.ok(action.includes('@'), 'Must check for @ in email')
})

test('server action validates string length limits', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('label.length > 80'), 'Must enforce stat label max length')
  assert.ok(action.includes('title.length > 90'), 'Must enforce benefit title max length')
})

test('server action validates static stat requires value', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('STATIC_STAT_TYPE'), 'Must check static stat type')
  assert.ok(action.includes('needs a value'), 'Must require static stat value')
})

test('server action uses prisma transaction', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('prisma.$transaction'), 'Must use database transaction')
})

test('server action calls revalidatePath after save', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes("revalidatePath('/about')"), 'Must revalidate /about')
  assert.ok(action.includes("revalidatePath('/admin/content/about')"), 'Must revalidate admin page')
})

test('server action uses upsert for singleton AboutPage', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('aboutPage.upsert'), 'Must use upsert for singleton')
})

test('server action deletes orphaned stats not in payload', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('statsToDelete'), 'Must track stats to delete')
  assert.ok(action.includes('aboutStat.deleteMany'), 'Must delete orphaned stats')
})

test('server action deletes orphaned benefits not in payload', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('benefitsToDelete'), 'Must track benefits to delete')
  assert.ok(action.includes('aboutBenefit.deleteMany'), 'Must delete orphaned benefits')
})

test('server action validates existing stat IDs before update', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('aboutStat.findUnique'), 'Must verify stat exists before update')
})

test('server action validates existing benefit IDs before update', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('aboutBenefit.findUnique'), 'Must verify benefit exists before update')
})

test('server action distinguishes new vs existing records by ID prefix', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes("startsWith('new-')"), 'Must use new- prefix for temporary IDs')
})

test('server action reports generic error on transaction failure', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('No changes were written'), 'Must indicate no partial writes on failure')
  assert.ok(action.includes('console.error'), 'Must log error for debugging')
})

// ════════════════════════════════════════════════════════════════
// 7. SERVICE / LIBRARY ARCHITECTURE
// ════════════════════════════════════════════════════════════════

test('seedAboutPage is idempotent (checks existing before create)', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes('findUnique'), 'Seed must check for existing record')
  assert.ok(lib.includes('if (existing) return existing'), 'Seed must return existing without overwriting')
})

test('seedAboutPage handles concurrent creation race condition (P2002)', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes("'P2002'"), 'Seed must handle P2002 unique constraint error')
  assert.ok(lib.includes('try'), 'Seed must have try/catch for race condition')
})

test('seedAboutPage creates default dynamic stats (not fabricated static)', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes("statType: 'DYNAMIC_ORIGINATORS'"), 'Seed must include DYNAMIC_ORIGINATORS')
  assert.ok(lib.includes("statType: 'DYNAMIC_STATES'"), 'Seed must include DYNAMIC_STATES')
  assert.ok(lib.includes("statType: 'DYNAMIC_CITIES'"), 'Seed must include DYNAMIC_CITIES')
})

test('seedAboutPage uses proper US terminology', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes('Mortgage Originators'), 'Must use Mortgage Originators terminology')
  assert.ok(!lib.match(/Mortgage\s+Broker[^s]/), 'Must NOT use Mortgage Broker terminology in seed')
})

test('getAboutPublicData uses React.cache', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes("cache(async function getAboutPublicData"), 'Must be wrapped in React cache')
})

test('getAboutSeo uses React.cache', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes("cache(async function getAboutSeo"), 'Must be wrapped in React cache')
})

test('getAboutAdminData resolves dynamic stats for preview', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes('dynamicStats'), 'Admin data must include dynamic stats preview')
  assert.ok(lib.includes('resolveDynamicStat'), 'Must call resolveDynamicStat for each type')
})

test('resolveDynamicStat uses publicBrokerWhere', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes('publicBrokerWhere()'), 'Must use canonical public broker eligibility')
})

test('resolveDynamicStat handles query failure gracefully (returns null)', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes('catch'), 'Must catch errors')
  assert.ok(lib.includes('return null'), 'Must return null on failure')
})

test('resolveAboutStats omits stats with null value (no fabricated zeros)', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes('if (value === null) continue'), 'Must skip stats with null value')
})

test('resolveAboutStats omits disabled stats', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes('if (!stat.enabled) continue'), 'Must skip disabled stats')
})

test('resolveAboutStats omits dynamic stats with zero count', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes('n > 0'), 'Must skip dynamic stats with zero count')
})

test('public data function returns active:false when page is inactive', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes("return { active: false, sections: null }"), 'Must return inactive state')
})

test('public DTO benefits do not expose database IDs', () => {
  const lib = read('lib/about/about.ts')
  const publicTypeMatch = lib.match(/benefits:\s*\{[^}]*items:\s*Array<\{([^}]+)\}>/)
  assert.ok(publicTypeMatch, 'Must define public benefits type')
  assert.ok(!publicTypeMatch[1].includes('id:'), 'Public benefits must not expose id field')
})

test('public DTO benefits include title, description, iconKey', () => {
  const lib = read('lib/about/about.ts')
  const publicTypeMatch = lib.match(/benefits:\s*\{[^}]*items:\s*Array<\{([^}]+)\}>/)
  assert.ok(publicTypeMatch, 'Must define public benefits type')
  assert.ok(publicTypeMatch[1].includes('title: string'), 'Must include title')
  assert.ok(publicTypeMatch[1].includes('description: string'), 'Must include description')
  assert.ok(publicTypeMatch[1].includes('iconKey: string'), 'Must include iconKey')
})

test('public data function filters benefits by enabled flag', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes('b.enabled'), 'Must filter benefits by enabled')
})

test('public data function sorts benefits by displayOrder', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes('a.displayOrder - b.displayOrder'), 'Must sort benefits by displayOrder')
})

// ════════════════════════════════════════════════════════════════
// 8. SEO ARCHITECTURE
// ════════════════════════════════════════════════════════════════

test('SEO metadata comes from CMS, not hardcoded', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes('seoTitle'), 'SEO title must come from CMS')
  assert.ok(lib.includes('seoDescription'), 'SEO description must come from CMS')
  assert.ok(lib.includes('seoOgImageUrl'), 'SEO OG image must come from CMS')
})

test('SEO falls back to sensible defaults when CMS fields are empty', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes("'About Us'"), 'Must fall back to About Us title')
  assert.ok(lib.includes('settings.siteDescription'), 'Must fall back to site description')
})

test('generateMetadata includes canonical URL', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes("canonical: '/about'"), 'Must set canonical URL')
})

test('generateMetadata includes OG image when available', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes('openGraph'), 'Must include OpenGraph metadata')
  assert.ok(page.includes('images'), 'Must include OG images')
})

test('JSON-LD uses safeJsonLd for XSS protection', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes('safeJsonLd(orgLd)'), 'Organization JSON-LD must use safeJsonLd')
  assert.ok(page.includes('safeJsonLd({'), 'AboutPage JSON-LD must use safeJsonLd')
})

test('JSON-LD Organization links to AboutPage via @id', () => {
  const page = read('app/(public)/about/page.tsx')
  assert.ok(page.includes('mainEntity'), 'AboutPage must reference Organization via mainEntity')
  assert.ok(page.includes("orgLd['@id']"), 'AboutPage mainEntity must use Organization @id')
})

// ════════════════════════════════════════════════════════════════
// 9. SITEMAP ARCHITECTURE
// ════════════════════════════════════════════════════════════════

test('sitemap conditionally includes /about based on CMS isActive', () => {
  const sitemap = read('app/sitemap.ts')
  assert.ok(sitemap.includes('aboutPage'), 'Must query AboutPage for isActive')
  assert.ok(sitemap.includes('isActive'), 'Must check isActive field')
  assert.ok(sitemap.includes('corePublicPaths'), 'Must use separate core paths array')
})

test('sitemap queries AboutPage in parallel with other data', () => {
  const sitemap = read('app/sitemap.ts')
  assert.ok(sitemap.includes('Promise.all'), 'Must use Promise.all for parallel queries')
})

test('sitemap imports ABOUT_PAGE_ID from canonical about module', () => {
  const sitemap = read('app/sitemap.ts')
  assert.ok(sitemap.includes("from '@/lib/about/about'"), 'Must import from canonical about module')
})

// ════════════════════════════════════════════════════════════════
// 10. CONTENT / TERMINOLOGY AUDIT
// ════════════════════════════════════════════════════════════════

test('no India-specific content in customer-facing About code', () => {
  const files = [
    'app/(public)/about/page.tsx',
    'lib/about/about.ts',
    'components/admin/about/AboutAdminForm.tsx',
  ]
  for (const file of files) {
    const content = read(file)
    assert.ok(!content.includes('India'), `${file} must not contain India reference`)
    assert.ok(!content.includes('INR'), `${file} must not contain INR reference`)
    assert.ok(!content.includes('₹'), `${file} must not contain ₹ symbol`)
    assert.ok(!content.includes('Indian'), `${file} must not contain Indian reference`)
  }
})

test('no hardcoded broker count / fabricated statistics', () => {
  const files = [
    'app/(public)/about/page.tsx',
    'lib/about/about.ts',
  ]
  for (const file of files) {
    const content = read(file)
    assert.ok(!content.includes("'5,000+'"), `${file} must not contain fabricated 5,000+`)
    assert.ok(!content.includes("'15,000+'"), `${file} must not contain fabricated 15,000+`)
    assert.ok(!content.includes("'4.9/5'"), `${file} must not contain fabricated 4.9/5`)
  }
})

test('no features.code dependency in About CMS', () => {
  const files = [
    'app/(public)/about/page.tsx',
    'lib/about/about.ts',
    'actions/about.ts',
    'components/admin/about/AboutAdminForm.tsx',
    'app/admin/content/about/page.tsx',
  ]
  for (const file of files) {
    const content = read(file)
    assert.ok(!content.includes('features.code'), `${file} must not depend on features.code`)
  }
})

test('no Mortgage Broker in customer-facing About seed content', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(!lib.match(/mortgage\s+broker(?!s)/i), 'Seed must not use Mortgage Broker terminology')
})

// ════════════════════════════════════════════════════════════════
// 11. MEDIA INTEGRATION
// ════════════════════════════════════════════════════════════════

test('about admin form uses canonical MediaSelector', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(form.includes("from '@/components/admin/media/MediaSelector'"), 'Must import from canonical media module')
})

test('about admin form does not create duplicate upload system', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(!form.includes('upload'), 'Must not have custom upload logic')
})

test('server action validates image URLs against MediaAsset', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('prisma.mediaAsset.findFirst'), 'Must query MediaAsset table')
  assert.ok(action.includes('fileUrl'), 'Must validate against fileUrl')
})

test('image validation rejects URLs not in Media Library', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('return asset ? raw : null'), 'Must return null for invalid URLs')
  assert.ok(action.includes('must be selected from the Media Library'), 'Must provide clear error message')
})

// ════════════════════════════════════════════════════════════════
// 12. CONCURRENCY / RACE CONDITION AUDIT
// ════════════════════════════════════════════════════════════════

test('save action uses transaction for atomicity', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('prisma.$transaction'), 'Must wrap writes in transaction')
})

test('save action computes delete lists inside transaction (race condition safety)', () => {
  const action = read('actions/about.ts')
  // The existingStats query must be inside the transaction callback, not outside
  const txStart = action.indexOf('prisma.$transaction(async (tx)')
  const txBody = action.substring(txStart)
  assert.ok(txBody.includes('tx.aboutStat.findMany'), 'Stats delete-list read must be inside transaction')
  assert.ok(txBody.includes('tx.aboutBenefit.findMany'), 'Benefits delete-list read must be inside transaction')
})

test('save action uses upsert for singleton (prevents duplicate AboutPage)', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('aboutPage.upsert'), 'Must use upsert, not create')
})

test('admin form disables submit button during save (prevents double-click)', () => {
  const form = read('components/admin/about/AboutAdminForm.tsx')
  assert.ok(form.includes('disabled={pending || !isDirty}'), 'Must disable button while pending or clean')
})

// ════════════════════════════════════════════════════════════════
// 13. RECONCILIATION SCRIPT
// ════════════════════════════════════════════════════════════════

test('reconciliation script uses seedAboutPage (idempotent)', () => {
  const script = read('scripts/reconcile-about-page.ts')
  assert.ok(script.includes('seedAboutPage'), 'Must use seedAboutPage for idempotent seeding')
})

test('reconciliation script is registered in package.json', () => {
  const pkg = read('package.json')
  assert.ok(pkg.includes('db:reconcile-about-page'), 'Must have npm script for reconciliation')
})

test('reconciliation script reports counts after seeding', () => {
  const script = read('scripts/reconcile-about-page.ts')
  assert.ok(script.includes('aboutStat.count'), 'Must count stats after reconciliation')
  assert.ok(script.includes('aboutBenefit.count'), 'Must count benefits after reconciliation')
})

// ════════════════════════════════════════════════════════════════
// 14. CROSS-SYSTEM INDEPENDENCE
// ════════════════════════════════════════════════════════════════

test('About CMS has no dependency on broker subscription features', () => {
  const files = [
    'app/(public)/about/page.tsx',
    'lib/about/about.ts',
    'actions/about.ts',
    'components/admin/about/AboutAdminForm.tsx',
  ]
  for (const file of files) {
    const content = read(file)
    assert.ok(!content.includes('BrokerEntitlement'), `${file} must not reference BrokerEntitlement`)
    assert.ok(!content.includes('subscription'), `${file} must not reference subscription`)
    assert.ok(!content.includes('hasActiveEntitlement'), `${file} must not check entitlements`)
  }
})

test('About CMS uses publicBrokerWhere for stats only (not for access control)', () => {
  const lib = read('lib/about/about.ts')
  const action = read('actions/about.ts')
  assert.ok(lib.includes('publicBrokerWhere'), 'Library must use publicBrokerWhere for stat queries')
  assert.ok(!action.includes('publicBrokerWhere'), 'Server action must NOT use publicBrokerWhere')
})

// ════════════════════════════════════════════════════════════════
// 15. SCHEMA NORMALIZATION
// ════════════════════════════════════════════════════════════════

test('AboutPage does not store stats/benefits as JSON blobs', () => {
  const schema = read('prisma/schema.prisma')
  const pageSection = schema.substring(schema.indexOf('model AboutPage'), schema.indexOf('model AboutStat'))
  assert.ok(!pageSection.includes('Json'), 'AboutPage must not have Json fields for repeatable content')
  assert.ok(pageSection.includes('stats    AboutStat[]'), 'Stats must be relational, not JSON')
  assert.ok(pageSection.includes('benefits AboutBenefit[]'), 'Benefits must be relational, not JSON')
})

test('AboutStat has no unused fields', () => {
  const schema = read('prisma/schema.prisma')
  const statSection = schema.substring(schema.indexOf('model AboutStat'), schema.indexOf('model AboutBenefit'))
  const fields = ['id', 'aboutPageId', 'label', 'statType', 'staticValue', 'enabled', 'displayOrder']
  for (const field of fields) {
    assert.ok(statSection.includes(field), `AboutStat must have field: ${field}`)
  }
})

test('AboutBenefit has no unused fields', () => {
  const schema = read('prisma/schema.prisma')
  const benefitStart = schema.indexOf('model AboutBenefit')
  const benefitMapIdx = schema.indexOf('@@map("about_benefits")', benefitStart)
  const benefitSection = schema.substring(benefitStart, benefitMapIdx + 30)
  const fields = ['id', 'aboutPageId', 'title', 'description', 'iconKey', 'enabled', 'displayOrder']
  for (const field of fields) {
    assert.ok(benefitSection.includes(field), `AboutBenefit must have field: ${field}`)
  }
})

// ════════════════════════════════════════════════════════════════
// 16. NO DEAD CODE / DEBUG ARTIFACTS
// ════════════════════════════════════════════════════════════════

test('no console.log in About CMS production code (only console.error allowed)', () => {
  const files = [
    'app/(public)/about/page.tsx',
    'lib/about/about.ts',
    'components/admin/about/AboutAdminForm.tsx',
    'app/admin/content/about/page.tsx',
  ]
  for (const file of files) {
    const content = read(file)
    assert.ok(!content.includes('console.log'), `${file} must not contain console.log`)
    assert.ok(!content.includes('console.debug'), `${file} must not contain console.debug`)
    assert.ok(!content.includes('console.info'), `${file} must not contain console.info`)
    assert.ok(!content.includes('debugger'), `${file} must not contain debugger statement`)
  }
})

test('server action console.error is appropriate (not debug)', () => {
  const action = read('actions/about.ts')
  assert.ok(action.includes('console.error'), 'Server action should log errors')
  assert.ok(!action.includes('console.log'), 'Server action must not use console.log')
})

test('no unused imports in About public page', () => {
  const page = read('app/(public)/about/page.tsx')
  const importMatch = page.match(/^import.*from.*$/gm)
  assert.ok(importMatch, 'Must have imports')
  for (const imp of importMatch) {
    const namedMatch = imp.match(/\{([^}]+)\}/)
    if (namedMatch) {
      const names = namedMatch[1].split(',').map((n: string) => n.trim().split(' as ')[0].trim())
      for (const name of names) {
        if (name && !name.startsWith('type ')) {
          assert.ok(page.includes(name), `Import "${name}" must be used in the file`)
        }
      }
    }
  }
})

// ════════════════════════════════════════════════════════════════
// 17. ADMIN NAVIGATION
// ════════════════════════════════════════════════════════════════

test('admin navigation includes About Page link', () => {
  const nav = read('lib/admin/navigation.ts')
  assert.ok(nav.includes('About Page'), 'Admin nav must include About Page')
  assert.ok(nav.includes('/admin/content/about'), 'Admin nav must link to /admin/content/about')
})

// ════════════════════════════════════════════════════════════════
// 18. DATA FLOW INTEGRITY
// ════════════════════════════════════════════════════════════════

test('public read and admin read use the same singleton ID', () => {
  const lib = read('lib/about/about.ts')
  const usages = lib.match(/ABOUT_PAGE_ID/g)
  assert.ok(usages && usages.length >= 3, 'ABOUT_PAGE_ID must be used in seed, public, and admin paths')
})

test('admin read includes dynamic stats preview for UI', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes('dynamicStats'), 'Admin data must include dynamic stats')
})

test('public read resolves dynamic stats for display', () => {
  const lib = read('lib/about/about.ts')
  assert.ok(lib.includes('resolveAboutStats'), 'Public data must resolve stats')
})
