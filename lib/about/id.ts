// lib/about/id.ts
// Helper functions for handling for About CMS temporary vs persisted IDs

/**
 * Checks if a string is a valid MongoDB ObjectId (24 hex characters)
 * @param id - String to check
 * @returns true if the string is a valid MongoDB ObjectId
 */
export function isMongoId(id: string): boolean {
  return /^[0-9a-f]{24}$/.test(id);
}

/**
 * Checks if an ID is a temporary client-generated ID for About CMS
 * Temporary IDs follow the pattern: {prefix}-new-{timestamp}-{random}
 * @param id - String to check
 * @returns true if the string is a temporary client ID
 */
export function isTempId(id: string): boolean {
  return /^(stat|benefit)-new-\d+-[a-z0-9]+$/.test(id);
}