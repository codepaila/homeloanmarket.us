import Image from 'next/image'
import { cn } from '@/lib/utils'

export function BrokerSubscriptionBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn('relative inline-block h-6 w-6 flex-shrink-0', className)}
      title="Premium subscribed broker"
    >
      <Image
        src="/assets/images/pro-mortage-icon.PNG"
        alt="Premium subscribed broker"
        fill
        sizes="24px"
        className="object-contain"
      />
    </span>
  )
}
