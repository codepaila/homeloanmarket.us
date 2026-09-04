'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import {
  ABOUT_PAGE_ID,
  ABOUT_BENEFIT_ICONS,
  DYNAMIC_STAT_TYPES,
  STATIC_STAT_TYPE,
} from '@/lib/about/about'
import { isMongoId, isTempId } from '@/lib/about/id'
import type { AboutStatType } from '@prisma/client'

type AboutState = { error?: string; ok?: boolean } | undefined

const ALL_STAT_TYPES = new Set<string>([...DYNAMIC_STAT_TYPES, STATIC_STAT_TYPE])
const ALLOWED_ICONS = new Set<string>(ABOUT_BENEFIT_ICONS)

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return null
  return user
}

function bool(value: FormDataEntryValue | null, fallback = false) {
  if (value === null) return fallback
  return value === 'true' || value === 'on' || value === '1'
}

function str(value: FormDataEntryValue | null) {
  return value ? String(value).trim() : ''
}

// Validate an image URL against the canonical Media Library. Returns the URL
// or null when the field should be cleared.
async function validateImageUrl(raw: string): Promise<string | null> {
  if (!raw) return null
  const asset = await prisma.mediaAsset.findFirst({ where: { fileUrl: raw, isDeleted: false }, select: { id: true } })
  return asset ? raw : null
}

/**
 * Persists the entire About page: fixed section content + SEO, plus the
 * repeatable stats and benefit cards. One controlled save — on any validation
 * error nothing is written and the exact failing field is reported.
 */
export async function saveAboutPage(_previousState: AboutState, formData: FormData): Promise<AboutState> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  // ---- Images (validate against Media Library) ----
  const heroImageUrl = await validateImageUrl(str(formData.get('heroImageUrl')))
  const missionImageUrl = await validateImageUrl(str(formData.get('missionImageUrl')))
  const seoOgImageUrl = await validateImageUrl(str(formData.get('seoOgImageUrl')))

  if (str(formData.get('heroImageUrl')) && !heroImageUrl) {
    return { error: 'Hero image must be selected from the Media Library or uploaded first.' }
  }
  if (str(formData.get('missionImageUrl')) && !missionImageUrl) {
    return { error: 'Mission image must be selected from the Media Library or uploaded first.' }
  }
  if (str(formData.get('seoOgImageUrl')) && !seoOgImageUrl) {
    return { error: 'SEO image must be selected from the Media Library or uploaded first.' }
  }

  // ---- Contact email ----
  const contactEmail = str(formData.get('contactEmail'))
  if (formData.get('contactEnabled') && contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { error: 'Contact email must be a valid email address.' }
  }

  // ---- Stats (repeatable) ----
  const statIds = (formData.get('statsId')?.toString() || '').split('|').map((v) => v.trim()).filter(Boolean)
  const statsToUpsert: Array<{ id?: string; label: string; statType: string; staticValue: string | null; enabled: boolean; displayOrder: number }> = []
  const statsToDelete: string[] = []
  for (let i = 0; i < statIds.length; i++) {
    const id = statIds[i]
    const prefix = `stats.${i}`
    const statType = str(formData.get(`${prefix}.statType`))
    const label = str(formData.get(`${prefix}.label`))
    const enabled = bool(formData.get(`${prefix}.enabled`), true)
    const staticValue = statType === STATIC_STAT_TYPE ? str(formData.get(`${prefix}.staticValue`)) : null

    if (!ALL_STAT_TYPES.has(statType)) {
      return { error: `Stat "${label || '(untitled)'}" has an invalid type.` }
    }
    if (!label) {
      return { error: `Every stat must have a label (item ${i + 1}).` }
    }
    if (label.length > 80) {
      return { error: `Stat label "${label}" is too long (max 80 chars).` }
    }
    if (statType === STATIC_STAT_TYPE && enabled && !(staticValue ?? '')) {
      return { error: `Static stat "${label}" needs a value, or set it to a dynamic type.` }
    }

let existingId: string | undefined
     if (id && isMongoId(id)) {
       const existing = await prisma.aboutStat.findUnique({ where: { id } })
       if (existing) existingId = existing.id
     }
    if (existingId) {
      statsToUpsert.push({ id: existingId, label, statType, staticValue, enabled, displayOrder: (i + 1) * 10 })
    } else {
      statsToUpsert.push({ label, statType, staticValue, enabled, displayOrder: (i + 1) * 10 })
    }
  }

  // Determine which existing stats to delete (not referenced by the payload).
  // NOTE: The actual delete-list computation happens inside the transaction
  // (MongoDB snapshot isolation) to prevent concurrent saves from creating
  // orphaned records. The referencedIds set is computed here from the validated
  // payload, but the DB read of existing records is deferred.
  const referencedIds = new Set(
    statsToUpsert.map((s) => s.id).filter((id): id is string => Boolean(id)),
  )

  // ---- Benefits (repeatable) ----
  const benefitIds = (formData.get('benefitsId')?.toString() || '').split('|').map((v) => v.trim()).filter(Boolean)
  const benefitsToUpsert: Array<{ id?: string; title: string; description: string; iconKey: string; enabled: boolean; displayOrder: number }> = []
  const benefitsToDelete: string[] = []
  for (let i = 0; i < benefitIds.length; i++) {
    const id = benefitIds[i]
    const prefix = `benefits.${i}`
    const title = str(formData.get(`${prefix}.title`))
    const description = str(formData.get(`${prefix}.description`))
    const iconKey = str(formData.get(`${prefix}.iconKey`))
    const enabled = bool(formData.get(`${prefix}.enabled`), true)

    if (!title) {
      return { error: `Every benefit card must have a title (item ${i + 1}).` }
    }
    if (title.length > 90) {
      return { error: `Benefit title "${title}" is too long (max 90 chars).` }
    }
    if (!ALLOWED_ICONS.has(iconKey)) {
      return { error: `Benefit "${title}" has an unsupported icon.` }
    }
    if (enabled && !description) {
      return { error: `Benefit "${title}" needs a description.` }
    }

let existingId: string | undefined
     if (id && isMongoId(id)) {
       const existing = await prisma.aboutBenefit.findUnique({ where: { id } })
       if (existing) existingId = existing.id
     }
    if (existingId) {
      benefitsToUpsert.push({ id: existingId, title, description, iconKey, enabled, displayOrder: (i + 1) * 10 })
    } else {
      benefitsToUpsert.push({ title, description, iconKey, enabled, displayOrder: (i + 1) * 10 })
    }
  }
  const referencedBenefitIds = new Set(
    benefitsToUpsert.map((b) => b.id).filter((id): id is string => Boolean(id)),
  )

  // ---- Persist in a single transaction ----
  try {
    await prisma.$transaction(async (tx) => {
      await tx.aboutPage.upsert({
        where: { id: ABOUT_PAGE_ID },
        update: {
          isActive: bool(formData.get('isActive'), true),
          heroEnabled: bool(formData.get('heroEnabled'), true),
          heroEyebrow: str(formData.get('heroEyebrow')) || null,
          heroTitle: str(formData.get('heroTitle')) || null,
          heroDescription: str(formData.get('heroDescription')) || null,
          heroImageUrl,
          heroImageAlt: str(formData.get('heroImageAlt')) || null,
          statsEnabled: bool(formData.get('statsEnabled'), true),
          missionEnabled: bool(formData.get('missionEnabled'), true),
          missionTitle: str(formData.get('missionTitle')) || null,
          missionContent: str(formData.get('missionContent')) || null,
          missionContent2: str(formData.get('missionContent2')) || null,
          missionChecklist: (formData.get('missionChecklist')?.toString() || '')
            .split('|')
            .map((item) => item.trim())
            .filter(Boolean),
          missionImageUrl,
          missionImageAlt: str(formData.get('missionImageAlt')) || null,
          benefitsEnabled: bool(formData.get('benefitsEnabled'), true),
          contactEnabled: bool(formData.get('contactEnabled'), true),
          contactTitle: str(formData.get('contactTitle')) || null,
          contactEmail: contactEmail || null,
          seoTitle: str(formData.get('seoTitle')) || null,
          seoDescription: str(formData.get('seoDescription')) || null,
          seoOgImageUrl,
        },
        create: {
          id: ABOUT_PAGE_ID,
          isActive: bool(formData.get('isActive'), true),
          heroEnabled: bool(formData.get('heroEnabled'), true),
          heroEyebrow: str(formData.get('heroEyebrow')) || null,
          heroTitle: str(formData.get('heroTitle')) || null,
          heroDescription: str(formData.get('heroDescription')) || null,
          heroImageUrl,
          heroImageAlt: str(formData.get('heroImageAlt')) || null,
          statsEnabled: bool(formData.get('statsEnabled'), true),
          missionEnabled: bool(formData.get('missionEnabled'), true),
          missionTitle: str(formData.get('missionTitle')) || null,
          missionContent: str(formData.get('missionContent')) || null,
          missionContent2: str(formData.get('missionContent2')) || null,
          missionChecklist: (formData.get('missionChecklist')?.toString() || '')
            .split('|')
            .map((item) => item.trim())
            .filter(Boolean),
          missionImageUrl,
          missionImageAlt: str(formData.get('missionImageAlt')) || null,
          benefitsEnabled: bool(formData.get('benefitsEnabled'), true),
          contactEnabled: bool(formData.get('contactEnabled'), true),
          contactTitle: str(formData.get('contactTitle')) || null,
          contactEmail: contactEmail || null,
          seoTitle: str(formData.get('seoTitle')) || null,
          seoDescription: str(formData.get('seoDescription')) || null,
          seoOgImageUrl,
        },
      })

      // Compute delete lists inside the transaction for snapshot isolation.
      // This prevents concurrent saves from creating orphaned records.
      const existingStats = await tx.aboutStat.findMany({ where: { aboutPageId: ABOUT_PAGE_ID }, select: { id: true } })
      for (const st of existingStats) {
        if (!referencedIds.has(st.id)) statsToDelete.push(st.id)
      }

      if (statsToDelete.length) {
        await tx.aboutStat.deleteMany({ where: { id: { in: statsToDelete } } })
      }
      for (const s of statsToUpsert) {
        if (s.id) {
          await tx.aboutStat.update({
            where: { id: s.id },
            data: {
              label: s.label,
              statType: s.statType as AboutStatType,
              staticValue: s.staticValue,
              enabled: s.enabled,
              displayOrder: s.displayOrder,
            },
          })
        } else {
          await tx.aboutStat.create({
            data: {
              aboutPageId: ABOUT_PAGE_ID,
              label: s.label,
              statType: s.statType as AboutStatType,
              staticValue: s.staticValue,
              enabled: s.enabled,
              displayOrder: s.displayOrder,
            },
          })
        }
      }

      // Compute benefits delete list inside the transaction for snapshot isolation.
      const existingBenefits = await tx.aboutBenefit.findMany({ where: { aboutPageId: ABOUT_PAGE_ID }, select: { id: true } })
      for (const b of existingBenefits) {
        if (!referencedBenefitIds.has(b.id)) benefitsToDelete.push(b.id)
      }

      if (benefitsToDelete.length) {
        await tx.aboutBenefit.deleteMany({ where: { id: { in: benefitsToDelete } } })
      }
      for (const b of benefitsToUpsert) {
        if (b.id) {
          await tx.aboutBenefit.update({
            where: { id: b.id },
            data: {
              title: b.title,
              description: b.description,
              iconKey: b.iconKey,
              enabled: b.enabled,
              displayOrder: b.displayOrder,
            },
          })
        } else {
          await tx.aboutBenefit.create({
            data: {
              aboutPageId: ABOUT_PAGE_ID,
              title: b.title,
              description: b.description,
              iconKey: b.iconKey,
              enabled: b.enabled,
              displayOrder: b.displayOrder,
            },
          })
        }
      }
    })
  } catch (error) {
    console.error('saveAboutPage error:', error)
    return { error: 'Failed to save About page. No changes were written.' }
  }

  revalidatePath('/about')
  revalidatePath('/admin/content/about')
  return { ok: true }
}
