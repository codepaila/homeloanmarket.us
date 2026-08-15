/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/brokers/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { SubscriptionService } from '@/lib/subscription'
import { getCurrentUser } from '@/lib/currentUser'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    if (currentUser.role !== 'BROKER') {
      return NextResponse.json(
        { message: 'Only brokers can access this endpoint' },
        { status: 403 }
      )
    }

    const broker = await prisma.broker.findFirst({
      where: { userId: currentUser.id },
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
            isActive: true,
            startDate: true,
            endDate: true
          }
        },
        bankPartners: {
          select: {
            id: true,
            bankName: true,
            bankType: true,
            since: true
          }
        },
        reviews: {
          select: {
            rating: true,
            comment: true,
            createdAt: true
          }
        }
      }
    })

    if (!broker) {
      return NextResponse.json(
        { message: 'Broker profile not found' },
        { status: 404 }
      )
    }

    const effectiveSubscription = SubscriptionService.effectiveSubscription(broker.subscription)
    return NextResponse.json({
      broker,
      hasActiveSubscription: effectiveSubscription.isActive,
      subscriptionPlan: effectiveSubscription.plan
    })
  } catch (error) {
    console.error('GET /api/brokers/me error:', error)
    return NextResponse.json(
      { message: 'Failed to fetch broker profile', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    if (currentUser.role !== 'BROKER') {
      return NextResponse.json(
        { message: 'Only brokers can update their profile' },
        { status: 403 }
      )
    }

    const broker = await prisma.broker.findFirst({
      where: { userId: currentUser.id },
      include: {
        subscription: true
      }
    })

    if (!broker) {
      return NextResponse.json(
        { message: 'Broker profile not found' },
        { status: 404 }
      )
    }

    const body = await request.json()

    const effectiveSubscription = SubscriptionService.effectiveSubscription(broker.subscription)

    // Fields that can be updated by broker
    const updateData: any = {}
    
    // Basic info
    if (body.displayName !== undefined) updateData.displayName = body.displayName
    if (body.companyName !== undefined) updateData.companyName = body.companyName
    if (body.description !== undefined) updateData.description = body.description
    if (body.profileSlug !== undefined) {
      // Check if slug is already taken by another broker
      const existingSlug = await prisma.broker.findFirst({
        where: {
          profileSlug: body.profileSlug,
          id: { not: broker.id }
        }
      })
      
      if (existingSlug) {
        return NextResponse.json(
          { message: 'Profile slug is already taken. Please choose another.' },
          { status: 400 }
        )
      }
      updateData.profileSlug = body.profileSlug
    }
    
    // Contact info
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.whatsapp !== undefined) updateData.whatsapp = body.whatsapp
    if (body.email !== undefined) updateData.email = body.email
    if (body.website !== undefined) updateData.website = body.website
    
    // Address
    if (body.officeAddress !== undefined) updateData.officeAddress = body.officeAddress
    if (body.city !== undefined) updateData.city = body.city
    if (body.state !== undefined) updateData.state = body.state
    if (body.pinCode !== undefined) updateData.pinCode = body.pinCode
    
    // Professional info
    if (body.experienceYears !== undefined) updateData.experienceYears = body.experienceYears

    // Additional info
    if (body.registrationNumber !== undefined) updateData.registrationNumber = body.registrationNumber
    if (body.panNumber !== undefined) updateData.panNumber = body.panNumber
    
    // Images
    if (body.logo !== undefined) updateData.logo = body.logo
    if (body.coverImage !== undefined) updateData.coverImage = body.coverImage
    
    // Settings
    if (body.isVisible !== undefined) updateData.isVisible = body.isVisible
    
    // Bank partnerships (handle separately through BrokerBank model)
    if (body.bankPartnerships !== undefined) {
      // Delete existing bank partnerships
      await prisma.brokerBank.deleteMany({
        where: { brokerId: broker.id }
      })
      
      // Create new bank partnerships
      if (Array.isArray(body.bankPartnerships) && body.bankPartnerships.length > 0) {
        const bankPartners = body.bankPartnerships.map((bankName: string) => ({
          brokerId: broker.id,
          bankName,
          bankType: 'PRIVATE' // Default, could be improved
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
            bankName: true,
            bankType: true
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Broker profile updated successfully',
      broker: updatedBroker,
      hasActiveSubscription: effectiveSubscription.isActive,
      subscriptionPlan: effectiveSubscription.plan
    })
  } catch (error) {
    console.error('PATCH /api/brokers/me error:', error)
    return NextResponse.json(
      { message: 'Failed to update broker profile', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
