import { cache } from 'react'
import prisma from '@/lib/prisma'

export type SiteSettings = {
  siteName: string
  siteDescription: string
  siteUrl: string
  contactEmail: string
  contactPhone: string
  contactAddress: string
  contactStreet: string
  contactCity: string
  contactState: string
  contactZip: string
  contactCountry: string
  contactBusinessHours: string
  defaultCurrency: string
  timezone: string
  seoTitle: string
  seoDescription: string
  socialFacebook: string | null
  socialTwitter: string | null
  socialLinkedIn: string | null
  socialInstagram: string | null
  socialYouTube: string | null
  footerDescription: string
  copyrightText: string
  siteLogo: string | null
  siteFavicon: string | null
}

const DEFAULTS: SiteSettings = {
  siteName: 'HomeLoanMarket',
  siteDescription: 'Find trusted mortgage originators in the United States.',
  siteUrl: 'https://homeloanmarket.com',
  contactEmail: 'support@homeloanmarket.com',
  contactPhone: '+1 (682) 390-1840',
  contactAddress: 'United States',
  contactStreet: '75 E 3rd St',
  contactCity: 'Sheridan',
  contactState: 'Wyoming (WY)',
  contactZip: '82801',
  contactCountry: 'United States',
  contactBusinessHours: '',
  defaultCurrency: 'USD',
  timezone: 'America/New_York',
  seoTitle: 'Home Loan Market LLC | Find Trusted Mortgage Originators in the US',
  seoDescription: 'Compare verified mortgage originators across the United States, read real reviews, and connect with the right mortgage expert.',
  socialFacebook: null,
  socialTwitter: null,
  socialLinkedIn: "https://www.linkedin.com/company/homeloanmarket-com",
  socialInstagram: null,
  socialYouTube: null,
  footerDescription: 'Home Loan Market LLC helps home buyers find and compare verified mortgage originators across the United States.',
  copyrightText: `© ${new Date().getUTCFullYear()} Home Loan Market LLC. All rights reserved.`,
  siteLogo: null,
  siteFavicon: null,
}

// Wrapped in React.cache so the identical read is executed once per request
// even though it is awaited by generateMetadata, the (public) layout, and the
// page itself — previously this issued up to 3 identical DB queries per page.
export const getSiteSettings = cache(async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await prisma.setting.findMany({ select: { key: true, value: true } })
  const values = new Map<string, string>(rows.map((row) => [row.key, row.value]))

  return {
    siteName: values.get('siteName') || DEFAULTS.siteName,
    siteDescription: values.get('siteDescription') || DEFAULTS.siteDescription,
    siteUrl: values.get('siteUrl') || DEFAULTS.siteUrl,
    contactEmail: values.get('contactEmail') || DEFAULTS.contactEmail,
    contactPhone: values.get('contactPhone') || DEFAULTS.contactPhone,
    contactAddress: values.get('contactAddress') || DEFAULTS.contactAddress,
    contactStreet: values.get('contactStreet') || DEFAULTS.contactStreet,
    contactCity: values.get('contactCity') || DEFAULTS.contactCity,
    contactState: values.get('contactState') || DEFAULTS.contactState,
    contactZip: values.get('contactZip') || DEFAULTS.contactZip,
    contactCountry: values.get('contactCountry') || DEFAULTS.contactCountry,
    contactBusinessHours: values.get('contactBusinessHours') || DEFAULTS.contactBusinessHours,
    defaultCurrency: values.get('defaultCurrency') || DEFAULTS.defaultCurrency,
    timezone: values.get('timezone') || DEFAULTS.timezone,
    seoTitle: values.get('seoTitle') || DEFAULTS.seoTitle,
    seoDescription: values.get('seoDescription') || DEFAULTS.seoDescription,
    socialFacebook: values.get('socialFacebook') || null,
    socialTwitter: values.get('socialTwitter') || null,
    socialLinkedIn: values.get('socialLinkedIn') || null,
    socialInstagram: values.get('socialInstagram') || null,
    socialYouTube: values.get('socialYouTube') || null,
    footerDescription: values.get('footerDescription') || DEFAULTS.footerDescription,
    copyrightText: values.get('copyrightText') || DEFAULTS.copyrightText,
    siteLogo: values.get('site.logo') || DEFAULTS.siteLogo,
    siteFavicon: values.get('site.favicon') || DEFAULTS.siteFavicon,
  }
})
