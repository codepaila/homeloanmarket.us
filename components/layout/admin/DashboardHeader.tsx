/* eslint-disable @typescript-eslint/no-explicit-any */
// components/layout/DashboardHeader.tsx
'use client'

import { Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'


import { SubscriptionBadge } from './SubscriptionBadge'

interface DashboardHeaderProps {
  onMenuClick: () => void
  quickActions: Array<{
    title: string
    url: string
    icon: any
    color: string
  }>
  user: any
}

export function DashboardHeader({ onMenuClick, quickActions, user }: DashboardHeaderProps) {

  // const unreadCount = user?.unreadNotifications || 0

  return (
    <header className="sticky top-0 z-40 flex justify-between h-16 items-center gap-4 border-b bg-background px-4 sm:px-6 lg:px-8">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>
      {/* Search Bar */}
      {/* <div className="flex-1">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-10 pr-4 w-full"
          />
        </div>
      </div> */}

      {/* Quick Actions */}
      <div className="hidden md:block"/>

      {/* <div className="hidden md:flex items-center gap-2">
        {quickActions.map((action, index) => (
          <QuickActionButton key={index} action={action} />
        ))}
      </div> */}

      <SubscriptionBadge user={user} />
      {/* Notifications */}
      {/* <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="max-h-96 overflow-auto">
            <div className="p-4 text-center text-sm text-muted-foreground">
              No new notifications
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu> */}

      {/* <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.image} alt={user?.name} />
              <AvatarFallback>
                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.role?.toLowerCase()}</p>
            </div>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {user?.role === 'BROKER' && (
            <>
              <DropdownMenuItem asChild>
                 <a href="/broker/profile">Mortgage Originator Profile</a>
              </DropdownMenuItem>
              {user?.hasActiveSubscription && (
                <DropdownMenuItem asChild>
                  <a href="/broker/analytics">Analytics</a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          {user?.role === 'BORROWER' && (
            <>
              <DropdownMenuItem asChild>
                <a href="/borrower/profile">My Profile</a>
              </DropdownMenuItem>
       
              <DropdownMenuSeparator />
            </>
          )}

          {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <>
              <DropdownMenuItem asChild>
                <a href="/admin">Admin Dashboard</a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem asChild>
            <a href="/settings">Settings</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/support">Help & Support</a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })}>
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu> */}
    </header>
  )
}