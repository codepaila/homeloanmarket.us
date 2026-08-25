// components/layout/MobileSidebar.tsx
import * as React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { NavItem } from "./NavItem"
import { SubscriptionBadge } from "./SubscriptionBadge"
import { usePathname } from "next/navigation"
import type { SidebarData, SidebarItem, UserPermissions } from "@/types/nav"

interface MobileSidebarProps {
  isOpen: boolean
  onClose: () => void
  data: SidebarData
  permissions: UserPermissions
}

export function MobileSidebar({ isOpen, onClose, data, permissions }: MobileSidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set())

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
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="p-0 w-80">
        <div className="flex h-16 items-center justify-between border-b px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold">M</span>
            </div>
             <span className="text-xl font-bold text-foreground">HomeLoanMarket</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* User Info */}
        <div className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center">
              <span className="text-white text-lg font-semibold">
                {data.user.name?.charAt(0) || data.user.email?.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {data.user.name}
              </p>
              <p className="text-sm text-muted-foreground capitalize">
                {data.user.role?.toLowerCase().replace('_', ' ')}
              </p>
            </div>
          </div>
          
          <div className="mt-3">
            <SubscriptionBadge user={data.user} />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-3 space-y-1">
            {data.navMain.map((item: SidebarItem) => {
              const isPathActive = (url?: string) =>
                Boolean(url && (pathname === url || pathname.startsWith(`${url}/`)))
              const isActive = isPathActive(item.url)
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
                    onNavigate={onClose}
                  />
                  
                  {hasChildren && isExpanded && (
                    <div className="ml-9 mt-1 space-y-1">
                      {item.items?.map((child: SidebarItem) => (
                        <NavItem
                          key={child.title}
                          item={child}
                          isActive={isPathActive(child.url)}
                          isExpanded={expandedItems.has(child.title)}
                          hasChildren={Boolean(child.items && child.items.length > 0)}
                          onToggle={() => child.items && toggleItem(child.title)}
                          isChild={true}
                          permissions={permissions}
                          onNavigate={onClose}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}