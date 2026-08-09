
export const fetcher = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    throw error
  }
  
  return res.json()
}

// For SWR hooks
export const swrFetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  
  if (!res.ok) {
    const error = new Error(data.message || 'Failed to fetch')
    throw error
  }
  
  return data
}