/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/user/profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { sendEmailChangeVerificationEmail } from '@/actions/email.action'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        brokerProfile: {
          select: {
            id: true,
            displayName: true,
            companyName: true,
            verificationStatus: true,
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error : any) {
    console.error('GET /api/user/profile error:', error)
    return NextResponse.json(
      { message: 'Failed to fetch user profile', error: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const updateData: any = {}

    // Basic info updates
    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) {
      const currentUserRecord = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: { email: true },
      })
      const newEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const sameEmail = newEmail && currentUserRecord?.email?.toLowerCase() === newEmail

      if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return NextResponse.json(
          { message: 'Please enter a valid email address' },
          { status: 400 }
        )
      }

      if (!sameEmail) {
        // Check if email is already taken by another user
        const existingEmail = await prisma.user.findFirst({
          where: {
            email: newEmail,
            id: { not: currentUser.id }
          }
        })

        if (existingEmail) {
          return NextResponse.json(
            { message: 'Email is already taken' },
            { status: 400 }
          )
        }

        // Email change requires verification of the NEW address. The current
        // email remains authoritative until the new one is verified via
        // /api/auth/verify-email. User.email is NOT mutated here.
        const sendResult = await sendEmailChangeVerificationEmail(currentUser.id, newEmail)
        if (!sendResult.success) {
          return NextResponse.json(
            { message: sendResult.error || 'Failed to send verification email' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          message: 'A verification email has been sent to your new address. Please verify it to complete the change.',
          emailChangePending: true,
        })
      }
    }
    if (body.phone !== undefined) {
      // Check if phone is already taken by another user
      const existingPhone = await prisma.user.findFirst({
        where: {
          phone: body.phone,
          id: { not: currentUser.id }
        }
      })
      
      if (existingPhone) {
        return NextResponse.json(
          { message: 'Phone number is already taken' },
          { status: 400 }
        )
      }
      updateData.phone = body.phone
    }
    if (body.image !== undefined) updateData.image = body.image

    // Password change
    if (body.currentPassword && body.newPassword) {
      // Verify current password
      const user = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: { password: true }
      })

      if (!user?.password) {
        return NextResponse.json(
          { message: 'Password change not allowed for this account type' },
          { status: 400 }
        )
      }

      const isValidPassword = await bcrypt.compare(
        body.currentPassword,
        user.password
      )

      if (!isValidPassword) {
        return NextResponse.json(
          { message: 'Current password is incorrect' },
          { status: 401 }
        )
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(body.newPassword, 12)
      updateData.password = hashedPassword
    }

    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        role: true,
        emailVerified: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: updatedUser
    })
  } catch (error : any) {
    console.error('PATCH /api/user/profile error:', error)
    return NextResponse.json(
      { message: 'Failed to update profile', error: error.message },
      { status: 500 }
    )
  }
}