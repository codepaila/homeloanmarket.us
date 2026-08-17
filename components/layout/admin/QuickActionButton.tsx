// components/layout/QuickActionButton.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils'
import type { QuickAction } from '@/types/nav'

interface QuickActionButtonProps {
  action: QuickAction
}

export function QuickActionButton({ action }: QuickActionButtonProps) {
  const Icon = action.icon
  
  const colorClasses = {
    primary: "bg-primary hover:bg-primary/90",
    success: "bg-green-600 hover:bg-green-700",
    info: "bg-blue-600 hover:bg-blue-700",
    warning: "bg-yellow-600 hover:bg-yellow-700",
    danger: "bg-red-600 hover:bg-red-700",
  }

  return (
    <Link href={action.url}>
      <Button
        size="sm"
        className={cn(
          "gap-2",
          colorClasses[action.color as keyof typeof colorClasses] || colorClasses.primary
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{action.title}</span>
      </Button>
    </Link>
  )
}