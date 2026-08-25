/* eslint-disable react-hooks/purity */
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

  // Fetch complete broker data with relations
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
      bankPartners: true,
      reviews: {
        include: {
          user: {
            select: {
              name: true,
              image: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      subscription: true,
      contactMessages: {
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!broker) {
    redirect('/setup')
  }

  // Calculate statistics
  const monthlyLeads = broker.contactMessages.filter(msg => 
    msg.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length
  const { contactMessages: _contactMessages } = broker
  void _contactMessages
  const safeBroker = toBrokerOwnerDto(broker, { monthlyLeads })

  const enhancedUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    brokerProfile: {
      ...safeBroker,
      // Add derived fields for compatibility
      companyLogo: broker.logo,
      officePhone: broker.phone,
      alternateEmail: broker.email || user.email,
      officeAddress: broker.officeAddress,
      officeCity: broker.city,
      officeState: broker.state,
      officePinCode: broker.pinCode,
      yearsOfExperience: broker.experienceYears,
      bankPartnerships: broker.bankPartners.map(bp => bp.bankName),
      registrationNumber: broker.registrationNumber,
      panNumber: broker.panNumber,
      certifications: [], // Add if needed
      awards: [], // Add if needed
      successRate: 0, // Calculate based on converted leads
      avgProcessingTime: 0, // Add calculation
      totalLoansProcessed: broker.totalLeads,
      responseRate: 85, // Default
      verificationStatus: broker.verificationStatus,
      brokerStatus: broker.brokerStatus,
      featuredRank: broker.featuredRank,
      isVisible: broker.isVisible,
      verifiedAt: broker.verifiedAt,
      profileViews: broker.profileViews,
      avgRating: broker.avgRating,
      totalReviews: broker.totalReviews,
    }
  }

  return <BrokerProfile user={enhancedUser} />
}
