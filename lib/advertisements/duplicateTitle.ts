// Canonical duplicate-title convention, shared by the server (repository
// title generation) and the client (DuplicateDialog prefill). Pure and
// dependency-free so both environments can import it safely.

/** Matches a trailing "(Copy)", "(Copy 2)", … suffix. */
export const COPY_SUFFIX_PATTERN = /\s+\(Copy(?:\s+\d+)?\)$/i

/**
 * Strips an existing copy suffix so duplicating "X (Copy)" yields
 * "X (Copy 2)" rather than "X (Copy) (Copy)".
 */
export function stripCopySuffix(title: string): string {
  return title.replace(COPY_SUFFIX_PATTERN, '').trim()
}

/**
 * Builds the Nth candidate title for a duplicated advertisement:
 * n = 1 → "Stem (Copy)", n = 2 → "Stem (Copy 2)", …
 */
export function buildCopyTitle(stem: string, n: number): string {
  const base = stem.trim()
  return n <= 1 ? `${base} (Copy)` : `${base} (Copy ${n})`
}
