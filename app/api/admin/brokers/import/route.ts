import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { parseBrokerWorkbook } from '@/lib/admin/broker-import'
import { annotateBrokerImportRows, importBrokerRows } from '@/lib/admin/broker-data'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ message: 'CSV, XLS, or XLSX file is required' }, { status: 400 })
    const mapping = form.get('mapping') ? JSON.parse(String(form.get('mapping'))) : undefined
    const parsed = parseBrokerWorkbook(Buffer.from(await file.arrayBuffer()), file.name, { mapping, sheetName: String(form.get('sheetName') || ''), defaultCity: String(form.get('defaultCity') || ''), defaultDescription: String(form.get('defaultDescription') || '') })
    const rows = await annotateBrokerImportRows(parsed.rows)
    const requestedMode = String(form.get('mode') || 'CREATE_ONLY')
    const mode = requestedMode === 'UPDATE_ONLY' ? 'UPDATE_ONLY' : requestedMode === 'UPSERT' || requestedMode === 'CREATE_UPDATE' ? 'UPSERT' : 'CREATE_ONLY'
    const result = await importBrokerRows(rows, mode, parsed.defaultDescription)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Unable to import brokers' }, { status: 422 })
  }
}
