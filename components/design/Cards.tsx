'use client'

import { cn } from '@/lib/utils'
import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { Star } from 'lucide-react'

export function BankCard({
  bankName,
  bankType,
  logo,
  className,
}: {
  bankName: string
  bankType?: string
  logo?: string
  className?: string
}) {
  const typeColors: Record<string, string> = {
    PUBLIC:
      'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/30',
    PRIVATE:
      'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/15 dark:text-purple-300 dark:ring-purple-400/30',
    COOPERATIVE:
      'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/15 dark:text-green-300 dark:ring-green-400/30',
    FOREIGN:
      'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30',
  }

  return (
    <motion.div
      className={cn(
        'flex items-center justify-between rounded-xl border border-border',
        'bg-card/80 p-4 transition-all duration-200',
        'hover:shadow-soft hover:border-primary/30',
        className,
      )}
      whileHover={{ y: -2 }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
          {logo ? (
            <Image
              src={logo}
              alt={bankName}
              width={32}
              height={32}
              className="object-contain"
            />
          ) : (
            <span className="text-sm font-bold text-muted-foreground">
              {bankName.charAt(0)}
            </span>
          )}
        </div>
        <div>
          <p className="font-medium text-foreground">{bankName}</p>
          {bankType && (
            <span
              className={cn(
                'mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                typeColors[bankType] || 'bg-muted text-muted-foreground ring-border',
              )}
            >
              {bankType}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function TestimonialCard({
  name,
  role,
  image,
  content,
  rating = 5,
  className,
}: {
  name: string
  role: string
  image?: string
  content: string
  rating?: number
  className?: string
}) {
  return (
    <motion.div
      className={cn(
        'relative rounded-2xl border border-border bg-card/80 p-6',
        'backdrop-blur-sm transition-all duration-300',
        'hover:shadow-medium',
        className,
      )}
      whileHover={{ y: -3 }}
    >
      <div className="mb-4 flex gap-1">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        ))}
      </div>

      <p className="mb-6 text-sm italic text-muted-foreground">
        &quot;{content}&quot;
      </p>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-muted overflow-hidden">
          {image ? (
            <Image
              src={image}
              alt={name}
              width={40}
              height={40}
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
              {name.charAt(0)}
            </span>
          )}
        </div>
        <div>
          <p className="font-semibold text-foreground">{name}</p>
          <p className="text-sm text-muted-foreground">{role}</p>
        </div>
      </div>
    </motion.div>
  )
}

export function TestimonialGrid({
  testimonials,
  className,
}: {
  testimonials: Array<{
    name: string
    role: string
    image?: string
    content: string
    rating?: number
  }>
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
    >
      {testimonials.map((testimonial, i) => (
        <TestimonialCard key={i} {...testimonial} />
      ))}
    </div>
  )
}

export function ProcessCard({
  step,
  title,
  description,
  icon,
  className,
}: {
  step: number
  title: string
  description: string
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={cn(
        'relative rounded-2xl border border-border bg-card/80 p-6',
        'backdrop-blur-sm transition-all duration-300',
        'hover:shadow-medium',
        className,
      )}
      whileHover={{ y: -3 }}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon || (
            <span className="text-lg font-bold">{step}</span>
          )}
        </div>
        <div>
          <h3 className="font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </motion.div>
  )
}

export function FeatureCard({
  icon,
  title,
  description,
  children,
  link,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description: string
  children?: React.ReactNode
  link?: string
  className?: string
}) {
  const content = (
    <div
      className={cn(
        'group flex flex-col rounded-2xl border border-border bg-card/80 p-6',
        'transition-all duration-300 hover:shadow-medium hover:-translate-y-0.5',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground flex-1">{description}</p>
      {children}
    </div>
  )

  if (link) {
    return <Link href={link}>{content}</Link>
  }
  return content
}
