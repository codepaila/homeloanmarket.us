import crypto from 'crypto'

export function getCorrelationId(request: Request) {
  const supplied = request.headers.get('x-correlation-id')?.trim()
  return supplied && supplied.length <= 128 ? supplied : crypto.randomUUID()
}
