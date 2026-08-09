'use client'

import { cn } from '@/lib/utils'
import { motion } from 'motion/react'
import {
  Verified,
  Star,
  TrendingUp,
  Zap,
  Shield,
  Award,
  CheckCircle,
  Clock,
  Users,
} from 'lucide-react'

const badgeBase =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200'

interface StatusBadgeProps {
  variant?: 'verified' | 'featured' | 'premium' | 'free'
  children?: React.ReactNode
  className?: string
}

export function StatusBadge({ variant = 'verified', children, className }: StatusBadgeProps) {
  const variants = {
    verified: cn(
      badgeBase,
      'bg-emerald-500/10',
      'text-emerald-700 ring-1 ring-emerald-600/20',
      'dark:text-emerald-300 dark:ring-emerald-400/30',
      className,
    ),
    featured: cn(
      badgeBase,
      'bg-amber-400/15',
      'text-amber-800 ring-1 ring-amber-600/25',
      'dark:text-amber-300 dark:ring-amber-400/30',
      'shadow-sm',
      className,
    ),
    premium: cn(
      badgeBase,
      'bg-purple-500/15',
      'text-purple-800 ring-1 ring-purple-600/25',
      'dark:text-purple-300 dark:ring-purple-400/30',
      className,
    ),
    free: cn(
      badgeBase,
      'bg-muted/50',
      'text-muted-foreground ring-border',
      className,
    ),
  }

  const icon = {
    verified: <Shield className="h-3 w-3" />,
    featured: <Star className="h-3 w-3 fill-current" />,
    premium: <Award className="h-3 w-3" />,
    free: <Users className="h-3 w-3" />,
  }

  return (
    <span className={variants[variant] || variants.verified}>
      {icon[variant]}
      {children}
    </span>
  )
}

export function FeatureBadge({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
      {icon}
      {children}
    </div>
  )
}

export {
  Verified,
  Star,
  TrendingUp,
  Zap,
  Shield,
  Award,
  CheckCircle,
  Clock,
}
