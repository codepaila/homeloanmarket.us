/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/brokers/[slug]/route.ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { hasPaidEntitlement, isBrokerOwner, isMortgageExpertBroker, isPublicBroker, pickBrokerEditableFields } from '@/lib/broker-policy'
import { brokerSubscriptionHasProfileBadge } from '@/lib/broker-plans'
import { toPublicBrokerRecord } from '@/lib/public-broker'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    const slug = (await params).slug

    const broker = await prisma.broker.findUnique({
      where: { profileSlug: slug },
      include: {
        user: {
          select: {
            name: true,
            image: true,
            isActive: true,
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

    if (currentUser?.role !== 'ADMIN' && !isPublicBroker({
      isVisible: broker.isVisible,
      verificationStatus: broker.verificationStatus,
      brokerStatus: broker.brokerStatus,
      creationSource: broker.creationSource,
      userId: broker.userId,
      userIsActive: broker.user?.isActive,
    })) {
      return NextResponse.json(
        { message: 'Broker profile not available' },
        { status: 404 }
      )
    }



    // Calculate response time and features based on subscription. Subscription
    // only drives the FEATURED presentation (badge + response time); it does
    // NOT gate contact/email visibility.
    let averageResponseTime = 'Within 24 hours'
    let isFeatured = false

    if (hasPaidEntitlement(broker.subscription)) {
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

    // Contact details (phone/email) are public for every eligible broker,
    // regardless of subscription or ownership.
    const responseData = {
      ...toPublicBrokerRecord(broker, { includeContact: true }),
      averageResponseTime,
      canShowContact: true,
      isFeatured,
      isMortgageExpert: isMortgageExpertBroker({
        mortgageExpertEnabled: broker.mortgageExpertEnabled,
        profileBadge: brokerSubscriptionHasProfileBadge(broker.subscription),
      }),
      isOwner,
      hasOwner: Boolean(broker.userId),
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
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    const slug = (await params).slug

    if (!currentUser) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if broker exists
    const broker = await prisma.broker.findUnique({
      where: { profileSlug: slug },
      include: {
        subscription: true
      }
    })

    if (!broker) {
      return NextResponse.json(
        { message: 'Broker not found' },
        { status: 404 }
      )
    }

    // Check permissions: user must own the profile or be admin
    if (broker.userId !== currentUser.id && currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'Unauthorized to update this broker profile' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Strict allowlist: only broker-editable fields (plus admin-managed fields
    // for admins). Ownership (userId), metrics (avgRating/totalLeads/
    // profileViews), status, and system-managed fields are never accepted from
    // client input.
    const updateData: any = pickBrokerEditableFields(body, currentUser.role === 'ADMIN')

    // Admin-only derived handling for verification and featured status
    if (currentUser.role === 'ADMIN') {
      if (updateData.verificationStatus === 'VERIFIED') updateData.verifiedAt = new Date()
      if (updateData.brokerStatus === 'FEATURED') updateData.featuredRank = Math.floor(Math.random() * 100) + 1
    }

    // profileSlug is SERVER-GENERATED and IMMUTABLE after creation. It is not
    // part of BROKER_EDITABLE_FIELDS (see lib/broker-policy.ts), so a
    // client-supplied value is dropped by pickBrokerEditableFields above and a
    // tampered payload can never overwrite the canonical slug here.

    // Handle bank partnerships separately (if provided)
    if (body.bankPartnerships && Array.isArray(body.bankPartnerships)) {
      // Delete existing bank partnerships
      await prisma.brokerBank.deleteMany({
        where: { brokerId: broker.id }
      })

      // Create new bank partnerships
      if (body.bankPartnerships.length > 0) {
        const bankPartners = body.bankPartnerships.map((bankName: string) => ({
          brokerId: broker.id,
          bankName,
          bankType: 'PRIVATE' // Default, can be customized
        }))
        
        await prisma.brokerBank.createMany({
          data: bankPartners
        })
      }
    }

    const updatedBroker = await prisma.broker.update({
      where: { id: broker.id },
      data: updateData,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            image: true
          }
        },
        subscription: {
          select: {
            plan: true,
            isActive: true
          }
        },
        bankPartners: {
          select: {
            id: true,
            bankName: true,
            bankType: true
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Broker profile updated successfully',
      broker: updatedBroker,
      hasActiveSubscription: broker.subscription?.isActive || false
    })
  } catch (error: any) {
    console.error('PATCH /api/brokers/[slug] error:', error)
    return NextResponse.json(
      { message: 'Failed to update broker profile', error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    const slug = (await params).slug

    if (!currentUser) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if broker exists
    const broker = await prisma.broker.findUnique({
      where: { profileSlug: slug }
    })

    if (!broker) {
      return NextResponse.json(
        { message: 'Broker not found' },
        { status: 404 }
      )
    }

    // Check permissions: user must own the profile or be admin
    if (broker.userId !== currentUser.id && currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'Unauthorized to delete this broker profile' },
        { status: 403 }
      )
    }

    // Handle deletion based on user role
    if (currentUser.role === 'ADMIN') {
      // Admin can suspend broker and downgrade user
      await prisma.$transaction([
        ...(broker.userId ? [prisma.user.update({
          where: { id: broker.userId },
          data: { role: 'USER' }
        })] : []),
        prisma.broker.update({
          where: { id: broker.id },
          data: {
            isVisible: false,
            brokerStatus: 'SUSPENDED',
            verificationStatus: 'UNVERIFIED'
          }
        })
      ])

      return NextResponse.json({
        message: 'Broker profile suspended successfully'
      })
    } else {
      // Broker can only hide their profile
      await prisma.broker.update({
        where: { id: broker.id },
        data: { 
          isVisible: false 
        }
      })

      return NextResponse.json({
        message: 'Your broker profile has been hidden from public view',
        note: 'You can make it visible again anytime from your profile settings'
      })
    }
  } catch (error: any) {
    console.error('DELETE /api/brokers/[slug] error:', error)
    return NextResponse.json(
      { message: 'Failed to delete broker profile', error: error.message },
      { status: 500 }
    )
  }
}
