export const GITHUB_URL_RE = /^https?:\/\/github\.com\/[^/]+\/[^/]+/

export function getConfidenceColor(score: number): string {
  if (score >= 8) return '#238636'
  if (score >= 5) return '#d29922'
  return '#d93025'
}

export function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return isoDate
  }
}

export function extractRepoName(url: string): string {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`
  } catch { /* ignore */ }
  return url
}

export function normalizeGithubUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) return `https://github.com/${parts[0]}/${parts[1]}`
  } catch { /* ignore */ }
  return url
}

export function extractApiError(error: unknown, fallback = 'An unexpected error occurred.'): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as Record<string, unknown>).error === 'string'
  ) {
    return (error as Record<string, unknown>).error as string
  }
  return fallback
}

const NETWORK_ERROR_MESSAGE = 'Unable to reach the server. Please check your connection and try again.'

export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && (
    err.message === 'Failed to fetch' ||
    err.message === 'NetworkError when attempting to fetch resource.' ||
    err.message.includes('fetch')
  )
}

export function getNetworkErrorMessage(): string {
  return NETWORK_ERROR_MESSAGE
}
