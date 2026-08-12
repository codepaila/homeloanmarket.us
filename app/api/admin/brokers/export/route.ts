import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { brokerWhereFromParams, exportBrokers } from '@/lib/admin/broker-data'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const params = request.nextUrl.searchParams
  const format = params.get('format') === 'xlsx' ? 'xlsx' : 'csv'
  const where = brokerWhereFromParams({ search: params.get('search') || undefined, ownership: params.get('ownership') || undefined, verificationStatus: params.get('verificationStatus') || undefined, brokerStatus: params.get('brokerStatus') || undefined, state: params.get('state') || undefined, city: params.get('city') || undefined }) as Prisma.BrokerWhereInput
  const brokers = await prisma.broker.findMany({ where, orderBy: { createdAt: 'desc' }, include: { subscription: true } })
  const rows = brokers.map((broker) => ({
    ID: broker.id,
    NMLS: broker.nmls || '',
    Name: broker.displayName,
    Email: broker.email || '',
    Phone: broker.phone,
    Company: broker.companyName || '',
    Description: broker.description,
    Address: broker.officeAddress,
    City: broker.city,
    State: broker.state,
    'Zip code': broker.pinCode,
    Website: broker.website || '',
    'Experience years': broker.experienceYears,
    Specializations: broker.specializations.join(', '),
    'Service cities': broker.serviceCities.join(', '),
    Languages: broker.languages.join(', '),
    'Registration number': broker.registrationNumber || '',
    'PAN / tax number': broker.panNumber || '',
    'Verification status': broker.verificationStatus,
    'Broker status': broker.brokerStatus,
    'Is visible': broker.isVisible,
    Plan: broker.subscription?.plan || 'FREE',
    'Created date': broker.createdAt.toISOString(),
    'Updated date': broker.updatedAt.toISOString(),
  }))
  const body = exportBrokers(rows, format)
  return new NextResponse(new Uint8Array(body), { headers: { 'Content-Type': format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="brokers.${format}"` } })
}
