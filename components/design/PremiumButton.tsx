'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { motion } from 'motion/react'

const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold',
    'transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 shrink-0',
  ),
  {
    variants: {
      variant: {
        primary: cn(
          'bg-accent text-accent-foreground hover:bg-primary',
          'text-white shadow-soft hover:shadow-medium hover:-translate-y-0.5',
        ),
        secondary: cn(
          'bg-card text-text-main border border-border',
          'hover:bg-accent hover:text-accent-foreground',
        ),
        outline: cn(
          'border-2 border-primary text-primary',
          'hover:bg-primary hover:text-primary-foreground',
        ),
        ghost: cn(
          'text-text-muted hover:bg-accent hover:text-accent-foreground',
        ),
        link: cn('text-primary underline-offset-4 hover:underline'),
        destructive: cn(
          'bg-destructive text-white hover:bg-destructive/90',
        ),
      },
      size: {
        sm: 'h-9 px-3.5 py-2 text-xs',
        default: 'h-10 px-4 py-2 text-sm',
        md: 'h-11 px-5 py-2.5 text-base',
        lg: 'h-12 px-6 py-3 text-base',
        xl: 'h-14 px-8 py-4 text-lg',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface PremiumButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
  leftIcon?: React.ReactNode
  fullWidth?: boolean
}

const PremiumButton = React.forwardRef<HTMLButtonElement, PremiumButtonProps>(
  ({ className, variant, size, asChild = false, loading, loadingText, leftIcon, fullWidth, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'

    const content = loading ? (
      <>
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        {loadingText ? loadingText : children}
      </>
    ) : (
      <>
        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        {children}
      </>
    )

    return (
      <motion.div
        whileTap={asChild ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.1 }}
        className={asChild ? 'inline-block' : undefined}
      >
        <Comp
          className={cn(buttonVariants({ variant, size, className }), fullWidth && 'w-full')}
          ref={ref}
          disabled={disabled || loading}
          {...props}
        >
          {content}
        </Comp>
      </motion.div>
    )
  },
)
PremiumButton.displayName = 'PremiumButton'

export { PremiumButton, buttonVariants }
