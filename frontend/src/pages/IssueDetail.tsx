import { useSearchParams, Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import createClient from 'openapi-fetch'
import type { paths, components } from '../api-schema'

const client = createClient<paths>()

type Issue = components['schemas']['Issue']
type AnalysisResult = components['schemas']['AnalysisResult']
type FixStatusResult = components['schemas']['FixStatusResult']

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

function InlineSpinner() {
  return (
    <div
      style={{
        display: 'inline-block',
        width: '16px',
        height: '16px',
        border: '2px solid #555',
        borderTopColor: '#646cff',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        verticalAlign: 'middle',
        marginRight: '0.5rem',
      }}
    />
  )
}

function getConfidenceColor(score: number): string {
  if (score >= 8) return '#238636'
  if (score >= 5) return '#d29922'
  return '#d93025'
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

function DevinAnalysis({ githubUrl, issue }: { githubUrl: string; issue: Issue }) {
  const [triggered, setTriggered] = useState(false)
  const queryClient = useQueryClient()

  const analysisQuery = useQuery<AnalysisResult | null>({
    queryKey: ['devin-analysis', githubUrl, issue.issue_id],
    queryFn: async () => {
      const { data, error, response } = await client.GET('/api/devin/analysis', {
        params: { query: { github_url: githubUrl, issue_id: issue.issue_id } },
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

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await client.POST('/api/devin/analyze', {
        body: {
          github_url: githubUrl,
          issue_id: issue.issue_id,
          issue_title: issue.issue_title,
        },
      })
      if (error) throw new Error(JSON.stringify(error))
      return data
    },
    onSuccess: () => {
      setTriggered(true)
      queryClient.invalidateQueries({ queryKey: ['devin-analysis', githubUrl, issue.issue_id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await client.DELETE('/api/devin/analysis', {
        params: { query: { github_url: githubUrl, issue_id: issue.issue_id } },
      })
      if (error) throw new Error(JSON.stringify(error))
    },
    onSuccess: () => {
      setTriggered(false)
      queryClient.invalidateQueries({ queryKey: ['devin-analysis', githubUrl, issue.issue_id] })
      queryClient.invalidateQueries({ queryKey: ['devin-fix', githubUrl, issue.issue_id] })
    },
  })

  const analysis = analysisQuery.data
  const isActive = analysis?.status === 'pending' || analysis?.status === 'analyzing'

  if (!analysis && !triggered) {
    return (
      <div>
        <button
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          style={{
            padding: '0.5rem 1.25rem',
            fontSize: '0.9rem',
            cursor: analyzeMutation.isPending ? 'not-allowed' : 'pointer',
            background: '#646cff',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            opacity: analyzeMutation.isPending ? 0.7 : 1,
          }}
        >
          {analyzeMutation.isPending ? 'Starting...' : 'Analyze with Devin'}
        </button>
        {analyzeMutation.isError && (
          <p style={{ color: '#d93025', fontSize: '0.85rem', margin: '0.5rem 0 0 0' }}>
            Failed to start analysis. Please try again.
          </p>
        )}
      </div>
    )
  }

  if (isActive || (triggered && !analysis)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#888' }}>
        <InlineSpinner />
        <span>Devin is analyzing this issue...</span>
        {analysis?.devin_url && (
          <a
            href={analysis.devin_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#646cff', marginLeft: '0.5rem' }}
          >
            Watch live
          </a>
        )}
      </div>
    )
  }

  if (analysis?.status === 'failed') {
    return (
      <div>
        <span style={{ color: '#d93025', fontWeight: 600 }}>Analysis failed</span>
        {analysis.plan && (
          <p style={{ color: '#888', margin: '0.25rem 0 0.5rem 0', fontSize: '0.85rem' }}>
            {analysis.plan}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => {
              setTriggered(false)
              analyzeMutation.mutate()
            }}
            style={{
              padding: '0.4rem 1rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: 'transparent',
              color: '#646cff',
              border: '1px solid #646cff',
              borderRadius: '4px',
            }}
          >
            Retry
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            style={{
              padding: '0.4rem 1rem',
              fontSize: '0.85rem',
              cursor: deleteMutation.isPending ? 'not-allowed' : 'pointer',
              background: 'transparent',
              color: '#d93025',
              border: '1px solid #d93025',
              borderRadius: '4px',
              opacity: deleteMutation.isPending ? 0.7 : 1,
            }}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    )
  }

  if (analysis?.status === 'completed') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {analysis.confidence_score != null && (
            <span
              style={{
                fontSize: '0.8rem',
                padding: '3px 10px',
                borderRadius: '12px',
                fontWeight: 600,
                background: getConfidenceColor(analysis.confidence_score),
                color: '#fff',
              }}
            >
              Confidence: {analysis.confidence_score}/10
            </span>
          )}
          {analysis.devin_url && (
            <a
              href={analysis.devin_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.8rem', color: '#646cff' }}
            >
              View session
            </a>
          )}
          <button
            onClick={() => {
              setTriggered(false)
              analyzeMutation.mutate()
            }}
            disabled={analyzeMutation.isPending}
            style={{
              padding: '0.3rem 0.8rem',
              fontSize: '0.8rem',
              cursor: analyzeMutation.isPending ? 'not-allowed' : 'pointer',
              background: 'transparent',
              color: '#646cff',
              border: '1px solid #646cff',
              borderRadius: '4px',
              opacity: analyzeMutation.isPending ? 0.7 : 1,
            }}
          >
            {analyzeMutation.isPending ? 'Starting...' : 'Re-analyze'}
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            style={{
              padding: '0.3rem 0.8rem',
              fontSize: '0.8rem',
              cursor: deleteMutation.isPending ? 'not-allowed' : 'pointer',
              background: 'transparent',
              color: '#d93025',
              border: '1px solid #d93025',
              borderRadius: '4px',
              opacity: deleteMutation.isPending ? 0.7 : 1,
            }}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
        {analysis.plan && (
          <pre
            style={{
              background: '#1a1a2e',
              border: '1px solid #333',
              borderRadius: '6px',
              padding: '1rem',
              fontSize: '0.85rem',
              color: '#ccc',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}
          >
            {analysis.plan}
          </pre>
        )}
        {analysis.plan && (
          <FixWithDevin githubUrl={githubUrl} issue={issue} analysis={analysis} />
        )}
      </div>
    )
  }

  return null
}

function FixWithDevin({
  githubUrl,
  issue,
  analysis,
}: {
  githubUrl: string
  issue: Issue
  analysis: AnalysisResult
}) {
  const [triggered, setTriggered] = useState(false)
  const queryClient = useQueryClient()

  const fixStatusQuery = useQuery<FixStatusResult | null>({
    queryKey: ['devin-fix', githubUrl, issue.issue_id],
    queryFn: async () => {
      const { data, error, response } = await client.GET('/api/devin/fix-status', {
        params: { query: { github_url: githubUrl, issue_id: issue.issue_id } },
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

  const fixMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await client.POST('/api/devin/fix', {
        body: {
          github_url: githubUrl,
          issue_id: issue.issue_id,
          issue_title: issue.issue_title,
          plan: analysis.plan!,
        },
      })
      if (error) throw new Error(JSON.stringify(error))
      return data
    },
    onSuccess: () => {
      setTriggered(true)
      queryClient.invalidateQueries({ queryKey: ['devin-fix', githubUrl, issue.issue_id] })
    },
  })

  const fixStatus = fixStatusQuery.data
  const isActive = fixStatus?.fix_status === 'pending' || fixStatus?.fix_status === 'analyzing'

  // Not started
  if (!fixStatus && !triggered) {
    return (
      <div style={{ marginTop: '1rem' }}>
        <button
          onClick={() => fixMutation.mutate()}
          disabled={fixMutation.isPending}
          style={{
            padding: '0.5rem 1.25rem',
            fontSize: '0.9rem',
            cursor: fixMutation.isPending ? 'not-allowed' : 'pointer',
            background: '#238636',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            opacity: fixMutation.isPending ? 0.7 : 1,
          }}
        >
          {fixMutation.isPending ? 'Starting...' : 'Fix with Devin'}
        </button>
        {fixMutation.isError && (
          <p style={{ color: '#d93025', fontSize: '0.85rem', margin: '0.5rem 0 0 0' }}>
            Failed to start fix. Please try again.
          </p>
        )}
      </div>
    )
  }

  // In progress
  if (isActive || (triggered && !fixStatus)) {
    return (
      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#888' }}>
        <InlineSpinner />
        <span>Devin is implementing the fix...</span>
        {fixStatus?.fix_devin_url && (
          <a
            href={fixStatus.fix_devin_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#646cff', marginLeft: '0.5rem' }}
          >
            Watch live
          </a>
        )}
      </div>
    )
  }

  // Failed
  if (fixStatus?.fix_status === 'failed') {
    return (
      <div style={{ marginTop: '1rem' }}>
        <span style={{ color: '#d93025', fontWeight: 600 }}>Fix failed</span>
        <button
          onClick={() => {
            setTriggered(false)
            fixMutation.mutate()
          }}
          style={{
            marginLeft: '0.75rem',
            padding: '0.4rem 1rem',
            fontSize: '0.85rem',
            cursor: 'pointer',
            background: 'transparent',
            color: '#646cff',
            border: '1px solid #646cff',
            borderRadius: '4px',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  // Completed
  if (fixStatus?.fix_status === 'completed') {
    return (
      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {fixStatus.pr_url ? (
          <a
            href={fixStatus.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1.25rem',
              fontSize: '0.9rem',
              background: '#238636',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            View Pull Request
          </a>
        ) : (
          <span style={{ color: '#888', fontSize: '0.85rem' }}>Fix completed (no PR URL returned)</span>
        )}
        {fixStatus.fix_devin_url && (
          <a
            href={fixStatus.fix_devin_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.8rem', color: '#646cff' }}
          >
            View session
          </a>
        )}
        <button
          onClick={() => {
            setTriggered(false)
            fixMutation.mutate()
          }}
          disabled={fixMutation.isPending}
          style={{
            padding: '0.3rem 0.8rem',
            fontSize: '0.8rem',
            cursor: fixMutation.isPending ? 'not-allowed' : 'pointer',
            background: 'transparent',
            color: '#646cff',
            border: '1px solid #646cff',
            borderRadius: '4px',
            opacity: fixMutation.isPending ? 0.7 : 1,
          }}
        >
          {fixMutation.isPending ? 'Starting...' : 'Re-run fix'}
        </button>
      </div>
    )
  }

  return null
}

export function IssueDetail() {
  const [searchParams] = useSearchParams()
  const githubUrl = searchParams.get('github_url') ?? ''
  const issueId = Number(searchParams.get('issue_id'))

  const { data: issues, isLoading, error } = useQuery<Issue[]>({
    queryKey: ['issues', githubUrl],
    queryFn: async () => {
      const { data, error } = await client.GET('/api/issues', {
        params: { query: { github_url: githubUrl } },
      })
      if (error) throw new Error(JSON.stringify(error))
      return data
    },
    enabled: !!githubUrl,
  })

  const issue = issues?.find(i => i.issue_id === issueId)

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <Link
        to={`/issues?github_url=${encodeURIComponent(githubUrl)}`}
        style={{ fontSize: '0.9rem' }}
      >
        &larr; Back to issues
      </Link>

      {isLoading && <Spinner />}

      {error && (
        <p style={{ color: '#d93025', marginTop: '1rem' }}>
          Failed to load issue: {error.message}
        </p>
      )}

      {!isLoading && !error && !issue && (
        <p style={{ color: '#888', marginTop: '1rem' }}>Issue not found.</p>
      )}

      {issue && (
        <>
          {/* Header */}
          <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ color: '#888', fontWeight: 500, fontSize: '1.1rem' }}>#{issue.issue_id}</span>
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
            </div>
            <h1 style={{ margin: '0 0 0.75rem 0', fontSize: '1.5rem' }}>{issue.issue_title}</h1>
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
            {issue.labels && issue.labels.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.75rem' }}>
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
          </div>

          {/* Description */}
          {issue.body && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: '#ccc' }}>Description</h2>
              <pre
                style={{
                  background: '#1a1a2e',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  padding: '1rem',
                  fontSize: '0.85rem',
                  color: '#ccc',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                }}
              >
                {issue.body}
              </pre>
            </div>
          )}

          {/* Analysis */}
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: '#ccc' }}>Devin Analysis</h2>
            <DevinAnalysis githubUrl={githubUrl} issue={issue} />
          </div>
        </>
      )}
    </div>
  )
}
