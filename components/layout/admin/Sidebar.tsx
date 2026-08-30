'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/utils'
import {
  LogOut,
  Shield,
  Crown,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from 'next-auth/react'
import { NavItem } from './Links'
import { SubscriptionBadge } from './SubscriptionBadge'
import { Logo } from '@/components/shared/Logo'
import type { SidebarData, SidebarItem, UserPermissions } from '@/types/nav'

interface DashboardSidebarProps {
  data: SidebarData
  permissions: UserPermissions
  className?: string
}

export function DashboardSidebar({
  data,
  permissions,
  className,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleItem = (key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const isItemActive = (item: SidebarItem): boolean => {
    if (item.url === pathname) return true
    if (item.items) {
      return item.items.some(isItemActive)
    }
    return false
  }

  return (
    <aside className={cn('border-r bg-sidebar', className)}>
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo className="h-6" />
        </Link>
      </div>

      {/* User Info */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white font-semibold">
                {data.user.name?.[0] || data.user.email?.[0]}
              </span>
            </div>
            {data.user.isVerified && (
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
                <CheckCircle className="h-3 w-3 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <p className="text-sm font-medium truncate">
              {data.user.name}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{data.user.role?.toLowerCase().replace('_', ' ')}</span>
              {data.user.role === 'SUPER_ADMIN' && (
                <Shield className="h-3 w-3 text-purple-600" />
              )}
              {data.user.isPremium && (
                <Crown className="h-3 w-3 text-warning" />
              )}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <SubscriptionBadge user={data.user} />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {data.navMain.map((section: SidebarItem) => (
          <div key={section.title} className="mb-4">
            {/* Section Label */}
            <div className="px-6 mb-2 text-xs font-semibold uppercase text-muted-foreground">
              {section.title}
            </div>

            <div className="px-3 space-y-1">
              {section.items?.map((item: SidebarItem) => {
                const active = isItemActive(item)
                const expanded = expandedItems.has(item.title)
                const hasChildren = !!item.items?.length

                return (
                  <div key={item.title}>
                    <NavItem
                      item={item}
                      isActive={active}
                       isExpanded={expanded}
                       hasChildren={hasChildren}
                       onToggle={() =>
                         hasChildren && toggleItem(item.title)
                       }
                     />

                    {/* Children */}
                    {hasChildren && expanded && (
                      <div className="ml-9 mt-1 space-y-1">
                         {item.items?.map((child: SidebarItem) => (
                           <NavItem
                             key={child.title}
                             item={child}
                             isActive={isItemActive(child)}
                             isChild
                           />
                         ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  )
}
