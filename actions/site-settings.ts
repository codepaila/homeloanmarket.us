'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { sanitizeCallbackUrl } from '@/lib/auth-redirect'

type SettingsState = { error?: string; ok?: boolean } | undefined

const SETTING_KEYS = [
  'siteName',
  'siteDescription',
  'siteUrl',
  'contactEmail',
  'contactPhone',
  'contactAddress',
  'contactStreet',
  'contactCity',
  'contactState',
  'contactZip',
  'contactCountry',
  'contactBusinessHours',
  'defaultCurrency',
  'timezone',
  'seoTitle',
  'seoDescription',
  'socialFacebook',
  'socialTwitter',
  'socialLinkedIn',
  'socialInstagram',
  'socialYouTube',
  'footerDescription',
  'copyrightText',
  'site.logo',
  'site.favicon',
]

function categoryFor(key: string) {
  if (key.startsWith('seo')) return 'seo'
  if (key.startsWith('site.')) return 'branding'
  if (key.startsWith('social')) return 'social'
  if (key.startsWith('contact')) return 'contact'
  return 'general'
}

export async function updateSiteSettings(_previousState: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Unauthorized' }

  const siteUrlValue = formData.get('siteUrl')?.toString().trim()
  if (siteUrlValue) {
    const safeOrigin = sanitizeCallbackUrl(siteUrlValue, 'https://homeloanmarket.com')
    if (!safeOrigin) return { error: 'Site URL must be a valid same-origin https URL.' }
  }

  for (const key of ['site.logo', 'site.favicon']) {
    const value = formData.get(key)?.toString().trim() ?? ''
    if (value) {
      const asset = await prisma.mediaAsset.findFirst({ where: { fileUrl: value, isDeleted: false }, select: { id: true } })
      if (!asset) return { error: 'Branding images must be selected from the Media Library or uploaded first.' }
    }
  }

  for (const key of SETTING_KEYS) {
    const value = formData.get(key)?.toString().trim() ?? ''
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value, category: categoryFor(key) },
    })
  }

  revalidatePath('/', 'layout')
  revalidatePath('/admin/settings')
  revalidatePath('/admin/seo')
  return { ok: true }
}
