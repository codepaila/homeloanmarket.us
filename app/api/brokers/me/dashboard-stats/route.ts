/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/brokers/me/dashboard-stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user || !user.brokerProfile) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const brokerId = user.brokerProfile.id
    const now = new Date()
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30))

    // Get contact message stats
    const totalContacts = await prisma.contactMessage.count({
      where: { brokerId }
    })

    const recentContacts = await prisma.contactMessage.count({
      where: {
        brokerId,
        createdAt: { gte: thirtyDaysAgo }
      }
    })

    const unreadContacts = await prisma.contactMessage.count({
      where: {
        brokerId,
        isRead: false
      }
    })

    // Get review stats
    const totalReviews = await prisma.review.count({
      where: { brokerId }
    })

    const recentReviews = await prisma.review.count({
      where: {
        brokerId,
        createdAt: { gte: thirtyDaysAgo }
      }
    })

    const avgRatingResult = await prisma.review.aggregate({
      where: { brokerId },
      _avg: { rating: true }
    })

    // Get profile views (you might need to implement this separately)
    const profileViews = user.brokerProfile.profileViews || 0

    // Get bank relations count
    const bankRelations = await prisma.brokerBank.count({
      where: { brokerId }
    })

    return NextResponse.json({
      success: true,
      stats: {
        totalContacts,
        recentContacts,
        unreadContacts,
        totalReviews,
        recentReviews,
        avgRating: avgRatingResult._avg.rating || 0,
        profileViews,
        bankRelations,
        profileCompletion: calculateProfileCompletion(user.brokerProfile)
      }
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}

function calculateProfileCompletion(brokerProfile: any): number {
  const fields = [
    brokerProfile.displayName,
    brokerProfile.description,
    brokerProfile.phone,
    brokerProfile.email,
    brokerProfile.officeAddress,
    brokerProfile.city,
    brokerProfile.state,
    brokerProfile.pinCode,
    brokerProfile.experienceYears > 0,
    brokerProfile.logo,
    brokerProfile.coverImage
  ]

  const completed = fields.filter(Boolean).length
  return Math.round((completed / fields.length) * 100)
}