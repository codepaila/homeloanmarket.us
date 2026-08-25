/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/brokers/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { SubscriptionService } from '@/lib/subscription'
import { getCurrentUser } from '@/lib/currentUser'
import { validateLicenseStates, normalizeNmls, nmlsValidationError } from '@/lib/broker-licensing'
import { resolveUSPlace } from '@/lib/location/google-place'
import { requireValidResolvedUSLocation } from '@/lib/location/broker-location'
import { isSameOriginRequest } from '@/lib/origin'
import { Prisma } from '@prisma/client'

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
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ message: 'Invalid request origin' }, { status: 403 })
    }

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
    
    // Office location. The Google place selection is authoritative: when the
    // broker provides a place ID (from the location picker) the server
    // re-resolves the place and derives the canonical structured fields, so
    // the stored address always matches the stored coordinates. If the broker
    // edits the address text without a new place selection, the previously
    // resolved place/coordinates are cleared to avoid a mismatched combo.
    const locationInput = body.location && typeof body.location === 'object'
      ? (body.location as Record<string, unknown>)
      : null
    const placeId = typeof locationInput?.placeId === 'string'
      ? (locationInput.placeId as string).trim()
      : typeof body.placeId === 'string' ? (body.placeId as string).trim() : ''

    if (placeId) {
      try {
        const resolved = await resolveUSPlace(placeId)
        requireValidResolvedUSLocation(resolved)
        updateData.officeAddress = resolved.normalizedAddress
        updateData.city = resolved.city
        updateData.state = resolved.state
        updateData.pinCode = resolved.zip
        updateData.normalizedAddress = resolved.normalizedAddress
        updateData.googlePlaceId = resolved.placeId
        updateData.locationCountryCode = 'US'
        updateData.location = JSON.parse(JSON.stringify({
          type: 'Point',
          coordinates: [resolved.longitude, resolved.latitude],
        }))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Office location could not be validated'
        return NextResponse.json({ message }, { status: 400 })
      }
    } else {
      const addressChanged = ['officeAddress', 'city', 'state', 'pinCode', 'zipCode'].some(
        (field) => body[field] !== undefined
      )
      if (addressChanged) {
        updateData.googlePlaceId = null
        updateData.normalizedAddress = null
        updateData.location = Prisma.DbNull
        updateData.locationCountryCode = null
      }
    }

    // The canonical schema field is `pinCode`; legacy clients send `zipCode`.
    if (body.pinCode !== undefined) updateData.pinCode = body.pinCode
    else if (body.zipCode !== undefined) updateData.pinCode = body.zipCode
    
    // Professional info
    if (body.experienceYears !== undefined) updateData.experienceYears = body.experienceYears

    // US licensing
    if (body.nmls !== undefined) {
      const nmls = normalizeNmls(body.nmls)
      const nmlsError = nmlsValidationError(nmls)
      if (nmlsError) {
        return NextResponse.json(
          { message: nmlsError },
          { status: 422 },
        )
      }
      updateData.nmls = nmls
    }
    if (body.licenseStates !== undefined) {
      const statesResult = validateLicenseStates(body.licenseStates)
      if (!statesResult.ok) {
        return NextResponse.json({ message: statesResult.error }, { status: 422 })
      }
      updateData.licenseStates = statesResult.states
    }

    // Additional info
    if (body.registrationNumber !== undefined) updateData.registrationNumber = body.registrationNumber
    if (body.panNumber !== undefined) updateData.panNumber = body.panNumber
    
    // Images
    if (body.logo !== undefined) updateData.logo = body.logo
    if (body.coverImage !== undefined) updateData.coverImage = body.coverImage
    if (body.profileImage !== undefined) updateData.profileImage = body.profileImage
    
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
