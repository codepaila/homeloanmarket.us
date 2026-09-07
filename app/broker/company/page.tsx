import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import { BrokerProfile } from '@/components/sections/broker/BrokerProfile'
import prisma from '@/lib/prisma'
import { toBrokerOwnerDto } from '@/lib/broker-owner-dto'

export default async function BrokerProfilePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.brokerProfile) {
    redirect('/setup')
  }

  // Fetch the broker's own company profile. Only the owner DTO (which excludes
  // registration/tax identifiers, cover images and performance metrics) is
  // passed to the client — never the raw record.
  const broker = await prisma.broker.findUnique({
    where: { id: user.brokerProfile.id },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
        }
      },
      subscription: true,
    }
  })

  if (!broker) {
    redirect('/setup')
  }

  const safeBroker = toBrokerOwnerDto(broker)

  const profileUser = {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
    brokerProfile: safeBroker,
  }

  return <BrokerProfile user={profileUser} />
}