import Image from 'next/image'
import { cn } from '@/lib/utils'

export function BrokerSubscriptionBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn('relative inline-block  flex-shrink-0', className)}
      title="Premium subscribed mortgage originator"
    >
      <Image
        src="/assets/images/pro-mortage-icon.PNG"
        alt="Premium subscribed mortgage originator"
        fill
        sizes="100vw"
        className="object-contain"
      />
    </span>
  )
}
