'use client'

import { Home, Search, Star, Settings, Banknote, MousePointerClick, List, User, Calculator, FileText, Layout, X, Bell, Smartphone } from 'lucide-react'
import { getDisplayHeight, getPlacementSpec, getRequiredDimensions } from '@/lib/advertisements/placementSpecs'

export type PlacementKey =
  | 'HOMEPAGE_HERO'
  | 'HOMEPAGE_SEARCH'
  | 'HOMEPAGE_FEATURED'
  | 'HOMEPAGE_SERVICES'
  | 'HOMEPAGE_BANKS'
  | 'HOMEPAGE_CTA'
  | 'BROKER_LISTING'
  | 'BROKER_LISTING_LOCAL'
  | 'BROKER_PROFILE_HEADER'
  | 'BROKER_LISTING_SIDEBAR'
  | 'LOAN_CALCULATOR'
  | 'BLOG_INLINE'
  | 'FOOTER'
  | 'ANNOUNCEMENT_TOP'
  | 'ANNOUNCEMENT_BOTTOM'
  | 'POPUP_OVERLAY'
  | 'MOBILE_HEADER_BANNER'

export interface PlacementInfo {
  key: PlacementKey
  label: string
  description: string
  page: string
  position: string
  visibility: string
  priority: string
  icon: React.ElementType
  specs: {
    recommendedWidth: number
    recommendedHeight: number
    aspectRatio: string
    maxFileSize: string
    formats: string[]
    quality: string
    displayHeight?: { mobile: number; tablet: number; desktop: number }
    maxDisplayHeight?: number
  }
  backgroundOptions: BackgroundOption[]
}

export interface BackgroundOption {
  id: string
  label: string
  type: 'page' | 'theme'
  value: string
}

export const PLACEMENT_INFO: Record<PlacementKey, PlacementInfo> = {
  HOMEPAGE_HERO: {
    key: 'HOMEPAGE_HERO',
    label: 'Homepage Hero',
    description: 'Large banner at the top of the homepage',
    page: 'Home Page',
    position: 'Immediately below the main navigation',
    visibility: 'Desktop + Mobile',
    priority: 'Highest visibility',
    icon: Home,
    specs: {
      recommendedWidth: 1920,
      recommendedHeight: 600,
      aspectRatio: '16:5',
      maxFileSize: '10 MB',
      formats: ['WebP', 'PNG', 'JPEG'],
      quality: 'High',
    },
    backgroundOptions: [
      { id: 'home-light', label: 'Home Page (Light)', type: 'page', value: 'home' },
      { id: 'home-dark', label: 'Home Page (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  HOMEPAGE_SEARCH: {
    key: 'HOMEPAGE_SEARCH',
    label: 'Homepage Search',
    description: 'Banner above or below the loan search form',
    page: 'Home Page',
    position: 'Above or below the loan search form',
    visibility: 'Desktop + Mobile',
    priority: 'High visibility',
    icon: Search,
    specs: {
      recommendedWidth: 1200,
      recommendedHeight: 300,
      aspectRatio: '4:1',
      maxFileSize: '5 MB',
      formats: ['WebP', 'PNG', 'JPEG'],
      quality: 'High',
    },
    backgroundOptions: [
      { id: 'home-light', label: 'Home Page (Light)', type: 'page', value: 'home' },
      { id: 'home-dark', label: 'Home Page (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  HOMEPAGE_FEATURED: {
    key: 'HOMEPAGE_FEATURED',
    label: 'Homepage Featured Brokers',
    description: 'Featured broker carousel or grid section',
    page: 'Home Page',
    position: 'Featured brokers section',
    visibility: 'Desktop + Mobile',
    priority: 'Medium visibility',
    icon: Star,
    specs: {
      recommendedWidth: 800,
      recommendedHeight: 400,
      aspectRatio: '2:1',
      maxFileSize: '5 MB',
      formats: ['WebP', 'PNG', 'JPEG'],
      quality: 'High',
    },
    backgroundOptions: [
      { id: 'home-light', label: 'Home Page (Light)', type: 'page', value: 'home' },
      { id: 'home-dark', label: 'Home Page (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  HOMEPAGE_SERVICES: {
    key: 'HOMEPAGE_SERVICES',
    label: 'Homepage Services',
    description: 'Services section banner or card',
    page: 'Home Page',
    position: 'Services section',
    visibility: 'Desktop + Mobile',
    priority: 'Medium visibility',
    icon: Settings,
    specs: {
      recommendedWidth: 600,
      recommendedHeight: 300,
      aspectRatio: '2:1',
      maxFileSize: '3 MB',
      formats: ['WebP', 'PNG', 'JPEG'],
      quality: 'Medium',
    },
    backgroundOptions: [
      { id: 'home-light', label: 'Home Page (Light)', type: 'page', value: 'home' },
      { id: 'home-dark', label: 'Home Page (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  HOMEPAGE_BANKS: {
    key: 'HOMEPAGE_BANKS',
    label: 'Homepage Banks',
    description: 'Partner banks showcase section',
    page: 'Home Page',
    position: 'Partner banks section',
    visibility: 'Desktop + Mobile',
    priority: 'Medium visibility',
    icon: Banknote,
    specs: {
      recommendedWidth: 200,
      recommendedHeight: 100,
      aspectRatio: '2:1',
      maxFileSize: '1 MB',
      formats: ['WebP', 'PNG', 'SVG'],
      quality: 'Medium',
    },
    backgroundOptions: [
      { id: 'home-light', label: 'Home Page (Light)', type: 'page', value: 'home' },
      { id: 'home-dark', label: 'Home Page (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  HOMEPAGE_CTA: {
    key: 'HOMEPAGE_CTA',
    label: 'Homepage CTA',
    description: 'Call-to-action banner or section',
    page: 'Home Page',
    position: 'CTA section, typically near bottom',
    visibility: 'Desktop + Mobile',
    priority: 'High visibility',
    icon: MousePointerClick,
    specs: {
      recommendedWidth: 1200,
      recommendedHeight: 400,
      aspectRatio: '3:1',
      maxFileSize: '5 MB',
      formats: ['WebP', 'PNG', 'JPEG'],
      quality: 'High',
    },
    backgroundOptions: [
      { id: 'home-light', label: 'Home Page (Light)', type: 'page', value: 'home' },
      { id: 'home-dark', label: 'Home Page (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  BROKER_LISTING: {
    key: 'BROKER_LISTING',
    label: 'Broker Listing',
    description: 'Banner within broker search results',
    page: 'Broker Listing Page',
    position: 'Between broker cards or at top of results',
    visibility: 'Desktop + Mobile',
    priority: 'Medium visibility',
    icon: List,
    specs: {
      recommendedWidth: 800,
      recommendedHeight: 200,
      aspectRatio: '4:1',
      maxFileSize: '3 MB',
      formats: ['WebP', 'PNG', 'JPEG'],
      quality: 'Medium',
    },
    backgroundOptions: [
      { id: 'broker-light', label: 'Broker Listing (Light)', type: 'page', value: 'broker' },
      { id: 'broker-dark', label: 'Broker Listing (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  BROKER_LISTING_LOCAL: {
    key: 'BROKER_LISTING_LOCAL',
    label: 'Broker Listing Local Resources',
    description: 'Location-targeted resources at the bottom of broker search results',
    page: 'Broker Listing Page',
    position: 'Bottom of broker search results',
    visibility: 'Desktop + Mobile',
    priority: 'Location eligible',
    icon: List,
    specs: {
      recommendedWidth: 800,
      recommendedHeight: 200,
      aspectRatio: '4:1',
      maxFileSize: '3 MB',
      formats: ['WebP', 'PNG', 'JPEG'],
      quality: 'Medium',
    },
    backgroundOptions: [
      { id: 'broker-light', label: 'Broker Listing (Light)', type: 'page', value: 'broker' },
      { id: 'broker-dark', label: 'Broker Listing (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  BROKER_PROFILE_HEADER: {
    key: 'BROKER_PROFILE_HEADER',
    label: 'Broker Profile Header',
    description: 'Header banner on individual broker profiles',
    page: 'Broker Profile Page',
    position: 'Top of broker profile, below navigation',
    visibility: 'Desktop + Mobile',
    priority: 'High visibility',
    icon: User,
    specs: {
      recommendedWidth: 1200,
      recommendedHeight: 300,
      aspectRatio: '4:1',
      maxFileSize: '5 MB',
      formats: ['WebP', 'PNG', 'JPEG'],
      quality: 'High',
    },
    backgroundOptions: [
      { id: 'broker-profile-light', label: 'Broker Profile (Light)', type: 'page', value: 'broker-profile' },
      { id: 'broker-profile-dark', label: 'Broker Profile (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  BROKER_LISTING_SIDEBAR: {
    key: 'BROKER_LISTING_SIDEBAR',
    label: 'Broker Listing Sidebar',
    description: 'Sidebar ad on broker listing pages',
    page: 'Broker Listing Page',
    position: 'Right sidebar of broker listing',
    visibility: 'Desktop only',
    priority: 'Medium visibility',
    icon: Layout,
    specs: {
      recommendedWidth: 300,
      recommendedHeight: 250,
      aspectRatio: '6:5',
      maxFileSize: '2 MB',
      formats: ['WebP', 'PNG', 'JPEG'],
      quality: 'Medium',
    },
    backgroundOptions: [
      { id: 'broker-light', label: 'Broker Listing (Light)', type: 'page', value: 'broker' },
      { id: 'broker-dark', label: 'Broker Listing (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  LOAN_CALCULATOR: {
    key: 'LOAN_CALCULATOR',
    label: 'Loan Calculator',
    description: 'Banner within the loan calculator tool',
    page: 'Loan Calculator Page',
    position: 'Above or below calculator form',
    visibility: 'Desktop + Mobile',
    priority: 'Medium visibility',
    icon: Calculator,
    specs: {
      recommendedWidth: 800,
      recommendedHeight: 200,
      aspectRatio: '4:1',
      maxFileSize: '3 MB',
      formats: ['WebP', 'PNG', 'JPEG'],
      quality: 'Medium',
    },
    backgroundOptions: [
      { id: 'calculator-light', label: 'Calculator (Light)', type: 'page', value: 'calculator' },
      { id: 'calculator-dark', label: 'Calculator (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  BLOG_INLINE: {
    key: 'BLOG_INLINE',
    label: 'Blog Inline',
    description: 'Inline banner within blog post content',
    page: 'Blog Post Pages',
    position: 'Between paragraphs or at end of article',
    visibility: 'Desktop + Mobile',
    priority: 'Low visibility',
    icon: FileText,
    specs: {
      recommendedWidth: 800,
      recommendedHeight: 200,
      aspectRatio: '4:1',
      maxFileSize: '2 MB',
      formats: ['WebP', 'PNG', 'JPEG'],
      quality: 'Medium',
    },
    backgroundOptions: [
      { id: 'blog-light', label: 'Blog (Light)', type: 'page', value: 'blog' },
      { id: 'blog-dark', label: 'Blog (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  FOOTER: {
    key: 'FOOTER',
    label: 'Footer Banner',
    description: 'Banner in the website footer',
    page: 'All Pages',
    position: 'Footer area, above copyright',
    visibility: 'Desktop + Mobile',
    priority: 'Low visibility',
    icon: Layout,
    specs: {
      recommendedWidth: 1200,
      recommendedHeight: 150,
      aspectRatio: '8:1',
      maxFileSize: '2 MB',
      formats: ['WebP', 'PNG', 'JPEG', 'SVG'],
      quality: 'Medium',
    },
    backgroundOptions: [
      { id: 'footer-light', label: 'Footer (Light)', type: 'page', value: 'footer' },
      { id: 'footer-dark', label: 'Footer (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  ANNOUNCEMENT_TOP: {
    key: 'ANNOUNCEMENT_TOP',
    label: 'Announcement Top',
    description: 'Top announcement bar across all pages',
    page: 'All Pages',
    position: 'Top of page, above navigation',
    visibility: 'Desktop + Mobile',
    priority: 'High visibility',
    icon: Bell,
    specs: {
      recommendedWidth: 1920,
      recommendedHeight: 60,
      aspectRatio: '32:1',
      maxFileSize: '500 KB',
      formats: ['WebP', 'PNG', 'JPEG', 'SVG'],
      quality: 'High',
    },
    backgroundOptions: [
      { id: 'announcement-light', label: 'Announcement (Light)', type: 'page', value: 'announcement' },
      { id: 'announcement-dark', label: 'Announcement (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  ANNOUNCEMENT_BOTTOM: {
    key: 'ANNOUNCEMENT_BOTTOM',
    label: 'Announcement Bottom',
    description: 'Bottom announcement bar before footer',
    page: 'All Pages',
    position: 'Bottom of page, above footer',
    visibility: 'Desktop + Mobile',
    priority: 'Medium visibility',
    icon: Bell,
    specs: {
      recommendedWidth: 1920,
      recommendedHeight: 80,
      aspectRatio: '24:1',
      maxFileSize: '500 KB',
      formats: ['WebP', 'PNG', 'JPEG', 'SVG'],
      quality: 'Medium',
    },
    backgroundOptions: [
      { id: 'announcement-light', label: 'Announcement (Light)', type: 'page', value: 'announcement' },
      { id: 'announcement-dark', label: 'Announcement (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  POPUP_OVERLAY: {
    key: 'POPUP_OVERLAY',
    label: 'Popup Overlay',
    description: 'Modal popup overlay on page load',
    page: 'All Pages (configurable)',
    position: 'Center of viewport as modal overlay',
    visibility: 'Desktop + Mobile',
    priority: 'Highest visibility (intrusive)',
    icon: X,
    specs: {
      recommendedWidth: 600,
      recommendedHeight: 400,
      aspectRatio: '3:2',
      maxFileSize: '1 MB',
      formats: ['WebP', 'PNG', 'JPEG'],
      quality: 'High',
    },
    backgroundOptions: [
      { id: 'popup-light', label: 'Popup (Light)', type: 'page', value: 'popup' },
      { id: 'popup-dark', label: 'Popup (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
  MOBILE_HEADER_BANNER: {
    key: 'MOBILE_HEADER_BANNER',
    label: 'Mobile Header Banner',
    description: 'Banner in mobile header navigation',
    page: 'All Pages (mobile only)',
    position: 'Below mobile header navigation',
    visibility: 'Mobile only',
    priority: 'High visibility',
    icon: Smartphone,
    specs: {
      recommendedWidth: 375,
      recommendedHeight: 80,
      aspectRatio: '375:80',
      maxFileSize: '500 KB',
      formats: ['WebP', 'PNG', 'JPEG'],
      quality: 'High',
    },
    backgroundOptions: [
      { id: 'mobile-light', label: 'Mobile (Light)', type: 'page', value: 'mobile' },
      { id: 'mobile-dark', label: 'Mobile (Dark)', type: 'theme', value: 'dark' },
      { id: 'light', label: 'Light Theme', type: 'theme', value: 'light' },
      { id: 'dark', label: 'Dark Theme', type: 'theme', value: 'dark' },
    ],
  },
}

// Full-width / top banner placements rendered as a bounded horizontal strip.
// The top strip is capped at a maximum displayed height of 150px on desktop.
const FULL_WIDTH_TOP_PLACEMENTS: PlacementKey[] = [
  'HOMEPAGE_HERO',
  'HOMEPAGE_SEARCH',
  'HOMEPAGE_FEATURED',
  'HOMEPAGE_SERVICES',
  'HOMEPAGE_BANKS',
  'HOMEPAGE_CTA',
  'BROKER_LISTING',
  'BROKER_PROFILE_HEADER',
  'LOAN_CALCULATOR',
  'BLOG_INLINE',
]

export function getPlacementInfo(placement: string): PlacementInfo | undefined {
  const base = PLACEMENT_INFO[placement as PlacementKey]
  if (!base) return undefined

  const spec = getPlacementSpec(placement)
  if (!spec) return base

  const primary = spec.formats[0]
  const dimensions = getRequiredDimensions(placement, primary, 'desktop')
  const isFullWidthTop = FULL_WIDTH_TOP_PLACEMENTS.includes(placement as PlacementKey)

  return {
    ...base,
    specs: {
      ...base.specs,
      recommendedWidth: dimensions.width,
      recommendedHeight: dimensions.height,
      aspectRatio: dimensions.aspectRatio,
      maxFileSize: '10 MB',
      formats: ['JPEG', 'PNG', 'WebP', 'GIF'],
      displayHeight: {
        mobile: getDisplayHeight(placement, 'mobile'),
        tablet: getDisplayHeight(placement, 'tablet'),
        desktop: getDisplayHeight(placement, 'desktop'),
      },
      maxDisplayHeight: isFullWidthTop ? 150 : undefined,
    },
  }
}
