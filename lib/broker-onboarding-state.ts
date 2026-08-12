export function isBrokerSetupComplete<T extends { brokerProfile?: unknown | null }>(
  user: T,
): user is T & { brokerProfile: NonNullable<T['brokerProfile']> } {
  return Boolean(user.brokerProfile)
}
