import crypto from 'crypto'

export const generateVerificationToken = () => {
   return crypto.randomBytes(32).toString("base64url")
}

export const generateClaimToken = () => crypto.randomBytes(32).toString('base64url')

export const hashClaimToken = (token: string) =>
   crypto.createHash('sha256').update(token).digest('hex')
