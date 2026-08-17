'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BrokerAvatar({
  src,
  alt,
  name,
  className,
  imgClassName,
  width = 96,
  height = 96,
  priority,
}: {
  src?: string | null
  alt: string
  name?: string | null
  className?: string
  imgClassName?: string
  width?: number
  height?: number
  priority?: boolean
}) {
  const [error, setError] = useState(false)
  const initials = (name || alt || 'H')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className={cn('relative flex shrink-0 items-center justify-center overflow-hidden  border border-border bg-muted', className)}>
      {src && !error ? (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          className={cn('h-full w-full object-cover', imgClassName)}
          onError={() => setError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-primary/10 text-foreground">
          {initials ? <span className="text-base font-semibold">{initials}</span> : <Building2 className="h-6 w-6 text-muted-foreground" />}
        </div>
      )}
    </div>
  )
}
