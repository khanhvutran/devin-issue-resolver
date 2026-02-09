import { useSearchParams, Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import createClient from 'openapi-fetch'
import type { paths, components } from '../api-schema'

const client = createClient<paths>()

type AnalysisResult = components['schemas']['AnalysisResult']
type FixStatusResult = components['schemas']['FixStatusResult']

function getConfidenceColor(score: number): string {
  if (score >= 8) return '#238636'
  if (score >= 5) return '#d29922'
  return '#d93025'
}

function InlineSpinner() {
  return (
    <div
      style={{
        display: 'inline-block',
        width: '14px',
        height: '14px',
        border: '2px solid #555',
        borderTopColor: '#646cff',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        verticalAlign: 'middle',
      }}
    />
  )
}

function FixBadge({ githubUrl, issueId }: { githubUrl: string; issueId: number }) {
  const { data: fixStatus } = useQuery<FixStatusResult | null>({
    queryKey: ['devin-fix', githubUrl, issueId],
    queryFn: async () => {
      const { data, error, response } = await client.GET('/api/devin/fix-status', {
        params: { query: { github_url: githubUrl, issue_id: issueId } },
      })
      if (response.status === 404) return null
      if (error) throw new Error(JSON.stringify(error))
      return data
    },
    refetchInterval: (query) => {
      const status = query.state.data?.fix_status
      if (status === 'pending' || status === 'analyzing') return 5000
      return false
    },
  })

  if (!fixStatus) return null

  if (fixStatus.fix_status === 'pending' || fixStatus.fix_status === 'analyzing') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#888' }}>
        <InlineSpinner /> Fixing...
      </span>
    )
  }

  if (fixStatus.fix_status === 'completed' && fixStatus.pr_url) {
    return (
      <a
        href={fixStatus.pr_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          fontSize: '0.75rem',
          padding: '2px 8px',
          borderRadius: '12px',
          fontWeight: 600,
          background: '#8957e5',
          color: '#fff',
          textDecoration: 'none',
        }}
      >
        PR
      </a>
    )
  }

  if (fixStatus.fix_status === 'failed') {
    return (
      <span
        style={{
          fontSize: '0.75rem',
          padding: '2px 8px',
          borderRadius: '12px',
          fontWeight: 600,
          background: '#d93025',
          color: '#fff',
        }}
      >
        Fix failed
      </span>
    )
  }

  return null
}

function AnalysisBadge({ githubUrl, issueId }: { githubUrl: string; issueId: number }) {
  const { data: analysis } = useQuery<AnalysisResult | null>({
    queryKey: ['devin-analysis', githubUrl, issueId],
    queryFn: async () => {
      const { data, error, response } = await client.GET('/api/devin/analysis', {
        params: { query: { github_url: githubUrl, issue_id: issueId } },
      })
      if (response.status === 404) return null
      if (error) throw new Error(JSON.stringify(error))
      return data
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'pending' || status === 'analyzing') return 5000
      return false
    },
  })

  if (!analysis) return null

  if (analysis.status === 'pending' || analysis.status === 'analyzing') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#888' }}>
        <InlineSpinner /> Analyzing...
      </span>
    )
  }

  if (analysis.status === 'failed') {
    return (
      <span
        style={{
          fontSize: '0.75rem',
          padding: '2px 8px',
          borderRadius: '12px',
          fontWeight: 600,
          background: '#d93025',
          color: '#fff',
        }}
      >
        Failed
      </span>
    )
  }

  if (analysis.status === 'completed' && analysis.confidence_score != null) {
    return (
      <>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: 600,
            background: getConfidenceColor(analysis.confidence_score),
            color: '#fff',
          }}
        >
          Score: {analysis.confidence_score}/10
        </span>
        <FixBadge githubUrl={githubUrl} issueId={issueId} />
      </>
    )
  }

  if (analysis.status === 'completed') {
    return (
      <>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: 600,
            background: '#238636',
            color: '#fff',
          }}
        >
          Analyzed
        </span>
        <FixBadge githubUrl={githubUrl} issueId={issueId} />
      </>
    )
  }

  return null
}

function extractRepoName(url: string): string {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`
  } catch { /* ignore */ }
  return url
}

function formatDate(isoDate: string): string {
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

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
      <div
        style={{
          width: '36px',
          height: '36px',
          border: '3px solid #333',
          borderTopColor: '#646cff',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  )
}

function WarningBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '1rem 1.25rem',
        borderRadius: '8px',
        border: '1px solid #d29922',
        background: 'rgba(210, 153, 34, 0.1)',
        color: '#d29922',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>&#9888;</span>
      <span>{children}</span>
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '1rem 1.25rem',
        borderRadius: '8px',
        border: '1px solid #d93025',
        background: 'rgba(217, 48, 37, 0.1)',
        color: '#d93025',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>&#10007;</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0 }}>{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: '0.5rem',
              padding: '0.3rem 0.8rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '3rem 1rem',
        border: '1px dashed #444',
        borderRadius: '8px',
        color: '#888',
      }}
    >
      <p style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0' }}>No issues found</p>
      <p style={{ margin: 0 }}>This repository doesn't have any open issues.</p>
    </div>
  )
}

const GITHUB_URL_RE = /^https?:\/\/github\.com\/[^/]+\/[^/]+/

export function Issues() {
  const [searchParams] = useSearchParams()
  const githubUrl = searchParams.get('github_url') ?? ''
  const repoName = extractRepoName(githubUrl)
  const isValidUrl = GITHUB_URL_RE.test(githubUrl)

  const { data: issues, isLoading, error, refetch } = useQuery<components['schemas']['Issue'][]>({
    queryKey: ['issues', githubUrl],
    queryFn: async () => {
      const { data, error } = await client.GET('/api/issues', {
        params: { query: { github_url: githubUrl } },
      })
      if (error) throw new Error(JSON.stringify(error))
      return data
    },
    enabled: !!githubUrl && isValidUrl,
    retry: false,
  })

  if (!githubUrl) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <WarningBanner>No GitHub URL provided. Please go back and enter a repository URL.</WarningBanner>
        <Link to="/" style={{ display: 'inline-block', marginTop: '1rem' }}>&larr; Back to home</Link>
      </div>
    )
  }

  if (!isValidUrl) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <WarningBanner>
          "{githubUrl}" doesn't look like a valid GitHub URL. Please use a URL like https://github.com/owner/repo.
        </WarningBanner>
        <Link to="/" style={{ display: 'inline-block', marginTop: '1rem' }}>&larr; Back to home</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <div style={{ marginBottom: '2rem' }}>
        <Link to="/" style={{ fontSize: '0.9rem' }}>&larr; Back</Link>
        <h1 style={{ marginTop: '0.5rem' }}>{repoName}</h1>
      </div>

      {isLoading && <Spinner />}

      {error && (
        <ErrorBanner
          message={`Failed to load issues: ${error.message}`}
          onRetry={() => refetch()}
        />
      )}

      {issues && issues.length === 0 && <EmptyState />}

      {issues && issues.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {issues.map(issue => (
            <div
              key={issue.issue_id}
              style={{
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '1rem 1.25rem',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ color: '#888', fontWeight: 500 }}>#{issue.issue_id}</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 600,
                    background: issue.state === 'open' ? '#238636' : '#8957e5',
                    color: '#fff',
                  }}
                >
                  {issue.state}
                </span>
                <AnalysisBadge githubUrl={githubUrl} issueId={issue.issue_id} />
              </div>

              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{issue.issue_title}</h3>

              {issue.labels && issue.labels.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  {issue.labels.map(label => (
                    <span
                      key={label.name}
                      style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 500,
                        background: `#${label.color}`,
                        color: parseInt(label.color, 16) > 0x7fffff ? '#000' : '#fff',
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: '#888' }}>
                  {issue.author_avatar && (
                    <img
                      src={issue.author_avatar}
                      alt={issue.author}
                      style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                    />
                  )}
                  <span>{issue.author}</span>
                  <span>opened {formatDate(issue.created_at)}</span>
                  <span>{issue.comment_count} comment{issue.comment_count !== 1 ? 's' : ''}</span>
                </div>
                <Link
                  to={`/issue?github_url=${encodeURIComponent(githubUrl)}&issue_id=${issue.issue_id}`}
                  style={{
                    padding: '0.4rem 1rem',
                    fontSize: '0.85rem',
                    background: '#646cff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    textDecoration: 'none',
                  }}
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
