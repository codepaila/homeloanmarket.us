'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuthFormWrapperProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  showBackLink?: boolean
  backHref?: string
  backLabel?: string
  size?: 'sm' | 'lg'
}

export function AuthFormWrapper({
  title,
  subtitle,
  children,
  footer,
  showBackLink = false,
  backHref = '/',
  backLabel = 'Back to Home',
  size = 'sm',
}: AuthFormWrapperProps) {
  const reduceMotion = useReducedMotion()

  const entrance = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3 } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, ease: 'easeOut' as const } }

  const fade = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: 'easeOut' as const } }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className={cn('w-full', size === 'lg' ? 'max-w-2xl' : 'max-w-md')}>
        <motion.div {...entrance} className="mb-8 flex justify-center">
          <Link
            href="/"
            aria-label="HomeLoanMarket home"
            className="inline-flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Image
              src="/assets/logo.png"
              alt="HomeLoanMarket"
              width={180}
              height={60}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>
        </motion.div>

        {showBackLink && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="mb-4"
          >
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-md"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          </motion.div>
        )}

        <motion.div
          {...fade}
          className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8"
        >
          <div className="mb-8 text-center">
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: reduceMotion ? 0 : 0.05 }}
              className="text-2xl font-bold tracking-tight text-text-main sm:text-3xl"
            >
              {title}
            </motion.h1>
            {subtitle && (
              <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted sm:text-base">
                {subtitle}
              </p>
            )}
          </div>

          {children}

          {footer && (
            <div className="mt-6 border-t border-border pt-6 text-center">{footer}</div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
