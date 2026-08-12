import type { PublicAdResponse } from './types'

export const PLACEMENT_KEY_MAP: Record<string, string> = {
  'homepage-hero': 'HOMEPAGE_HERO',
  'homepage-search': 'HOMEPAGE_SEARCH',
  'homepage-featured': 'HOMEPAGE_FEATURED',
  'homepage-services': 'HOMEPAGE_SERVICES',
  'homepage-banks': 'HOMEPAGE_BANKS',
  'homepage-cta': 'HOMEPAGE_CTA',
  'broker-listing': 'BROKER_LISTING',
  'broker-listing-local': 'BROKER_LISTING_LOCAL',
  'broker-profile-header': 'BROKER_PROFILE_HEADER',
  'broker-listing-sidebar': 'BROKER_LISTING_SIDEBAR',
  'loan-calculator': 'LOAN_CALCULATOR',
  'blog-inline': 'BLOG_INLINE',
  'footer': 'FOOTER',
  'announcement-top': 'ANNOUNCEMENT_TOP',
  'announcement-bottom': 'ANNOUNCEMENT_BOTTOM',
  'popup-overlay': 'POPUP_OVERLAY',
  'mobile-header-banner': 'MOBILE_HEADER_BANNER',
}

export const PLACEMENT_ENUM_VALUES = [
  'HOMEPAGE_HERO', 'HOMEPAGE_SEARCH', 'HOMEPAGE_FEATURED', 'HOMEPAGE_SERVICES',
  'HOMEPAGE_BANKS', 'HOMEPAGE_CTA', 'BROKER_LISTING', 'BROKER_LISTING_LOCAL', 'BROKER_PROFILE_HEADER',
  'BROKER_LISTING_SIDEBAR', 'LOAN_CALCULATOR', 'BLOG_INLINE', 'FOOTER',
  'ANNOUNCEMENT_TOP', 'ANNOUNCEMENT_BOTTOM', 'POPUP_OVERLAY', 'MOBILE_HEADER_BANNER',
] as const

export function getPlacementKey(placement: string): string {
  return PLACEMENT_KEY_MAP[placement] || placement
}

const VALID_ADVERTISEMENT_ACTIONS = [
  'DISPLAY_ONLY',
  'BANNER_CLICK',
  'BUTTON_ONLY',
  'BANNER_AND_BUTTON',
] as const

export function isValidPublicAd(value: unknown): value is PublicAdResponse {
  if (!value || typeof value !== 'object') return false
  const ad = value as Partial<PublicAdResponse>
  return (
    typeof ad.id === 'string' &&
    ad.id.length > 0 &&
    typeof ad.title === 'string' &&
    typeof ad.type === 'string' &&
    typeof ad.placement === 'string' &&
    typeof ad.action === 'string' &&
    (VALID_ADVERTISEMENT_ACTIONS as readonly string[]).includes(ad.action)
  )
}

export function filterValidPublicAds(ads: unknown): PublicAdResponse[] {
  if (!Array.isArray(ads)) return []
  return ads.filter(isValidPublicAd)
}

export function isAdVisible(ad: PublicAdResponse, device: 'desktop' | 'mobile' | 'tablet'): boolean {
  return Boolean(ad && getAdImage(ad, device)?.url)
}

export function getAdImage(ad: PublicAdResponse, device: 'desktop' | 'mobile' | 'tablet'): { url: string | null; alt: string | null } | null {
  if (!ad) return null
  if (ad.creative) {
    return { url: ad.creative.fileUrl, alt: ad.creative.altText || ad.altText || ad.title }
  }
  if (device === 'mobile' && ad.mobileMedia) {
    return { url: ad.mobileMedia.fileUrl, alt: ad.mobileMedia.altText || ad.altText || ad.title }
  }
  if (ad.desktopMedia) {
    return { url: ad.desktopMedia.fileUrl, alt: ad.desktopMedia.altText || ad.altText || ad.title }
  }
  if (ad.mobileMedia) {
    return { url: ad.mobileMedia.fileUrl, alt: ad.mobileMedia.altText || ad.altText || ad.title }
  }
  if (ad.bannerUrl) {
    return { url: ad.bannerUrl, alt: ad.altText || ad.title }
  }
  return null
}

export function shouldPreload(placement: string): boolean {
  return placement === 'HOMEPAGE_HERO' || placement === 'HOMEPAGE_SEARCH'
}
