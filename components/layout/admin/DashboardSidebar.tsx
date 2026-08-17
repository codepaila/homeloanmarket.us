// components/layout/DashboardSidebar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/utils'
import {
  ChevronDown,
  Home,
  LogOut,
  Shield,
  Crown,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from 'next-auth/react'
import { NavItem } from './NavItem'
import { SubscriptionBadge } from './SubscriptionBadge'
import type { SidebarData, SidebarItem, UserPermissions } from '@/types/nav'

interface DashboardSidebarProps {
  data: SidebarData
  permissions: UserPermissions
  className?: string
}

export function DashboardSidebar({ data, permissions, className }: DashboardSidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleItem = (title: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(title)) {
      newExpanded.delete(title)
    } else {
      newExpanded.add(title)
    }
    setExpandedItems(newExpanded)
  }

  return (
    <aside className={cn("border-r bg-sidebar", className)}>
      {/* Logo & Platform Name */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Home className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-foreground">HomeLoanMarket</span>
        </Link>
      </div>

      {/* User Info Section */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center">
              <span className="text-white font-semibold">
                {data.user.name?.charAt(0) || data.user.email?.charAt(0)}
              </span>
            </div>
            {data.user.isVerified && (
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
                <CheckCircle className="h-3 w-3 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {data.user.name}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground capitalize">
                {data.user.role?.toLowerCase().replace('_', ' ')}
              </span>
              {data.user.role === 'SUPER_ADMIN' && (
                <Shield className="h-3 w-3 text-purple-600" />
              )}
              {data.user.isPremium && (
                <Crown className="h-3 w-3 text-warning" />
              )}
            </div>
          </div>
        </div>

        {/* Subscription Status */}
        <div className="mt-3">
          <SubscriptionBadge user={data.user} />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3 space-y-1">
          {data.navMain.map((item: SidebarItem) => {
            const isActive = Boolean(pathname === item.url ||
              (item.items && item.items.some((subItem: SidebarItem) =>
                subItem.url === pathname ||
                (subItem.items && subItem.items.some((nested: SidebarItem) =>
                  nested.url === pathname
                ))
              )))

            const isExpanded = expandedItems.has(item.title)
            const hasChildren = Boolean(item.items && item.items.length > 0)

            return (
              <div key={item.title}>
                <NavItem
                  item={item}
                  isActive={isActive}
                  isExpanded={isExpanded}
                  hasChildren={hasChildren}
                  onToggle={() => hasChildren && toggleItem(item.title)}
                  permissions={permissions}
                />

                {/* Child Items */}
                {hasChildren && isExpanded && (
                  <div className="ml-9 mt-1 space-y-1">
                    {item.items?.map((child: SidebarItem) => (
                      <NavItem
                        key={child.title}
                        item={child}
                        isActive={pathname === child.url}
                        isExpanded={expandedItems.has(child.title)}
                        hasChildren={Boolean(child.items && child.items.length > 0)}
                        onToggle={() => child.items && toggleItem(child.title)}
                        isChild={true}
                        permissions={permissions}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* System Status (for admins) */}
        {(data.user.role === 'ADMIN' || data.user.role === 'SUPER_ADMIN') && (
          <div className="mt-8 px-4">
            <div className="rounded-lg border p-3 bg-muted">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground">System Status</span>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-xs text-success">Online</span>
                </div>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Active Users</span>
                  <span className="font-medium">1,234</span>
                </div>
                 <div className="flex justify-between">
                   <span>Loan Applications</span>
                   <span className="font-medium">567</span>
                 </div>
                <div className="flex justify-between">
                  <span>Brokers</span>
                  <span className="font-medium">89</span>
                </div>
              </div>
            </div>
          </div>
        )}
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