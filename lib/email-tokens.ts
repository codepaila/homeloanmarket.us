// lib/email-tokens.ts
//
// Email-safe design tokens for the HomeLoanMarket transactional email system.
//
// Email clients cannot reliably read CSS variables, so every value used inside
// email HTML is an explicit static constant here. The values are derived from
// the authoritative website design tokens in app/globals.css (light theme):
//   --primary: #000000, --background: #FFFFFF, --border: #E0E0E0,
//   --muted-foreground: #666666, --success: #15803D, --warning: #B45309,
//   --destructive: #CC0000.
// Semantic status colors stay semantic (green/amber/red); only primary brand
// elements (CTA, links, headings) use the black brand.

export const emailTokens = {
  // Brand
  brand: '#000000',
  brandDark: '#000000',

  // Primary / CTA
  primary: '#000000',
  primaryText: '#FFFFFF',

  // Surfaces
  background: '#FFFFFF',
  surface: '#FFFFFF',

  // Text
  foreground: '#000000',
  text: '#111827',
  muted: '#666666',

  // Borders
  border: '#E0E0E0',

  // Semantic status
  success: '#15803D',
  successBackground: '#F0FDF4',
  warning: '#B45309',
  warningBackground: '#FFFBEB',
  destructive: '#CC0000',
  destructiveBackground: '#FEF2F2',

  // Links
  link: '#000000',

  // CTA
  cta: '#000000',
  ctaText: '#FFFFFF',

  // Typography
  fontFamily: "Arial, Helvetica, sans-serif",
} as const