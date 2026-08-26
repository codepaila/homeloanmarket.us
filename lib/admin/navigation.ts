import {
  LayoutDashboard,
  Megaphone,
  Building2,
  Image as ImageIcon,
  FolderOpen,
  Settings,
  FileText,
  Search,
  HelpCircle,
  Star,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'

export type AdminNavItem = {
  label: string
  href?: string
  icon: LucideIcon
  disabled?: boolean
}

export type AdminNavGroup = {
  label: string
  items: AdminNavItem[]
}

export const adminNavigation: AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard }],
  },
  {
    label: 'Brokers',
    items: [
      { label: 'Brokers', href: '/admin/brokers', icon: Building2 },
      { label: 'Reviews', href: '/admin/reviews', icon: Star },
    ],
  },
  {
    label: 'Companies',
    items: [
      { label: 'Companies', href: '/admin/companies', icon: Building2 },
      { label: 'Advertisement Requests', href: '/admin/company-ad-requests', icon: Megaphone },
      { label: 'Advertising Plans', href: '/admin/billing/company-advertising-plans', icon: FileText },
    ],
  },
  {
    label: 'Advertisements',
    items: [
      { label: 'All Advertisements', href: '/admin/ads', icon: Megaphone },
      { label: 'Create Advertisement', href: '/admin/ads/new', icon: Megaphone },
      { label: 'Media Library', href: '/admin/media', icon: ImageIcon },
      { label: 'Folders', href: '/admin/folders', icon: FolderOpen },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Broker Plans', href: '/admin/billing/broker-plans', icon: CreditCard },
      { label: 'Broker Subscriptions', href: '/admin/billing/broker-subscriptions', icon: CreditCard },
      { label: 'Company Advertising Plans', href: '/admin/billing/company-advertising-plans', icon: FileText },
      { label: 'Company Subscriptions', href: '/admin/billing/company-subscriptions', icon: FileText },
      { label: 'Stripe Configuration', href: '/admin/billing/stripe', icon: CreditCard },
    ],
  },
  {
    label: 'Site Management',
    items: [
      { label: 'Settings', href: '/admin/settings', icon: Settings },
      { label: 'SEO', href: '/admin/seo', icon: Search },
      { label: 'Content', href: '/admin/content', icon: FileText },
      { label: 'FAQs', href: '/admin/faqs', icon: HelpCircle },
    ],
  },
]

export function isAdminNavItemActive(pathname: string, item: AdminNavItem) {
  if (!item.href) return false
  if (item.href === '/admin') return pathname === '/admin'
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
