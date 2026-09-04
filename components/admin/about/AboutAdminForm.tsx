'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, MoveUp, MoveDown, Save, ArrowLeft, ExternalLink, Eye, Pencil } from 'lucide-react'
import { useActionState } from 'react'
import { saveAboutPage } from '@/actions/about'
import type { AboutAdminData } from '@/lib/about/about'
import { ABOUT_BENEFIT_ICONS, DYNAMIC_STAT_TYPES, STATIC_STAT_TYPE } from '@/lib/about/about'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MediaSelector } from '@/components/admin/media/MediaSelector'
import type { MediaAsset } from '@/lib/advertisements/types'

type StatRow = { id: string; label: string; statType: string; staticValue: string; enabled: boolean }
type BenefitRow = { id: string; title: string; description: string; iconKey: string; enabled: boolean }
type SectionKey = 'overview' | 'hero' | 'stats' | 'mission' | 'benefits' | 'contact' | 'seo'

const SECTION_IDS: Record<SectionKey, string> = {
  overview: 'about-overview',
  hero: 'about-hero',
  stats: 'about-statistics',
  mission: 'about-mission',
  benefits: 'about-benefits',
  contact: 'about-contact',
  seo: 'about-seo',
}

const NAV_ITEMS: { key: SectionKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'hero', label: 'Hero' },
  { key: 'stats', label: 'Statistics' },
  { key: 'mission', label: 'Mission' },
  { key: 'benefits', label: 'Benefits' },
  { key: 'contact', label: 'Contact / CTA' },
  { key: 'seo', label: 'SEO' },
]

function scrollToSection(key: SectionKey) {
  document.getElementById(SECTION_IDS[key])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function nextTempId(prefix: 'stat' | 'benefit') {
  return `${prefix}-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function SectionToggle({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function AboutImageField({
  label,
  description,
  url,
  name,
  onChangeUrl,
}: {
  label: string
  description: string
  url: string | null
  name: string
  onChangeUrl: (url: string | null) => void
}) {
  return (
    <div>
      <MediaSelector
        value={url || ''}
        label={label}
        description={description}
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        onChange={(asset: MediaAsset | null) => onChangeUrl(asset?.fileUrl || null)}
      />
      <input type="hidden" name={name} value={url || ''} readOnly />
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function dynamicLabel(type: string) {
  switch (type) {
    case 'DYNAMIC_ORIGINATORS':
      return 'Mortgage Originators (dynamic)'
    case 'DYNAMIC_STATES':
      return 'States (dynamic)'
    case 'DYNAMIC_CITIES':
      return 'Cities (dynamic)'
    default:
      return type
  }
}

export function AboutAdminForm({ data }: { data: AboutAdminData }) {
  // All editable state lives here at the component root, shared by every
  // section, so all sections stay visible and edit together on one page.
  const [p, setP] = useState(data.page)
  const [stats, setStats] = useState<StatRow[]>(
    data.stats.map((s) => ({ id: s.id, label: s.label, statType: s.statType, staticValue: s.staticValue || '', enabled: s.enabled })),
  )
  const [benefits, setBenefits] = useState<BenefitRow[]>(
    data.benefits.map((b) => ({ id: b.id, title: b.title, description: b.description, iconKey: b.iconKey, enabled: b.enabled })),
  )
  const [missionChecklist, setMissionChecklist] = useState<string[]>(data.page.missionChecklist)
  const [formError, setFormError] = useState('')

  // Initial server snapshot, captured once at mount. Used by Cancel to restore
  // the complete original page (all sections) and to re-baseline pristine.
  const initialPage = data.page
  const initialStats: StatRow[] = data.stats.map((s) => ({ id: s.id, label: s.label, statType: s.statType, staticValue: s.staticValue || '', enabled: s.enabled }))
  const initialBenefits: BenefitRow[] = data.benefits.map((b) => ({ id: b.id, title: b.title, description: b.description, iconKey: b.iconKey, enabled: b.enabled }))
  const initialChecklist = data.page.missionChecklist

  const [state, action, pending] = useActionState(saveAboutPage, undefined)

  // Snapshot of the last-saved server state, for unsaved-change detection.
  // Initialized from the server-fetched `data` prop; re-initialized from the
  // current form state once a save succeeds so the dirty flag clears while the
  // just-saved values stay in the inputs. A plain const would be safe too, but
  // a state snapshot is required so a successful save can reset the baseline.
  function buildSnapshot(
    page: typeof data.page,
    statsSrc: StatRow[],
    benefitsSrc: BenefitRow[],
    checklist: string[],
  ) {
    return {
      page: JSON.stringify({
        isActive: page.isActive,
        heroEnabled: page.heroEnabled,
        heroEyebrow: page.heroEyebrow,
        heroTitle: page.heroTitle,
        heroDescription: page.heroDescription,
        heroImageUrl: page.heroImageUrl,
        heroImageAlt: page.heroImageAlt,
        statsEnabled: page.statsEnabled,
        missionEnabled: page.missionEnabled,
        missionTitle: page.missionTitle,
        missionContent: page.missionContent,
        missionContent2: page.missionContent2,
        missionImageUrl: page.missionImageUrl,
        missionImageAlt: page.missionImageAlt,
        benefitsEnabled: page.benefitsEnabled,
        contactEnabled: page.contactEnabled,
        contactTitle: page.contactTitle,
        contactEmail: page.contactEmail,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        seoOgImageUrl: page.seoOgImageUrl,
      }),
      stats: JSON.stringify(statsSrc.map((s) => ({ id: s.id, label: s.label, statType: s.statType, staticValue: s.staticValue, enabled: s.enabled }))),
      benefits: JSON.stringify(benefitsSrc.map((b) => ({ id: b.id, title: b.title, description: b.description, iconKey: b.iconKey, enabled: b.enabled }))),
      checklist: JSON.stringify(checklist),
    }
  }
  const [pristine, setPristine] = useState(() =>
    buildSnapshot(
      data.page,
      data.stats.map((s) => ({ id: s.id, label: s.label, statType: s.statType, staticValue: s.staticValue || '', enabled: s.enabled })),
      data.benefits.map((b) => ({ id: b.id, title: b.title, description: b.description, iconKey: b.iconKey, enabled: b.enabled })),
      data.page.missionChecklist,
    ),
  )

  const currentPageJson = JSON.stringify({
    isActive: p.isActive,
    heroEnabled: p.heroEnabled,
    heroEyebrow: p.heroEyebrow,
    heroTitle: p.heroTitle,
    heroDescription: p.heroDescription,
    heroImageUrl: p.heroImageUrl,
    heroImageAlt: p.heroImageAlt,
    statsEnabled: p.statsEnabled,
    missionEnabled: p.missionEnabled,
    missionTitle: p.missionTitle,
    missionContent: p.missionContent,
    missionContent2: p.missionContent2,
    missionImageUrl: p.missionImageUrl,
    missionImageAlt: p.missionImageAlt,
    benefitsEnabled: p.benefitsEnabled,
    contactEnabled: p.contactEnabled,
    contactTitle: p.contactTitle,
    contactEmail: p.contactEmail,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    seoOgImageUrl: p.seoOgImageUrl,
  })
  const isDirty =
    currentPageJson !== pristine.page ||
    JSON.stringify(stats) !== pristine.stats ||
    JSON.stringify(benefits) !== pristine.benefits ||
    JSON.stringify(missionChecklist) !== pristine.checklist

  const patchPage = (key: keyof typeof p, value: unknown) => {
    setP((prev) => ({ ...prev, [key]: value }))
    setFormError('')
  }

  const updateStat = (index: number, key: keyof StatRow, value: unknown) => {
    setStats((prev) => prev.map((s, i) => (i === index ? { ...s, [key]: value } : s)))
    setFormError('')
  }
  const updateBenefit = (index: number, key: keyof BenefitRow, value: unknown) => {
    setBenefits((prev) => prev.map((b, i) => (i === index ? { ...b, [key]: value } : b)))
    setFormError('')
  }

  const move = <T,>(list: T[], index: number, dir: -1 | 1, setter: (l: T[]) => void) => {
    const to = index + dir
    if (to < 0 || to >= list.length) return
    const next = [...list]
    ;[next[index], next[to]] = [next[to], next[index]]
    setter(next)
  }

  // Client-side validation mirrors the server action's rules so the offending
  // tab is identified up front and the submit is not even attempted.
  function validateForm(): { ok: true } | { ok: false; section: SectionKey; message: string } {
    if (p.statsEnabled) {
      for (let i = 0; i < stats.length; i++) {
        const s = stats[i]
        if (!s.label.trim()) return { ok: false, section: 'stats', message: `Stat ${i + 1} needs a label.` }
        if (s.label.length > 80) return { ok: false, section: 'stats', message: `Stat label "${s.label}" is too long (max 80 chars).` }
        if (!(DYNAMIC_STAT_TYPES as readonly string[]).includes(s.statType) && s.statType !== STATIC_STAT_TYPE) {
          return { ok: false, section: 'stats', message: `Stat "${s.label}" has an invalid type.` }
        }
        if (s.statType === STATIC_STAT_TYPE && s.enabled && !s.staticValue.trim()) {
          return { ok: false, section: 'stats', message: `Static stat "${s.label}" needs a value, or set it to a dynamic type.` }
        }
      }
    }
    if (p.benefitsEnabled) {
      for (let i = 0; i < benefits.length; i++) {
        const b = benefits[i]
        if (!b.title.trim()) return { ok: false, section: 'benefits', message: `Benefit ${i + 1} needs a title.` }
        if (b.title.length > 90) return { ok: false, section: 'benefits', message: `Benefit title "${b.title}" is too long (max 90 chars).` }
        if (!(ABOUT_BENEFIT_ICONS as readonly string[]).includes(b.iconKey)) {
          return { ok: false, section: 'benefits', message: `Benefit "${b.title}" has an unsupported icon.` }
        }
        if (b.enabled && !b.description.trim()) {
          return { ok: false, section: 'benefits', message: `Benefit "${b.title}" needs a description.` }
        }
      }
    }
    if (p.contactEnabled && p.contactEmail && !EMAIL_RE.test(p.contactEmail.trim())) {
      return { ok: false, section: 'contact', message: 'Contact email must be a valid email address.' }
    }
    return { ok: true }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const result = validateForm()
    if (!result.ok) {
      event.preventDefault()
      setFormError(result.message)
      scrollToSection(result.section)
    }
  }

  // Route a server-side validation error to the tab it belongs to so the admin
  // is never left guessing (e.g. an SEO image that was not in the Media
  // Library). Scheduled via a microtask so it is an async callback, not a
  // synchronous setState in the effect body.
  const serverErrorMessage = state?.error
  function mapServerErrorToSection(msg: string): SectionKey | null {
    if (/hero image/i.test(msg)) return 'hero'
    if (/mission image/i.test(msg)) return 'mission'
    if (/seo image/i.test(msg)) return 'seo'
    if (/contact email/i.test(msg)) return 'contact'
    if (/stat/i.test(msg)) return 'stats'
    if (/benefit/i.test(msg)) return 'benefits'
    return null
  }
  useEffect(() => {
    if (!serverErrorMessage) return
    const section = mapServerErrorToSection(serverErrorMessage)
    if (!section) return
    queueMicrotask(() => scrollToSection(section))
  }, [serverErrorMessage])

  // After a successful save the server now holds exactly the values shown in
  // the form, so re-baseline the unsaved-changes snapshot to clear the dirty
  // flag while keeping the just-saved values in the inputs. Runs in a microtask
  // so it is an async callback rather than a synchronous setState in the effect.
  const savedOk = state?.ok
  useEffect(() => {
    if (!savedOk) return
    queueMicrotask(() =>
      setPristine(
        buildSnapshot(
          p,
          stats,
          benefits,
          missionChecklist,
        ),
      ),
    )
  }, [savedOk]) // eslint-disable-line react-hooks/exhaustive-deps

  const shownError = formError || serverErrorMessage || ''
  const enabledStats = stats.filter((s) => s.enabled).length
  const enabledBenefits = benefits.filter((b) => b.enabled).length
  const heroConfigured = Boolean(p.heroTitle || p.heroDescription || p.heroImageUrl)
  const seoConfigured = Boolean(p.seoTitle && p.seoDescription)

  function formatDate(d: Date) {
    try {
      return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return ''
    }
  }

  const jumpButton = (key: SectionKey, label: string) => (
    <Button type="button" variant="outline" size="sm" onClick={() => scrollToSection(key)}>
      <Pencil className="mr-2 h-4 w-4" /> {label}
    </Button>
  )

  // Cancel restores the COMPLETE original page across every section and clears
  // the dirty flag. It is an explicit user action (not a silent reset on error),
  // so it uses the snapshot captured at mount rather than mutating form state.
  function cancel() {
    setP(initialPage)
    setStats(initialStats)
    setBenefits(initialBenefits)
    setMissionChecklist(initialChecklist)
    setFormError('')
    setPristine(buildSnapshot(initialPage, initialStats, initialBenefits, initialChecklist))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-6">
      {/* Sticky action bar — mirrors the admin edit-form convention, sticks
          below the 64px admin header and spans the content column exactly. */}
     

      <div className="mx-auto  space-y-6">
        {/* Section navigation — jumps between sections; all sections stay visible. */}
        <nav aria-label="About sections" className="sticky top-16 z-30  overflow-x-auto pb-1">
          <div className="flex  items-center gap-1 rounded-md border border-border bg-background/95 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.key}
                href={`#${SECTION_IDS[item.key]}`}
                onClick={(e) => { e.preventDefault(); scrollToSection(item.key) }}
                className="whitespace-nowrap rounded px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* OVERVIEW */}
        <section id={SECTION_IDS.overview} className="scroll-mt-36 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">About Page Overview</CardTitle>
              <CardDescription>A quick summary of the current configuration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded border border-border p-3">
                  <dt className="text-xs font-medium text-muted-foreground">Page status</dt>
                  <dd className="mt-1 text-sm font-semibold">{p.isActive ? 'Published' : 'Hidden'}</dd>
                </div>
                <div className="rounded border border-border p-3">
                  <dt className="text-xs font-medium text-muted-foreground">Last updated</dt>
                  <dd className="mt-1 text-sm">{formatDate(data.page.updatedAt)}</dd>
                </div>
                <div className="rounded border border-border p-3">
                  <dt className="text-xs font-medium text-muted-foreground">Hero</dt>
                  <dd className="mt-1 text-sm">{p.heroEnabled ? (heroConfigured ? 'Configured' : 'Enabled, empty') : 'Disabled'}</dd>
                </div>
                <div className="rounded border border-border p-3">
                  <dt className="text-xs font-medium text-muted-foreground">Enabled statistics</dt>
                  <dd className="mt-1 text-sm">{p.statsEnabled ? `${enabledStats} of ${stats.length}` : 'Disabled'}</dd>
                </div>
                <div className="rounded border border-border p-3">
                  <dt className="text-xs font-medium text-muted-foreground">Enabled benefits</dt>
                  <dd className="mt-1 text-sm">{p.benefitsEnabled ? `${enabledBenefits} of ${benefits.length}` : 'Disabled'}</dd>
                </div>
                <div className="rounded border border-border p-3">
                  <dt className="text-xs font-medium text-muted-foreground">SEO</dt>
                  <dd className="mt-1 text-sm">{seoConfigured ? 'Configured' : 'Incomplete'}</dd>
                </div>
              </dl>
{/* 
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">Quick actions:</span>
                {jumpButton('hero', 'Edit Hero')}
                {jumpButton('stats', 'Edit Statistics')}
                {jumpButton('mission', 'Edit Mission')}
                {jumpButton('benefits', 'Edit Benefits')}
                {jumpButton('contact', 'Edit Contact')}
                {jumpButton('seo', 'Edit SEO')}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href="/about" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Preview / View About Page
                  </Link>
                </Button>
                <Button type="button" size="sm" onClick={() => scrollToSection('hero')}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit Content
                </Button>
                <Button type="submit" disabled={pending || !isDirty} size="sm">
                  {pending ? 'Saving…' : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
                </Button>
              </div> */}
            </CardContent>
          </Card>
        </section>

        {/* HERO */}
        <section id={SECTION_IDS.hero} className="scroll-mt-36 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Hero</CardTitle>
              <CardDescription>Top banner with heading and intro.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SectionToggle checked={p.heroEnabled} onCheckedChange={(v) => patchPage('heroEnabled', v)} label="Show hero section" />
              {p.heroEnabled && (
                <>
                  <Field label="Eyebrow">
                    <Input value={p.heroEyebrow || ''} onChange={(e) => patchPage('heroEyebrow', e.target.value)} name="heroEyebrow" placeholder="e.g. Trusted since 2018" />
                  </Field>
                  <Field label="Title">
                    <Input value={p.heroTitle || ''} onChange={(e) => patchPage('heroTitle', e.target.value)} name="heroTitle" />
                  </Field>
                  <Field label="Description">
                    <Textarea value={p.heroDescription || ''} onChange={(e) => patchPage('heroDescription', e.target.value)} name="heroDescription" rows={3} />
                  </Field>
                  <AboutImageField label="Hero Image" description="Optional. Selected from the Media Library." url={p.heroImageUrl} name="heroImageUrl" onChangeUrl={(url) => patchPage('heroImageUrl', url)} />
                  <Field label="Hero Image Alt Text">
                    <Input value={p.heroImageAlt || ''} onChange={(e) => patchPage('heroImageAlt', e.target.value)} name="heroImageAlt" placeholder="Accessible description" />
                  </Field>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* STATISTICS */}
        <section id={SECTION_IDS.stats} className="scroll-mt-36 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Statistics</CardTitle>
              <CardDescription>
                Dynamic stats are computed live from the database. Static stats require an explicit value. Reorder to change display order.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SectionToggle checked={p.statsEnabled} onCheckedChange={(v) => patchPage('statsEnabled', v)} label="Show stats section" />
              {p.statsEnabled && (
                <>
                  <div className="space-y-3">
                    {stats.map((s, i) => (
                      <div key={s.id} className="flex flex-col gap-2 rounded border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <SectionToggle checked={s.enabled} onCheckedChange={(v) => updateStat(i, 'enabled', v)} label={`Stat ${i + 1}`} />
                          <div className="flex gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => move(stats, i, -1, setStats)} disabled={i === 0}><MoveUp className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => move(stats, i, 1, setStats)} disabled={i === stats.length - 1}><MoveDown className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setStats((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <input type="hidden" name={`stats.${i}.enabled`} value={s.enabled ? 'true' : 'false'} />
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="space-y-1">
                            <Label>Label</Label>
                            <Input value={s.label} onChange={(e) => updateStat(i, 'label', e.target.value)} name={`stats.${i}.label`} />
                          </div>
                          <div className="space-y-1">
                            <Label>Type</Label>
                            <select
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={s.statType}
                              onChange={(e) => updateStat(i, 'statType', e.target.value)}
                              name={`stats.${i}.statType`}
                            >
                              {DYNAMIC_STAT_TYPES.map((t) => (
                                <option key={t} value={t}>{dynamicLabel(t)}</option>
                              ))}
                              <option value={STATIC_STAT_TYPE}>Static value</option>
                            </select>
                          </div>
                          {s.statType === STATIC_STAT_TYPE ? (
                            <div className="space-y-1">
                              <Label>Value</Label>
                              <Input value={s.staticValue} onChange={(e) => updateStat(i, 'staticValue', e.target.value)} name={`stats.${i}.staticValue`} placeholder="e.g. 4.9/5" />
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Label>Resolved value</Label>
                              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                                {s.enabled ? (data.dynamicStats[s.statType] != null ? data.dynamicStats[s.statType] : 'Unavailable') : 'Disabled'}
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {s.statType === STATIC_STAT_TYPE ? 'Static — shows the configured value.' : 'Dynamic — calculated automatically from the database.'}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setStats((prev) => [...prev, { id: nextTempId('stat'), label: '', statType: STATIC_STAT_TYPE, staticValue: '', enabled: true }])}>
                    <Plus className="mr-2 h-4 w-4" /> Add Stat
                  </Button>
                  <input type="hidden" name="statsId" value={stats.map((s) => s.id).join('|')} readOnly />
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* MISSION */}
        <section id={SECTION_IDS.mission} className="scroll-mt-36 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Mission</CardTitle>
              <CardDescription>Statement and checklist shown next to the benefit cards.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SectionToggle checked={p.missionEnabled} onCheckedChange={(v) => patchPage('missionEnabled', v)} label="Show mission section" />
              {p.missionEnabled && (
                <>
                  <Field label="Mission Title">
                    <Input value={p.missionTitle || ''} onChange={(e) => patchPage('missionTitle', e.target.value)} name="missionTitle" />
                  </Field>
                  <Field label="Mission Content" hint="Line breaks are preserved on the public page.">
                    <Textarea value={p.missionContent || ''} onChange={(e) => patchPage('missionContent', e.target.value)} name="missionContent" rows={4} />
                  </Field>
                  <Field label="Mission Content 2" hint="Line breaks are preserved on the public page.">
                    <Textarea value={p.missionContent2 || ''} onChange={(e) => patchPage('missionContent2', e.target.value)} name="missionContent2" rows={4} />
                  </Field>
                  <div className="space-y-1.5">
                    <Label>Checklist Items</Label>
                    <div className="space-y-2">
                      {missionChecklist.map((item, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            value={item}
                            onChange={(e) => { setMissionChecklist((prev) => prev.map((x, j) => (j === i ? e.target.value : x))); setFormError('') }}
                          />
                          <Button type="button" variant="ghost" size="sm" onClick={() => setMissionChecklist((prev) => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                    <input type="hidden" name="missionChecklist" value={missionChecklist.join('|')} readOnly />
                    <Button type="button" variant="outline" size="sm" onClick={() => setMissionChecklist((prev) => [...prev, ''])}>
                      <Plus className="mr-2 h-4 w-4" /> Add Item
                    </Button>
                  </div>
                  <AboutImageField label="Mission Image" description="Optional. Selected from the Media Library." url={p.missionImageUrl} name="missionImageUrl" onChangeUrl={(url) => patchPage('missionImageUrl', url)} />
                  <Field label="Mission Image Alt Text">
                    <Input value={p.missionImageAlt || ''} onChange={(e) => patchPage('missionImageAlt', e.target.value)} name="missionImageAlt" placeholder="Accessible description" />
                  </Field>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* BENEFITS */}
        <section id={SECTION_IDS.benefits} className="scroll-mt-36 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Benefits</CardTitle>
              <CardDescription>Feature cards shown alongside the mission statement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SectionToggle checked={p.benefitsEnabled} onCheckedChange={(v) => patchPage('benefitsEnabled', v)} label="Show benefit cards" />
              {p.benefitsEnabled && (
                <div className="space-y-3">
                  {benefits.map((b, i) => (
                    <div key={b.id} className="flex flex-col gap-2 rounded border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <SectionToggle checked={b.enabled} onCheckedChange={(v) => updateBenefit(i, 'enabled', v)} label={`Benefit ${i + 1}`} />
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => move(benefits, i, -1, setBenefits)} disabled={i === 0}><MoveUp className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => move(benefits, i, 1, setBenefits)} disabled={i === benefits.length - 1}><MoveDown className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setBenefits((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <input type="hidden" name={`benefits.${i}.enabled`} value={b.enabled ? 'true' : 'false'} />
                      <div className="space-y-1.5">
                        <Label>Title</Label>
                        <Input value={b.title} onChange={(e) => updateBenefit(i, 'title', e.target.value)} name={`benefits.${i}.title`} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Textarea value={b.description} onChange={(e) => updateBenefit(i, 'description', e.target.value)} name={`benefits.${i}.description`} rows={2} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Icon</Label>
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={b.iconKey} onChange={(e) => updateBenefit(i, 'iconKey', e.target.value)} name={`benefits.${i}.iconKey`}>
                          {ABOUT_BENEFIT_ICONS.map((icon) => (
                            <option key={icon} value={icon}>{icon}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setBenefits((prev) => [...prev, { id: nextTempId('benefit'), title: '', description: '', iconKey: ABOUT_BENEFIT_ICONS[0], enabled: true }])}>
                    <Plus className="mr-2 h-4 w-4" /> Add Benefit
                  </Button>
                  <input type="hidden" name="benefitsId" value={benefits.map((b) => b.id).join('|')} readOnly />
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* CONTACT / CTA */}
        <section id={SECTION_IDS.contact} className="scroll-mt-36 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Contact / CTA</CardTitle>
              <CardDescription>
                About-page contact content. This is About-specific — it is shown on the About page and used for its contact link.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SectionToggle checked={p.contactEnabled} onCheckedChange={(v) => patchPage('contactEnabled', v)} label="Show contact section" />
              {p.contactEnabled && (
                <>
                  <Field label="Contact Title">
                    <Input value={p.contactTitle || ''} onChange={(e) => patchPage('contactTitle', e.target.value)} name="contactTitle" />
                  </Field>
                  <Field label="Contact Email">
                    <Input value={p.contactEmail || ''} onChange={(e) => patchPage('contactEmail', e.target.value)} name="contactEmail" type="email" />
                  </Field>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* SEO */}
        <section id={SECTION_IDS.seo} className="scroll-mt-36 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">SEO</CardTitle>
              <CardDescription>
                Search-engine metadata for the About page. Saved values update the page title, description, and social share image.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="SEO Title" hint={`${(p.seoTitle || '').length} / 60 recommended characters`}>
                <Input value={p.seoTitle || ''} onChange={(e) => patchPage('seoTitle', e.target.value)} name="seoTitle" />
              </Field>
              <Field label="SEO Description" hint={`${(p.seoDescription || '').length} / 160 recommended characters`}>
                <Textarea value={p.seoDescription || ''} onChange={(e) => patchPage('seoDescription', e.target.value)} name="seoDescription" rows={3} />
              </Field>
              <AboutImageField label="Social Share Image (OG)" description="Optional. Used when the About page is shared." url={p.seoOgImageUrl} name="seoOgImageUrl" onChangeUrl={(url) => patchPage('seoOgImageUrl', url)} />
            </CardContent>
          </Card>
        </section>

        {/* Bottom save action */}
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          {isDirty && !pending && (
            <Button type="button" variant="outline" size="sm" onClick={cancel}>Cancel</Button>
          )}
          <Button type="submit" disabled={pending || !isDirty} size="sm">
            {pending ? 'Saving…' : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
          </Button>
        </div>
      </div>

      <input type="hidden" name="isActive" value={p.isActive ? 'true' : 'false'} readOnly />
      <input type="hidden" name="heroEnabled" value={p.heroEnabled ? 'true' : 'false'} readOnly />
      <input type="hidden" name="statsEnabled" value={p.statsEnabled ? 'true' : 'false'} readOnly />
      <input type="hidden" name="missionEnabled" value={p.missionEnabled ? 'true' : 'false'} readOnly />
      <input type="hidden" name="benefitsEnabled" value={p.benefitsEnabled ? 'true' : 'false'} readOnly />
      <input type="hidden" name="contactEnabled" value={p.contactEnabled ? 'true' : 'false'} readOnly />
       <div className="sticky bottom-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border -mx-6 px-6 py-3 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground" aria-label="Back to admin">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold tracking-tight">About Page</h1>
              <p className="text-xs text-muted-foreground">
                {data.page.updatedAt.getTime() === data.page.createdAt.getTime()
                  ? 'Initialized from default content'
                  : `Last updated ${formatDate(data.page.updatedAt)}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/about" target="_blank" rel="noopener noreferrer">
                <Eye className="mr-2 h-4 w-4" /> View About Page
              </Link>
            </Button>
            {isDirty && !pending && (
              <Button type="button" variant="outline" size="sm" onClick={cancel}>
                <ArrowLeft className="mr-2 h-4 w-4 rotate-180" /> Cancel
              </Button>
            )}
            <Button type="submit" disabled={pending || !isDirty} size="sm">
              {pending ? (<><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />Saving…</>) : (<><Save className="mr-2 h-4 w-4" />Save Changes</>)}
            </Button>
          </div>
        </div>
        {isDirty && !pending && (
          <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
            <span>Unsaved changes — remember to save before leaving.</span>
          </div>
        )}
        {!isDirty && !pending && !shownError && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>No unsaved changes.</span>
          </div>
        )}
        {shownError && (
          <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
            <span>{shownError}</span>
          </div>
        )}
        {state?.ok && (
          <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600">
            <span>Saved — About page changes persisted.</span>
          </div>
        )}
      </div>
    </form>
  )
}
