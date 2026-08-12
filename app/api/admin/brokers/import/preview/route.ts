import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { parseBrokerWorkbook } from '@/lib/admin/broker-import'
import { annotateBrokerImportRows } from '@/lib/admin/broker-data'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ message: 'CSV, XLS, or XLSX file is required' }, { status: 400 })
    const mapping = form.get('mapping') ? JSON.parse(String(form.get('mapping'))) : undefined
    const parsed = parseBrokerWorkbook(Buffer.from(await file.arrayBuffer()), file.name, {
      mapping,
      sheetName: typeof form.get('sheetName') === 'string' ? String(form.get('sheetName')) : undefined,
      defaultCity: String(form.get('defaultCity') || ''),
      defaultDescription: String(form.get('defaultDescription') || ''),
    })
    const rows = await annotateBrokerImportRows(parsed.rows)
    return NextResponse.json({ success: true, sheetName: parsed.sheetName, sheetNames: parsed.sheetNames, mapping: parsed.mapping, rows, summary: { total: rows.length, invalid: rows.filter((row) => row.status === 'INVALID').length, duplicates: rows.filter((row) => row.status === 'DUPLICATE_IN_FILE').length, existing: rows.filter((row) => row.status === 'EXISTING').length, new: rows.filter((row) => row.status === 'NEW').length } })
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Unable to preview import' }, { status: 422 })
  }
}
