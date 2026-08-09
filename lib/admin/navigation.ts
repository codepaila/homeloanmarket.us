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
    label: 'Marketplace',
    items: [
      { label: 'Advertisements', href: '/admin/ads', icon: Megaphone },
      { label: 'Brokers', href: '/admin/brokers', icon: Building2 },
    ],
  },
  {
    label: 'Media',
    items: [
      { label: 'Media', href: '/admin/media', icon: ImageIcon },
      { label: 'Folders', href: '/admin/folders', icon: FolderOpen },
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
