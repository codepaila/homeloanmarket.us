// components/layout/NavItem.tsx
import Link from 'next/link'
import { ChevronRight, Lock } from 'lucide-react'
import { cn } from '@/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SidebarItem, UserPermissions } from '@/types/nav'

interface NavItemProps {
  item: SidebarItem
  isActive: boolean
  isExpanded: boolean
  hasChildren: boolean
  onToggle: () => void
  isChild?: boolean
  permissions: UserPermissions
  onNavigate?: () => void
}

export function NavItem({
  item,
  isActive,
  isExpanded,
  hasChildren,
  onToggle,
  isChild = false,
  permissions,
  onNavigate
}: NavItemProps) {
  const Icon = item.icon
  const disabled = item.enabled === false

  const handleClick = (e: React.MouseEvent) => {
    if (hasChildren) {
      e.preventDefault()
      onToggle()
    } else if (onNavigate) {
      onNavigate()
    }
  }

  const content = (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "w-full justify-start font-normal",
        isChild ? "pl-8" : "pl-3",
        isActive && "bg-primary/10 text-primary",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={handleClick}
      disabled={disabled}
    >
      {Icon && <Icon className={cn("mr-3 h-4 w-4", isActive && "text-primary")} />}
      <span className="flex-1 text-left">{item.title}</span>
      
      {/* Badges */}
      {Number(item.badge) > 0 && (
        <Badge variant="secondary" className="ml-2">
          {item.badge}
        </Badge>
      )}
      
      {disabled && (
        <Lock className="ml-2 h-3 w-3" />
      )}
      
      {hasChildren && (
        <ChevronRight className={cn(
          "ml-2 h-4 w-4 transition-transform",
          isExpanded && "rotate-90"
        )} />
      )}
    </Button>
  )

  if (disabled) {
    return content
  }

  if (hasChildren) {
    return content
  }

  return (
    <Link href={item.url ?? ''} className="block">
      {content}
    </Link>
  )
}