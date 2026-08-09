// app/broker/profile/edit/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import { EditBrokerProfile } from '@/components/sections/broker/EditProfile'
import prisma from '@/lib/prisma'

export default async function BrokerProfileEditPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'BROKER') {
    redirect('/dashboard')
  }

  // Fetch complete broker profile
  const brokerProfile = await prisma.broker.findUnique({
    where: { userId: user.id },
  })

  if (!brokerProfile) {
    redirect('/broker/setup')
  }

  const brokerDto = {
    id: brokerProfile.id,
    displayName: brokerProfile.displayName,
    companyName: brokerProfile.companyName,
    profileSlug: brokerProfile.profileSlug,
    logo: brokerProfile.logo,
    coverImage: brokerProfile.coverImage,
    description: brokerProfile.description,
    phone: brokerProfile.phone,
    whatsapp: brokerProfile.whatsapp,
    email: brokerProfile.email,
    website: brokerProfile.website,
    officeAddress: brokerProfile.officeAddress,
    city: brokerProfile.city,
    state: brokerProfile.state,
    pinCode: brokerProfile.pinCode,
    experienceYears: brokerProfile.experienceYears,
    specializations: brokerProfile.specializations,
    serviceCities: brokerProfile.serviceCities,
    languages: brokerProfile.languages,
    registrationNumber: brokerProfile.registrationNumber,
    panNumber: brokerProfile.panNumber,
    isVisible: brokerProfile.isVisible,
    verificationStatus: brokerProfile.verificationStatus,
  }

  return <EditBrokerProfile broker={brokerDto} />
}
