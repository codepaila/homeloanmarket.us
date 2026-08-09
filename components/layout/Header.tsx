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
  BookOpen,
  Calculator,
  Info,
  Phone,
  ChevronDown,
  Building2,
  Star,
  HelpCircle,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ThemeToggle from '@/components/ThemeToggle'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { PremiumButton } from '@/components/design/PremiumButton'
import { AdvertisementRenderer } from '@/components/advertisements'
import type { SiteSettings } from '@/lib/site/settings'
import Image from 'next/image'

const navigation = [
  {
    name: 'Home',
    href: '/',
    icon: Home,
  },
  {
    name: 'Find Brokers',
    href: '/brokers',
    icon: Briefcase,
    children: [
      {
        name: 'All Mortgage Brokers',
        description: 'Find mortgage brokers',
        href: '/brokers',
        icon: Building2,
      },
      {
        name: 'Featured Mortgage Brokers',
        description: 'Our top-rated, premium partners',
        href: '/brokers',
        icon: Star,
      },
    ],
  },
  {
    name: 'Resources',
    href: '/guides',
    icon: BookOpen,
    children: [
      {
        name: 'Guides',
        description: 'Learn about the mortgage process',
        href: '/guides',
        icon: BookOpen,
      },
      {
        name: 'Mortgage Calculator',
        description: 'Estimate your monthly payment in seconds',
        href: '/calculator',
        icon: Calculator,
      },
      {
        name: 'FAQ',
        description: 'Answers to common questions',
        href: '/faq',
        icon: HelpCircle,
      },
    ],
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

  // Close dropdowns on outside click
  useEffect(() => {
    if (!openDropdown && !isUserMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openDropdown, isUserMenuOpen])

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

  return (
    <>
      <header
        ref={headerRef}
        className={cn(
          'sticky top-0 z-40 border-b bg-background',
          scrolled ? 'border-border/80 shadow-soft' : 'border-transparent',
          reducedMotion ? '' : 'transition-[background-color,border-color,box-shadow] duration-200 ease-out',
        )}
      >
        <div className="lg:hidden">
          <AdvertisementRenderer placement="MOBILE_HEADER_BANNER" />
        </div>
        <div className="container-custom">
          <div className="flex h-16 items-center justify-between md:h-[72px] w-full">
            {/* Logo */}
            <div
              className="flex-shrink-0"
            >
                <Link href="/" className="flex items-center gap-2">
                 {settings?.siteLogo ? (
                   <Image width={300} height={100} src={settings.siteLogo} alt={settings.siteName} className="h-9 max-w-40 object-contain" />
                 ) : (
                   <>
                   <Image
                    width={400}
                    height={100}
                    src="/assets/logo.png"
                    alt="HomeLoanMarket"
                    className="h-9 max-w-40 object-contain" 
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
              {navigation.map((item) =>
                item.children ? (
                  <div key={item.name} className="relative">
                    <button
                      onClick={() =>
                        setOpenDropdown(
                          openDropdown === item.name ? null : item.name
                        )
                      }
                      aria-expanded={openDropdown === item.name}
                      aria-haspopup="true"
                      className={cn(
                        'flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                        isActive(item.href)
                          ? 'text-primary'
                          : 'text-text-muted hover:text-text-main',
                      )}
                    >
                      {item.name}
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform duration-200',
                          openDropdown === item.name && 'rotate-180',
                        )}
                      />
                    </button>

                    <AnimatePresence>
                      {openDropdown === item.name && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.98 }}
                          transition={{ duration: 0.15, ease: 'easeOut' }}
                          className="absolute left-0 top-full mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-large"
                        >
                          {item.children.map((child) => (
                            <Link
                              key={child.name}
                              href={child.href}
                              className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-muted/60"
                              onClick={() => setOpenDropdown(null)}
                            >
                              <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                                <child.icon className="h-4 w-4" />
                              </span>
                              <span>
                                <span className="block text-sm font-semibold text-text-main">
                                  {child.name}
                                </span>
                                <span className="block text-xs text-text-muted">
                                  {child.description}
                                </span>
                              </span>
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'text-primary'
                        : 'text-text-muted hover:text-text-main',
                    )}
                  >
                    {item.name}
                    {isActive(item.href) && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-primary"
                      />
                    )}
                  </Link>
                ),
              )}
            </nav>

            {/* Right Side: Auth/User */}
            <div className="flex items-center gap-2.5">
              <div className="hidden md:block">
                <ThemeToggle />
              </div>

              {user ? (
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    aria-expanded={isUserMenuOpen}
                    className="flex items-center gap-2 rounded-xl bg-muted/50 px-2.5 py-1.5 text-sm font-medium text-text-main transition-colors hover:bg-accent"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name || 'User'}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="font-semibold text-primary">
                          {user.name?.charAt(0) ||
                            user.email?.charAt(0) ||
                            'U'}
                        </span>
                      )}
                    </div>
                    <span className="hidden lg:inline">
                      {user.name || user.email?.split('@')[0]}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-text-muted transition-transform duration-200',
                        isUserMenuOpen && 'rotate-180',
                      )}
                    />
                  </motion.button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <UserDropdown
                        user={user}
                        onSignOut={handleSignOut}
                        onClose={() => setIsUserMenuOpen(false)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2"
                >
                  <Link
                    href="/auth/signin"
                    className="hidden rounded-xl px-3.5 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text-main sm:block"
                  >
                    Sign In
                  </Link>
                  <Link href="/auth/signup">
                    <PremiumButton size="sm" className="px-4">
                      Create Account
                    </PremiumButton>
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                className="rounded-xl p-2 text-text-main transition-colors hover:bg-muted lg:hidden"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Toggle menu"
                aria-expanded={isMenuOpen}
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
            navigation={navigation}
            user={user}
            onSignOut={handleSignOut}
            onClose={() => setIsMenuOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function UserDropdown({
  user,
  onSignOut,
  onClose,
}: {
  user: NonNullable<ReturnType<typeof useCurrentUser>>
  onSignOut: () => void
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-large"
    >
      <div className="border-b p-3">
        <p className="font-semibold text-text-main">
          {user.name || user.email}
        </p>
        <p className="text-xs capitalize text-text-muted">
          {user.role.toLowerCase()}
        </p>
      </div>
      <div className="p-1.5">
        {user.isBroker && (
          <Link
            href="/broker/dashboard"
            className="block rounded-lg px-3 py-2 text-sm text-text-main transition-colors hover:bg-muted"
            onClick={onClose}
          >
            Dashboard
          </Link>
        )}
        {user.isBroker && (
          <Link
            href="/broker/subscription"
            className="block rounded-lg px-3 py-2 text-sm text-text-main transition-colors hover:bg-muted"
            onClick={onClose}
          >
            Subscription
          </Link>
        )}
        <div className="my-1 border-t border-border" />
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/5"
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
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-hidden border-b border-border bg-card lg:hidden"
    >
      <div className="container-custom space-y-1 py-3">
        {navigation.map((item) => (
          <div key={item.name}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-main transition-colors hover:bg-muted"
              onClick={onClose}
            >
              <item.icon className="h-5 w-5 text-text-muted" />
              {item.name}
            </Link>
            {item.children && (
              <div className="ml-4 space-y-0.5 border-l border-border pl-3">
                {item.children.map((child) => (
                  <Link
                    key={child.name}
                    href={child.href}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-muted hover:text-text-main"
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

        <div className="flex items-center justify-between rounded-lg px-3 py-2">
          <span className="text-sm font-medium text-text-main">
            Appearance
          </span>
          <ThemeToggle />
        </div>

        <div className="border-t border-border pt-2">
          {user ? (
            <>
              {user.isBroker && (
                <Link
                  href="/broker/dashboard"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-muted"
                  onClick={onClose}
                >
                  Dashboard
                </Link>
              )}
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
              <Link
                href="/auth/signin"
                className="flex items-center justify-center rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-text-main transition-colors hover:bg-muted"
                onClick={onClose}
              >
                Sign In
              </Link>
              <Link href="/auth/signup" onClick={onClose}>
                <PremiumButton fullWidth size="sm" className="py-2.5">
                  Get Started
                </PremiumButton>
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
