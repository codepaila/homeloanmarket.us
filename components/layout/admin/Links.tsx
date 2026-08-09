// components/layout/NavItem.tsx
import Link from 'next/link'
import { ChevronRight, Lock } from 'lucide-react'
import { cn } from '@/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface SidebarItem {
  title: string
  url?: string
  icon?: any
  items?: SidebarItem[]
  badge?: string | number
  enabled?: boolean
}

interface NavItemProps {
  item: SidebarItem
  isActive: boolean
  isExpanded?: boolean
  hasChildren?: boolean
  onToggle?: () => void
  isChild?: boolean
  onNavigate?: () => void
}

export function NavItem({
  item,
  isActive,
  isExpanded = false,
  hasChildren = false,
  onToggle,
  isChild = false,
  onNavigate,
}: NavItemProps) {
  const Icon = item.icon
  const disabled = item.enabled === false

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault()
      return
    }

    if (hasChildren) {
      e.preventDefault()
      onToggle?.()
      return
    }

    onNavigate?.()
  }

  const button = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'w-full justify-start font-normal',
        isChild ? 'pl-8' : 'pl-3',
        isActive && 'bg-primary/10 text-primary',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            'mr-3 h-4 w-4',
            isActive && 'text-primary'
          )}
        />
      )}

      <span className="flex-1 text-left">{item.title}</span>

      {/* Badge */}
      {item.badge !== undefined && (
        <Badge variant="secondary" className="ml-2">
          {item.badge}
        </Badge>
      )}

      {/* Locked */}
      {disabled && <Lock className="ml-2 h-3 w-3" />}

      {/* Expand Arrow */}
      {hasChildren && (
        <ChevronRight
          className={cn(
            'ml-2 h-4 w-4 transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
      )}
    </Button>
  )

  // Disabled or expandable: button only
  if (disabled || hasChildren || !item.url) {
    return button
  }

  // Normal navigation
  return (
    <Link href={item.url} className="block">
      {button}
    </Link>
  )
}
