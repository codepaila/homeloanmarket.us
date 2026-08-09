import { cn } from '@/lib/utils'

interface SectionProps {
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
  container?: 'default' | 'narrow' | 'wide'
  centered?: boolean
  id?: string
}

export function Section({
  children,
  className,
  size = 'lg',
  container = 'default',
  centered = false,
  id,
}: SectionProps) {
  const sizeClass = {
    sm: 'py-8 md:py-10 lg:py-12',
    md: 'py-12 md:py-14 lg:py-16',
    lg: 'py-12 md:py-16 lg:py-[88px]',
  }

  const containerClass = {
    default: 'container-custom',
    narrow: 'mx-auto w-full px-4 sm:px-6 lg:px-8 max-w-[1024px]',
    wide: 'container-custom',
  }

  return (
    <section
      id={id}
      className={cn(sizeClass[size], className)}
    >
      <div
        className={cn(
          containerClass[container],
          centered && 'flex flex-col items-center text-center',
        )}
      >
        {children}
      </div>
    </section>
  )
}

export function Container({
  children,
  className,
  maxWidth = 'default',
}: {
  children: React.ReactNode
  className?: string
  maxWidth?: 'default' | 'narrow' | 'wide' | 'full'
}) {
  const maxWidthClass = {
    default: 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8',
    narrow: 'mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8',
    wide: 'mx-auto w-full max-w-8xl px-4 sm:px-6 lg:px-8',
    full: 'w-full px-4 sm:px-6 lg:px-8',
  }

  return (
    <div className={maxWidthClass[maxWidth]}>
      {children}
    </div>
  )
}

export function SectionHeader({
  title,
  subtitle,
  centered = true,
  className,
  badge,
}: {
  title: string
  subtitle?: string
  centered?: boolean
  className?: string
  badge?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'mb-10 md:mb-12',
        centered && 'text-center mx-auto max-w-3xl',
        className,
      )}
    >
      {badge && <div className="mb-4">{badge}</div>}
      <h2
        className={cn(
          'heading-2 font-bold',
          'text-text-main',
          'tracking-tight',
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-lg text-text-muted leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  )
}
