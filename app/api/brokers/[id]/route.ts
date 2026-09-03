/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { hasPaidEntitlement, isBrokerOwner, isMortgageExpertBroker, isPublicBroker, pickBrokerEditableFields } from '@/lib/broker-policy'
import { brokerSubscriptionHasProfileBadge } from '@/lib/broker-plans'
import { toPublicBrokerRecord } from '@/lib/public-broker'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    const id = (await params).id

    const broker = await prisma.broker.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            image: true,
            isActive: true,
            companyMemberships: { where: { isActive: true }, select: { id: true } },
          }
        },
        bankPartners: {
          select: {
            id: true,
            bankName: true,
            bankType: true,
            since: true
          },
          orderBy: { bankName: 'asc' }
        },
        subscription: {
          select: {
            plan: true,
            planId: true,
            isActive: true,
            startDate: true,
            endDate: true,
            planRef: { include: { features: true } },
          }
        },
        reviews: {
          where: {
            status: 'APPROVED'
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            reviews: {
              where: { status: 'APPROVED' }
            },
            contactMessages: true
          }
        }
      }
    })

    if (!broker) {
      return NextResponse.json(
        { message: 'Broker not found' },
        { status: 404 }
      )
    }

    // If user is not admin, check visibility and verification
    if (currentUser?.role !== 'ADMIN') {
      // Only show if broker is visible and verified
      if (!isPublicBroker({
        isVisible: broker.isVisible,
        verificationStatus: broker.verificationStatus,
        brokerStatus: broker.brokerStatus,
        creationSource: broker.creationSource,
        userId: broker.userId,
        userIsActive: broker.user?.isActive,
        hasActiveCompanyMembership: (broker.user?.companyMemberships?.length ?? 0) > 0,
      })) {
        return NextResponse.json(
          { message: 'Broker profile not available' },
          { status: 404 }
        )
      }
      
      // Check if user account is active
      if (broker.userId && !broker.user?.isActive) {
        return NextResponse.json(
          { message: 'Broker profile not available' },
          { status: 404 }
        )
      }
    }

    // Calculate response time and features based on subscription
    let averageResponseTime = 'Within 24 hours'
    let canShowContact = false
    let isFeatured = false

    if (hasPaidEntitlement(broker.subscription)) {
      canShowContact = true
      const plan = broker.subscription?.plan || 'FREE'
      
      switch (plan) {
        case 'FEATURED':
          averageResponseTime = 'Within 4 hours'
          isFeatured = true
          break
        case 'FREE':
        default:
          averageResponseTime = 'Within 24 hours'
          isFeatured = false
      }
    }

    // Check if current user is the broker owner
    const isOwner = currentUser?.id
      ? isBrokerOwner(broker.userId, currentUser.id)
      : false

    // Prepare response data
    const canShowContactFlag = canShowContact || isOwner || currentUser?.role === 'ADMIN'
    const responseData = {
      ...toPublicBrokerRecord(broker, { includeContact: canShowContactFlag }),
      averageResponseTime,
      canShowContact: canShowContactFlag,
      isFeatured,
      isMortgageExpert: isMortgageExpertBroker({
        mortgageExpertEnabled: broker.mortgageExpertEnabled,
        profileBadge: brokerSubscriptionHasProfileBadge(broker.subscription),
      }),
      stats: {
        totalReviews: broker._count.reviews,
        totalLeads: broker.totalLeads,
        profileViews: broker.profileViews,
        avgRating: broker.avgRating,
        experienceYears: broker.experienceYears
      }
    }

    // Increment profile views (only for public access, not by owner)
    if (!isOwner) {
      await prisma.broker.update({
        where: { id: broker.id },
        data: { profileViews: { increment: 1 } }
      })
    }

    return NextResponse.json(responseData)
  } catch (error: any) {
    console.error('GET /api/brokers/[slug] error:', error)
    return NextResponse.json(
      { message: 'Failed to fetch broker', error: error.message },
      { status: 500 }
    )
  }
}


export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    const brokerId = (await params).id

    if (!currentUser) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user owns this broker profile or is admin
    const broker = await prisma.broker.findUnique({
      where: { id: brokerId }
    })

    if (!broker) {
      return NextResponse.json(
        { message: 'Broker not found' },
        { status: 404 }
      )
    }

    if (broker.userId !== currentUser.id && !currentUser.isAdmin) {
      return NextResponse.json(
        { message: 'Unauthorized to update this broker profile' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Strict allowlist: only broker-editable fields (plus admin-managed fields
    // for admins). Ownership (userId), status, metrics, verification documents,
    // and system-managed fields are never accepted from client input.
    const updateData: any = pickBrokerEditableFields(body, currentUser.isAdmin)

    // Admin-only derived handling for verification and featured status
    if (currentUser.isAdmin) {
      if (updateData.verificationStatus === 'VERIFIED') updateData.verifiedAt = new Date()
      if (updateData.brokerStatus === 'FEATURED') updateData.featuredRank = Math.floor(Math.random() * 100) + 1
    }

    const updatedBroker = await prisma.broker.update({
      where: { id: brokerId },
      data: updateData,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            image: true
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Broker profile updated successfully',
      broker: updatedBroker
    })
  } catch (error) {
    console.error('PATCH /api/brokers/[id] error:', error)
    return NextResponse.json(
      { message: 'Failed to update broker profile', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    const { id: brokerId } = await params

    if (!currentUser) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user owns this broker profile or is admin
    const broker = await prisma.broker.findUnique({
      where: { id: brokerId }
    })

    if (!broker) {
      return NextResponse.json(
        { message: 'Broker not found' },
        { status: 404 }
      )
    }

    if (broker.userId !== currentUser.id && !currentUser.isAdmin) {
      return NextResponse.json(
        { message: 'Unauthorized to delete this broker profile' },
        { status: 403 }
      )
    }

    // Soft delete: update user role back to BORROWER and deactivate broker profile
    await prisma.$transaction([
      ...(broker.userId ? [prisma.user.update({
        where: { id: broker.userId },
        data: { role: 'USER' }
      })] : []),
      prisma.broker.update({
        where: { id: brokerId },
        data: {
          verificationStatus: 'UNVERIFIED',
          // featuredListing: false
        }
      })
    ])

    return NextResponse.json({
      message: 'Broker profile deactivated successfully'
    })
  } catch (error) {
    console.error('DELETE /api/brokers/[id] error:', error)
    return NextResponse.json(
      { message: 'Failed to delete broker profile', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
