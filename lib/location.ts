import countriesStatesCities from 'countries-states-cities'

export type USState = { code: string; name: string }

type USStateEntry = { id: number; code: string; name: string }

let statesByCode: Map<string, USStateEntry> | null = null

function getUSCountryId(): number {
  const us = countriesStatesCities
    .getAllCountries()
    .find((country) => country.iso2 === 'US' || country.name === 'United States')
  if (!us) throw new Error('US location data is unavailable')
  return us.id
}

function buildStates(): Map<string, USStateEntry> {
  if (statesByCode) return statesByCode
  const map = new Map<string, USStateEntry>()
  const usCountryId = getUSCountryId()
  for (const state of countriesStatesCities.getStatesOfCountry(usCountryId)) {
    if (countriesStatesCities.getCitiesOfState(state.id).length === 0) continue
    map.set(state.state_code, { id: state.id, code: state.state_code, name: state.name })
  }
  statesByCode = map
  return map
}

/** All US states (and populated US territories) with their two-letter codes, sorted by name. */
export function getUSStates(): USState[] {
  return [...buildStates().values()]
    .map((state) => ({ code: state.code, name: state.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Resolve a two-letter US state code from a full state name. */
export function getUSStateCode(stateName: string): string | null {
  const name = stateName.trim().toLowerCase()
  const match = [...buildStates().values()].find(
    (state) => state.name.toLowerCase() === name || state.code.toLowerCase() === name,
  )
  return match ? match.code : null
}

/** Resolve a full US state name from a two-letter code. */
export function getUSStateName(stateCode: string): string | null {
  return buildStates().get(stateCode)?.name ?? null
}

/**
 * US city names. Pass a two-letter state code to narrow to a single state.
 * The data comes from the canonical `countries-states-cities` library already
 * used across the platform (e.g. broker contact forms).
 */
export function getUSCities(stateCode?: string): string[] {
  if (!stateCode) {
    const all: string[] = []
    const seen = new Set<string>()
    for (const state of buildStates().values()) {
      for (const city of countriesStatesCities.getCitiesOfState(state.id)) {
        if (!seen.has(city.name)) {
          seen.add(city.name)
          all.push(city.name)
        }
      }
    }
    return all.sort((a, b) => a.localeCompare(b))
  }
  const state = buildStates().get(stateCode)
  if (!state) return []
  return countriesStatesCities
    .getCitiesOfState(state.id)
    .map((city) => city.name)
    .sort((a, b) => a.localeCompare(b))
}
