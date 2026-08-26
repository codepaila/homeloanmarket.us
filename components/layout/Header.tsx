'use client'
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { motion, AnimatePresence, useScroll, useMotionValueEvent, useReducedMotion } from 'motion/react'
import {
  Menu,
  X,
  Home,
  Briefcase,
  Calculator,
  Info,
  Phone,
  ChevronDown,
  LogOut,
  User,
  Building,
  Plus,
  LayoutDashboard,
  Settings,
  Users,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { SiteSettings } from '@/lib/site/settings'
import Image from 'next/image'
import { Button } from '../ui/button'

const navigation = [
  {
    name: 'Home',
    href: '/',
    icon: Home,
  },
  {
    name: 'Find Mortgage Originators',
    href: '/brokers',
    icon: Briefcase,
  },
  {
    name: 'Mortgage Calculator',
    href: '/calculator',
    icon: Calculator,
  },
  { name: 'About', href: '/about', icon: Info },
  { name: 'Contact', href: '/contact', icon: Phone },
]

export default function Header({ settings }: { settings?: SiteSettings }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const reducedMotion = useReducedMotion()
  const pathname = usePathname()
  const user = useCurrentUser()
  const headerRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 6)
  })

  // Close menus on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false)
        setIsUserMenuOpen(false)
        setOpenDropdown(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Close dropdowns and the mobile menu on outside click
  useEffect(() => {
    if (!openDropdown && !isUserMenuOpen && !isMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      const insideHeader = headerRef.current?.contains(target)
      const insideMenu = mobileMenuRef.current?.contains(target)
      if (!insideHeader && !insideMenu) {
        setOpenDropdown(null)
        setIsUserMenuOpen(false)
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openDropdown, isUserMenuOpen, isMenuOpen])

  // Lock scroll when mobile menu or user menu is open
  useEffect(() => {
    if (isMenuOpen || isUserMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen, isUserMenuOpen])

  // Close all menus on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMenuOpen(false)
    setOpenDropdown(null)
    setIsUserMenuOpen(false)
  }, [pathname])

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const handleSignOut = async () => {
    setIsUserMenuOpen(false)
    await signOut({ callbackUrl: '/' })
  }

  const dashboardNavItem = !user
    ? { name: 'Join As Company', href: '/company/register', icon: Building }
    : null

  const navItems = [
    navigation[0],
    navigation[1],
    navigation[2],
    ...(dashboardNavItem ? [dashboardNavItem] : []),
    navigation[3],
    navigation[4],
  ]

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.name) {
      const names = user.name.split(' ')
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase()
      }
      return names[0][0].toUpperCase()
    }
    return user?.email?.[0]?.toUpperCase() || 'U'
  }

  // Get user role display name
  const getRoleDisplay = (role?: string) => {
    if (!role) return 'User'
    const roleMap: Record<string, string> = {
      ADMIN: 'Administrator',
      BROKER: 'Mortgage Originator',
      COMPANY: 'Company',
      USER: 'User',
    }
    return roleMap[role.toUpperCase()] || role
  }

  // Get user menu items based on role
  const getUserMenuItems = () => {
    const items = []

    // Dashboard for admin
    if (user?.role === 'ADMIN') {
      items.push({
        label: 'Admin Dashboard',
        href: '/admin',
        icon: LayoutDashboard,
      })
      items.push({
        label: 'Manage Brokers',
        href: '/admin/brokers',
        icon: Users,
      })

      items.push({
        label: 'Settings',
        href: '/admin/settings',
        icon: Settings,
      })
    }

    // Dashboard for broker
    if (user?.isBroker) {
      items.push({
        label: 'Dashboard',
        href: '/broker/dashboard',
        icon: LayoutDashboard,
      })
      items.push({
        label: 'Subscription',
        href: '/broker/subscription',
        icon: Building,
      })
    }

    // Dashboard for company
    if (user?.isCompany) {
      items.push({
        label: 'Company Dashboard',
        href: '/company/dashboard',
        icon: LayoutDashboard,
      })
    }

    // Profile for all users
    // items.push({
    //   label: 'Profile',
    //   href: '/profile',
    //   icon: User,
    // })

    return items
  }

  return (
    <>
      <header
        ref={headerRef}
        className={cn(
          'sticky top-0 z-40 border-b bg-background',
          scrolled ? 'border-border shadow-soft' : 'border-transparent',
          reducedMotion ? '' : 'transition-[background-color,border-color,box-shadow] duration-200 ease-out',
        )}
      >
        <div className="container-custom">
          <div className="flex h-16 items-center justify-between md:h-[72px] w-full">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center gap-2">
                {settings?.siteLogo ? (
                  <Image width={300} height={100} src={settings.siteLogo} alt={settings.siteName}
                   className="h-12 max-w-48 object-contain" />
                ) : (
                  <>
                    <Image
                      width={350}
                      height={200}
                      src="/assets/logo.png"
                      alt="HomeLoanMarket"
                      className="h-12 max-w-52 md:max-w-56 object-contain"
                    />
                  </>
                )}
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav
              className="hidden items-center gap-1 lg:flex"
              aria-label="Main navigation"
            >
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'relative rounded-lg px-1.5 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.name}
                  {isActive(item.href) && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-foreground"
                    />
                  )}
                </Link>
              ))}
            </nav>

            {/* Right Side: Auth/User */}
            <div className="flex items-center gap-2">
              {user ? (
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    aria-expanded={isUserMenuOpen}
                    className="flex items-center gap-2 rounded-lg bg-surface p-1 transition-colors hover:bg-muted "
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground text-sm font-semibold text-background">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name || 'User'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{getUserInitials()}</span>
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform duration-200',
                        isUserMenuOpen && 'rotate-180',
                      )}
                    />
                  </motion.button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <UserDropdown
                        user={user}
                        menuItems={getUserMenuItems()}
                        onSignOut={handleSignOut}
                        onClose={() => setIsUserMenuOpen(false)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <Link href="/auth/signin">
                    <Button variant="outline" className="text-sm">
                      <User className="h-4 w-4 mr-1.5" />
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button className="text-sm">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Get Listed
                    </Button>
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                className="rounded-xl p-2  text-foreground transition-colors hover:bg-muted lg:hidden"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Toggle menu"
                aria-expanded={isMenuOpen}
                aria-controls="mobile-menu"
              >
                <motion.div
                  animate={{ rotate: isMenuOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {isMenuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </motion.div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <MobileMenu
            navigation={navItems}
            user={user}
            onSignOut={handleSignOut}
            onClose={() => setIsMenuOpen(false)}
            menuRef={mobileMenuRef}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function UserDropdown({
  user,
  menuItems,
  onSignOut,
  onClose,
}: {
  user: NonNullable<ReturnType<typeof useCurrentUser>>
  menuItems: Array<{ label: string; href: string; icon: React.ElementType }>
  onSignOut: () => void
  onClose: () => void
}) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const getRoleDisplay = (role?: string) => {
    if (!role) return 'User'
    const roleMap: Record<string, string> = {
      ADMIN: 'Administrator',
      BROKER: 'Mortgage Originator',
      COMPANY: 'Company',
      USER: 'User',
    }
    return roleMap[role.toUpperCase()] || role
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-card shadow-large"
    >
      {/* User Info */}
      <div className="border-b border-border px-4 py-3">
        <p className="text-base font-semibold text-foreground">
          {user.name || user.email}
        </p>
        <p className="text-xs text-muted-foreground">
          {getRoleDisplay(user.role)}
        </p>
      </div>

      {/* Navigation Items */}
      <div className="p-1.5">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
              isActive(item.href)
                ? 'bg-surface text-foreground font-medium'
                : 'text-foreground hover:bg-muted'
            )}
            onClick={onClose}
          >
            <item.icon className={cn(
              'h-4 w-4',
              isActive(item.href) ? 'text-foreground' : 'text-muted-foreground'
            )} />
            {item.label}
          </Link>
        ))}

        {/* Divider */}
        <div className="my-1 border-t border-border" />

        {/* Sign Out */}
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/5"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </motion.div>
  )
}

function MobileMenu({
  navigation,
  user,
  onSignOut,
  onClose,
  menuRef,
}: {
  navigation: Array<{
    name: string
    href: string
    icon: React.ElementType
    children?: Array<{
      name: string
      description: string
      href: string
      icon: React.ElementType
    }>
  }>
  user: ReturnType<typeof useCurrentUser> | null
  onSignOut: () => void
  onClose: () => void
  menuRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <motion.div
      id="mobile-menu"
      ref={menuRef}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-x-0 top-16 z-30 overflow-hidden border-b border-border bg-card shadow-large md:top-[72px] lg:hidden"
    >
      <div className="container-custom space-y-1 py-3">
        {navigation.map((item) => (
          <div key={item.name}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              onClick={onClose}
            >
              <item.icon className="h-5 w-5 text-muted-foreground" />
              {item.name}
            </Link>
            {item.children && (
              <div className="ml-4 space-y-0.5 border-l border-border pl-3">
                {item.children.map((child) => (
                  <Link
                    key={child.name}
                    href={child.href}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={onClose}
                  >
                    <child.icon className="h-4 w-4" />
                    {child.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="border-t border-border pt-2">
          {user ? (
            <>
              <button
                onClick={() => {
                  onSignOut()
                  onClose()
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link href="/auth/signin" onClick={onClose}>
                <Button variant="outline" className="w-full text-sm">
                  <User className="h-4 w-4 mr-1.5" />
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/signup" onClick={onClose}>
                <Button className="w-full text-sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Get Listed
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}