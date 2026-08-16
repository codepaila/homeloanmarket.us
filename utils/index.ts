
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const USER_PER_PAGE = 3
export const JOB_PER_PAGE = 3
export const CATEGORY_PER_PAGE = 3
export const TABLE_ROW_PAGE = 20
export const POST_PER_PAGE = 9
export const ATTRIBUTE_PER_PAGE = 10

export const INVOICE_PER_PAGE = 3
export const PAGES_TO_SHOW = 2

export const PAGE_SIZE = 20


