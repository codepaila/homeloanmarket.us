// app/broker/company/edit/page.tsx
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
  const brokerProfile = await prisma.broker.findFirst({
    where: { userId: user.id },
  })

  if (!brokerProfile) {
    redirect('/setup')
  }

  const brokerDto = {
    id: brokerProfile.id,
    displayName: brokerProfile.displayName,
    companyName: brokerProfile.companyName,
    logo: brokerProfile.logo,
    profileImage: brokerProfile.profileImage,
    description: brokerProfile.description,
    phone: brokerProfile.phone,
    whatsapp: brokerProfile.whatsapp,
    email: brokerProfile.email,
    website: brokerProfile.website,
    officeAddress: brokerProfile.officeAddress,
    city: brokerProfile.city,
    state: brokerProfile.state,
    pinCode: brokerProfile.pinCode,
    googlePlaceId: brokerProfile.googlePlaceId,
    normalizedAddress: brokerProfile.normalizedAddress,
    locationCountryCode: brokerProfile.locationCountryCode,
    location: brokerProfile.location,
    experienceYears: brokerProfile.experienceYears,
    nmls: brokerProfile.nmls,
    licenseStates: brokerProfile.licenseStates,
    socialLinks: brokerProfile.socialLinks,
    isVisible: brokerProfile.isVisible,
  }

  return <EditBrokerProfile broker={brokerDto} />
}
