import { BrokerListingSkeleton } from '@/components/design/BrokerCardSkeleton'
import { PAGE_SIZE } from '@/utils'

export default function Loading() {
  return <BrokerListingSkeleton count={PAGE_SIZE} />
}
