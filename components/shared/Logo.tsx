import Image from 'next/image'
import { cn } from '@/lib/utils'

// Canonical Home Loan Market logo assets. The light and dark variants are the
// two shipped image files; do not regenerate, recolor, or crop them.
export const LOGO_LIGHT_SRC = '/assets/logo.png'
export const LOGO_DARK_SRC = '/assets/logo_dark.png'

// Intrinsic dimensions of the shipped assets (1522x164 / 1524x164). Used so
// next/image knows the true aspect ratio and generates a correct srcset.
const LOGO_INTRINSIC_WIDTH = 1522
const LOGO_INTRINSIC_HEIGHT = 164

export interface LogoProps {
  className?: string
  /** Eagerly preload + high fetch priority (e.g. an above-the-fold header). */
  priority?: boolean
  alt?: string
  /** Optional custom logo (e.g. settings.siteLogo). Rendered as-is in both
   *  modes because no dark variant exists for a custom asset. */
  src?: string | null
  width?: number
  height?: number
  /** Width hint for the responsive srcset. Defaults to a typical logo display
   *  width so the browser never downloads the full 1522px intrinsic image. */
  sizes?: string
}

/**
 * Single canonical brand mark. In the default (no `src`) case it renders BOTH
 * shipped assets and toggles them with the existing `.dark` class via CSS —
 * no JS, no theme hook, no hydration mismatch, and no light-logo flash on a
 * dark-mode first paint. Consumers control the rendered size with `className`
 * (e.g. `h-12 max-w-52`); the component always preserves the real aspect ratio.
 */
export function Logo({
  className,
  priority = false,
  alt = 'HomeLoanMarket',
  src = null,
  width = LOGO_INTRINSIC_WIDTH,
  height = LOGO_INTRINSIC_HEIGHT,
  sizes = '224px',
}: LogoProps) {
  // A custom site logo has no dark variant — render it directly in both modes.
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        loading="eager"
        className={cn('object-contain', className)}
      />
    )
  }

  return (
    <>
      <Image
        src={LOGO_LIGHT_SRC}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        loading="eager"
        className={cn('object-contain dark:hidden', className)}
      />
      <Image
        src={LOGO_DARK_SRC}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        loading="eager"
        className={cn('hidden object-contain dark:block', className)}
      />
    </>
  )
}

export default Logo