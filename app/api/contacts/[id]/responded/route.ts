// app/api/contacts/[id]/responded/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    const { notes } = await request.json()
    
    if (!user || !user.brokerProfile) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: messageId } = await params

    // Verify the broker owns this message
    const message = await prisma.contactMessage.findFirst({
      where: {
        id: messageId,
        brokerId: user.brokerProfile.id
      }
    })

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      )
    }

    // Update message
    const updatedMessage = await prisma.contactMessage.update({
      where: { id: messageId },
      data: {
        isResponded: true,
        respondedAt: new Date(),
        responseNotes: notes || undefined
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Marked as responded',
      data: updatedMessage
    })
  } catch (error) {
    console.error('Error marking message as responded:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update message' },
      { status: 500 }
    )
  }
}