import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const form = read('components/admin/about/AboutAdminForm.tsx')
const lib = read('lib/about/about.ts')
const page = read('app/(public)/about/page.tsx')
const adminPage = read('app/admin/content/about/page.tsx')

// ════════════════════════════════════════════════════════════════
// 1. SINGLE-PAGE SECTION ARCHITECTURE (Phase 8.15.2)
// ════════════════════════════════════════════════════════════════

test('About CMS exposes the full set of sections', () => {
  // The SECTION_IDS map defines semantic ids for every section.
  ;['about-overview', 'about-hero', 'about-statistics', 'about-mission',
    'about-benefits', 'about-contact', 'about-seo'].forEach((id) => {
      assert.ok(form.includes(`'${id}'`), `Missing section id map ${id}`)
    })
  ;['overview', 'hero', 'stats', 'mission', 'benefits', 'contact', 'seo'].forEach((key) => {
    assert.ok(form.includes(`id={SECTION_IDS.${key}}`), `Section ${key} must use its semantic id`)
  })
})

test('sections are rendered simultaneously, not as mutually exclusive panels', () => {
  // No Radix TabsContent / forceMount: every section is a plain <section> in the
  // same form, so nothing is hidden by navigation.
  assert.doesNotMatch(form, /TabsContent/)
  assert.doesNotMatch(form, /<Tabs /)
  assert.doesNotMatch(form, /value="overview"/)
  assert.equal((form.match(/<section /g) || []).length, 7, 'All seven sections must render on one page')
})

test('Tabs primitives were removed in favor of section navigation', () => {
  assert.doesNotMatch(form, /from ['"]@\/components\/ui\/tabs['"]/)
  assert.doesNotMatch(form, /TabsList/)
  assert.doesNotMatch(form, /TabsTrigger/)
})

test('shared editable state lives at the component root across all sections', () => {
  assert.match(form, /useState\(data\.page\)/)
  assert.match(form, /const \[stats, setStats\] = useState/)
  assert.match(form, /const \[benefits, setBenefits\] = useState/)
  assert.match(form, /const \[missionChecklist, setMissionChecklist\] = useState/)
})

// ════════════════════════════════════════════════════════════════
// 2. SECTION NAVIGATION
// ════════════════════════════════════════════════════════════════

test('navigation provides links to each section id', () => {
  ;['about-overview', 'about-hero', 'about-statistics', 'about-mission',
    'about-benefits', 'about-contact', 'about-seo'].forEach((id) => {
      assert.ok(form.includes(`'${id}'`), `SECTION_IDS must declare ${id}`)
    })
  // Nav anchors resolve their target from SECTION_IDS and scroll on click.
  assert.match(form, /href=\{`#\$\{SECTION_IDS\[item\.key\]\}`\}/)
  assert.match(form, /scrollToSection\(item\.key\)/)
  assert.match(form, /SECTION_IDS\[item\.key\]/)
})

test('navigation scrolls to sections (does not reset state)', () => {
  assert.match(form, /scrollToSection/)
  assert.match(form, /scrollIntoView/)
  assert.match(form, /getElementById/)
})

test('sections offset for the sticky admin header so headings are not covered', () => {
  assert.match(form, /scroll-mt-36|scroll-mt-32|scroll-mt-28|scroll-mt-24|scroll-mt-20/)
})

// ════════════════════════════════════════════════════════════════
// 3. SECTION-SCOPED VALIDATION (scrolls; preserves other edits)
// ════════════════════════════════════════════════════════════════

test('client-side validation returns the offending section', () => {
  assert.match(form, /return \{ ok: false, section: 'stats'/)
  assert.match(form, /return \{ ok: false, section: 'benefits'/)
  assert.match(form, /return \{ ok: false, section: 'contact'/)
})

test('submit is prevented and the offending section scrolled to on invalid input', () => {
  assert.match(form, /event\.preventDefault\(\)/)
  assert.match(form, /scrollToSection\(result\.section\)/)
  assert.match(form, /setFormError\(result\.message\)/)
})

test('server-side validation error is routed to its section', () => {
  assert.match(form, /function mapServerErrorToSection/)
  assert.match(form, /\/hero image\/i\.test\(msg\)\) return 'hero'/)
  assert.match(form, /\/mission image\/i\.test\(msg\)\) return 'mission'/)
  assert.match(form, /\/seo image\/i\.test\(msg\)\) return 'seo'/)
  assert.match(form, /\/contact email\/i\.test\(msg\)\) return 'contact'/)
  assert.match(form, /\/stat\/i\.test\(msg\)\) return 'stats'/)
  assert.match(form, /\/benefit\/i\.test\(msg\)\) return 'benefits'/)
  assert.match(form, /scrollToSection\(section\)/)
})

test('no generic-only failure: server and client errors are both surfaced', () => {
  assert.match(form, /shownError/)
  assert.match(form, /state\?\.error/)
})

// ════════════════════════════════════════════════════════════════
// 4. SAVE ARCHITECTURE (single global save, unsaved state, pending)
// ════════════════════════════════════════════════════════════════

test('one global save action maps all sections (no per-section save systems)', () => {
  assert.match(form, /useActionState\(saveAboutPage/)
  assert.equal(form.match(/<form /g)?.length, 1)
  assert.doesNotMatch(form, /<form [\s\S]*<form /)
})

test('unsaved changes are detected against the initial server snapshot', () => {
  assert.match(form, /const isDirty =/)
  assert.match(form, /pristine\.page|pristine\.stats|pristine\.benefits|pristine\.checklist/)
  assert.match(form, /Unsaved changes/)
})

test('submit is disabled when clean and shows a saving state while pending', () => {
  assert.match(form, /disabled=\{pending \|\| !isDirty\}/)
  assert.match(form, /Saving…/)
})

test('values are not silently reset on failure — form state is preserved', () => {
  // The form uses useActionState (no uncontrolled reset) and only hides the
  // previous form error; there is no reset of p/stats/benefits after a save.
  assert.doesNotMatch(form, /reset\(\)/)
  assert.doesNotMatch(form, /setP\(data\.page\)/)
})

// ════════════════════════════════════════════════════════════════
// 5. OVERVIEW SECTION
// ════════════════════════════════════════════════════════════════

test('Overview section shows status summary and actions', () => {
  assert.match(form, /About Page Overview/)
  assert.match(form, /Page status/)
  assert.match(form, /Published|Hidden/)
  assert.match(form, /Last updated/)
  assert.match(form, /Configured|Enabled|Disabled/)
  assert.match(form, /Edit Content/)
  assert.match(form, /Preview \/ View About Page/)
})

test('last-updated comes from the CMS record', () => {
  assert.match(form, /data\.page\.updatedAt/)
  assert.match(form, /data\.page\.createdAt/)
})

// ════════════════════════════════════════════════════════════════
// 6. STATISTICS SECTION (create / update / reorder / resolved preview)
// ════════════════════════════════════════════════════════════════

test('statistics section exposes dynamic vs static value handling', () => {
  assert.match(form, /STATIC_STAT_TYPE/)
  assert.match(form, /STATIC_STAT_TYPE \? \(/)
  assert.match(form, /Resolved value/)
  assert.match(form, /data\.dynamicStats/)
  assert.match(form, /Dynamic — calculated automatically/)
})

test('dynamic types do not expose a static value field', () => {
  const staticInput = form.indexOf('name={`stats.${i}.staticValue`}')
  const resolvedBranch = form.indexOf('Resolved value')
  assert.ok(staticInput < resolvedBranch, 'static value input must be in the static branch before the dynamic preview')
})

// ════════════════════════════════════════════════════════════════
// 7. BENEFITS SECTION (create / update / reorder)
// ════════════════════════════════════════════════════════════════

test('benefits section supports create, update, reorder, and delete', () => {
  assert.match(form, /Add Benefit/)
  assert.match(form, /ABOUT_BENEFIT_ICONS\[0\]/)
  assert.match(form, /benefitsId/)
  assert.match(form, /updateBenefit\(i, 'title'/)
  assert.match(form, /updateBenefit\(i, 'description'/)
  assert.match(form, /updateBenefit\(i, 'iconKey'/)
  assert.match(form, /updateBenefit\(i, 'enabled'/)
  assert.match(form, /move\(benefits, i, -1, setBenefits\)/)
  assert.match(form, /move\(benefits, i, 1, setBenefits\)/)
  assert.match(form, /setBenefits\(\(prev\) => prev\.filter\(\(_, idx\) => idx !== i\)\)/)
})

test('benefit and stat cards are compact (not one long ungrouped vertical form)', () => {
  assert.match(form, /rounded border border-border p-3/)
  assert.match(form, /sm:grid-cols-3/)
})

// ════════════════════════════════════════════════════════════════
// 8. RESPONSIVE / LAYOUT
// ════════════════════════════════════════════════════════════════

test('section nav is horizontally scrollable so it never overflows on small screens', () => {
  assert.match(form, /overflow-x-auto/)
  assert.match(form, /w-max/)
})

test('content is width-controlled and centered under the admin shell', () => {
  assert.match(form, /mx-auto max-w-4xl/)
})

test('sticky action bar sticks below the admin header and spans content exactly', () => {
  assert.match(form, /sticky top-16/)
  assert.match(form, /-mx-6 px-6/)
})

test('no rounded-lg / rounded-xl / rounded-2xl introduced (radius standard)', () => {
  assert.doesNotMatch(form, /rounded-(lg|xl|2xl)/)
  assert.doesNotMatch(adminPage, /rounded-(lg|xl|2xl)/)
})

// ════════════════════════════════════════════════════════════════
// 9. PUBLIC INTEGRATION (preserved)
// ════════════════════════════════════════════════════════════════

test('public about page still resolves dynamic stats and reflects CMS toggles', () => {
  assert.match(page, /sections\.stats &&/)
  assert.match(page, /sections\.benefits &&/)
  assert.match(page, /sections\.mission &&/)
  assert.match(page, /sections\.contact &&/)
  assert.match(lib, /resolveAboutStats/)
  assert.match(lib, /getAboutPublicData/)
})

test('SEO still propagates to metadata from the CMS', () => {
  assert.match(lib, /getAboutSeo/)
  assert.match(page, /generateMetadata/)
  assert.match(page, /openGraph: \{ images/)
})

test('public read is react-cached (revalidation propagates after save)', () => {
  assert.match(lib, /cache\(/)
  assert.match(lib, /getAboutPublicData = cache/)
})

// ════════════════════════════════════════════════════════════════
// 10. FULL-PAGE SAVE (all fields in ONE form payload)
// ════════════════════════════════════════════════════════════════

test('all sections are serialized into the same single form payload', () => {
  ;['heroEyebrow', 'heroTitle', 'heroDescription', 'heroImageAlt',
    'missionTitle', 'missionContent', 'missionContent2', 'missionImageAlt',
    'contactTitle', 'contactEmail', 'seoTitle', 'seoDescription'].forEach((name) => {
      assert.ok(form.includes(`name="${name}"`), `Expected named field ${name} in the single form payload`)
    })
})

test('single save submits ALL repeatable collections (statsId, benefitsId, missionChecklist)', () => {
  assert.match(form, /name="statsId"/)
  assert.match(form, /name="benefitsId"/)
  assert.match(form, /name="missionChecklist"/)
})

test('successful save rebaselines the dirty snapshot so the dirty flag clears', () => {
  assert.match(form, /state\?\.ok/)
  assert.match(form, /setPristine\(/)
  assert.match(form, /buildSnapshot\(/)
  assert.match(form, /savedOk/)
})

test('server action is a single atomic transaction across ALL sections', () => {
  const action = read('actions/about.ts')
  assert.match(action, /\$transaction\(async \(tx\)/)
  ;['heroEyebrow', 'heroTitle', 'heroDescription', 'missionTitle',
    'missionContent', 'missionContent2', 'contactTitle', 'contactEmail',
    'seoTitle', 'seoDescription'].forEach((f) => {
      assert.ok(action.includes(`formData.get('${f}')`), `saveAboutPage must read ${f}`)
    })
  assert.match(action, /revalidatePath\('\/about'\)/)
  assert.match(action, /revalidatePath\('\/admin\/content\/about'\)/)
})

test('validation and error mapping cover the full page, not just a visible section', () => {
  assert.match(form, /for \(let i = 0; i < stats\.length; i\+\+\)/)
  assert.match(form, /for \(let i = 0; i < benefits\.length; i\+\+\)/)
})

test('media changes mark the entire form dirty, not just one section', () => {
  assert.match(form, /patchPage\('heroImageUrl'/)
  assert.match(form, /patchPage\('missionImageUrl'/)
  assert.match(form, /patchPage\('seoOgImageUrl'/)
  assert.match(form, /currentPageJson !== pristine\.page/)
})

// ════════════════════════════════════════════════════════════════
// 11. CANCEL (restores the COMPLETE original page)
// ════════════════════════════════════════════════════════════════

test('Cancel button restores every section from the initial snapshot', () => {
  // Cancel resets page + stats + benefits + checklist from the mount snapshot
  // and re-baselines pristine so the complete page is clean again.
  assert.match(form, /onClick=\{cancel\}/)
  assert.match(form, /function cancel\(\)/)
  assert.match(form, /setP\(initialPage\)/)
  assert.match(form, /setStats\(initialStats\)/)
  assert.match(form, /setBenefits\(initialBenefits\)/)
  assert.match(form, /setMissionChecklist\(initialChecklist\)/)
  assert.match(form, /setPristine\(\s*buildSnapshot\(initialPage/)
})
