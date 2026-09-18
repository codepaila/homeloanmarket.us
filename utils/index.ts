
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const USER_PER_PAGE = 3
export const JOB_PER_PAGE = 3
export const CATEGORY_PER_PAGE = 3
export const TABLE_ROW_PAGE = 15
export const POST_PER_PAGE = 9
export const ATTRIBUTE_PER_PAGE = 10

export const INVOICE_PER_PAGE = 3
export const PAGES_TO_SHOW = 2

export const PAGE_SIZE = 15

/**
 * Parses an untrusted query-string pagination value into a bounded positive
 * integer. Returns `fallback` for missing, non-numeric, non-integer, zero,
 * negative, or non-finite input (`NaN`/`Infinity`). Callers cap the upper bound
 * (e.g. `Math.min(parseBoundedPositiveInt(limit, 20), 100)`) so a user cannot
 * request an unbounded page size or a negative `skip`.
 */
export function parseBoundedPositiveInt(raw: string | null | undefined, fallback: number): number {
  if (raw === null || raw === undefined || raw.trim() === "") return fallback
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 ? value : fallback
}


