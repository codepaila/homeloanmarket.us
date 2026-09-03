import Image from 'next/image'
import { cn } from '@/lib/utils'

export function BrokerSubscriptionBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn('relative inline-block  flex-shrink-0', className)}
      title="Mortgage Expert"
    >
      <Image
        src="/assets/images/pro-mortage-icon.PNG"
        alt="Mortgage Expert"
        fill
        sizes="100vw"
        className="object-contain"
      />
    </span>
  )
}
