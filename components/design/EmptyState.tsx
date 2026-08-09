'use client'

import { cn } from '@/lib/utils'
import { motion } from 'motion/react'
import { FileQuestion, Inbox } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function EmptyState({
  title = 'No results found',
  description = 'There\'s nothing here yet.',
  icon,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  const iconSize = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  }

  return (
    <motion.div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'py-12 px-4',
        className,
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className={cn(
          'mb-6 rounded-full bg-muted/50 flex items-center justify-center',
          iconSize[size],
        )}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {icon || <Inbox className="h-6 w-6 text-text-muted" />}
      </motion.div>

      <h3
        className={cn(
          'font-semibold text-text-main mb-2',
          size === 'sm' && 'text-lg',
          size === 'md' && 'text-xl',
          size === 'lg' && 'text-2xl',
        )}
      >
        {title}
      </h3>

      {description && (
        <p className="text-sm text-text-muted mb-6 max-w-md">
          {description}
        </p>
      )}

      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  )
}

export function NoSearchResults({
  searchTerm,
  onClear,
  className,
}: {
  searchTerm?: string
  onClear?: () => void
  className?: string
}) {
  return (
    <EmptyState
      title="No matching brokers found"
      description={
        searchTerm
          ? `We couldn't find any brokers matching "${searchTerm}". Try adjusting your search or filters.`
          : 'Try a different search term or view all brokers.'
      }
      icon={<FileQuestion className="h-8 w-8 text-text-muted" />}
      action={onClear && (
        <button
          onClick={onClear}
          className="btn btn-primary"
        >
          Clear Filters
        </button>
      )}
      className={className}
    />
  )
}
