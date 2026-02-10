import { useSearchParams, Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Heading, Text, Button, Flash, Label, StateLabel,
  Avatar, Breadcrumbs,
  Link as PrimerLink,
} from '@primer/react'
import { ArrowLeftIcon, CommentIcon, GitPullRequestIcon } from '@primer/octicons-react'
import createClient from 'openapi-fetch'
import type { paths, components } from '../api-schema'

const client = createClient<paths>()

type Issue = components['schemas']['Issue']
type IssuesResponse = components['schemas']['IssuesResponse']
type AnalysisResult = components['schemas']['AnalysisResult']
type FixStatusResult = components['schemas']['FixStatusResult']

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

function extractRepoName(url: string): string {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`
  } catch { /* ignore */ }
  return url
}

function DevinAnalysis({ githubUrl, issue, canPush }: { githubUrl: string; issue: Issue; canPush: boolean }) {
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

  // No analysis yet
  if (!analysis && !triggered) {
    return (
      <div>
        <Button variant="primary" onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending}>
          {analyzeMutation.isPending ? 'Starting...' : 'Analyze with Devin'}
        </Button>
        {analyzeMutation.isError && (
          <Flash variant="danger" style={{ marginTop: '0.5rem' }}>Failed to start analysis. Please try again.</Flash>
        )}
      </div>
    )
  }

  // In progress
  if (isActive || (triggered && !analysis)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--fgColor-muted)' }}>
        <span className="spinner spinner--small" />
        <Text>Devin is analyzing this issue...</Text>
        {analysis?.devin_url && (
          <PrimerLink href={analysis.devin_url} target="_blank" rel="noopener noreferrer">
            Watch live
          </PrimerLink>
        )}
      </div>
    )
  }

  // Failed
  if (analysis?.status === 'failed') {
    return (
      <Flash variant="danger">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div>
            <Text weight="semibold">Analysis failed</Text>
            {analysis.plan && (
              <p style={{ marginTop: '0.25rem', marginBottom: 0, fontSize: '0.85rem', color: 'var(--fgColor-muted)' }}>{analysis.plan}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <Button size="small" onClick={() => { setTriggered(false); analyzeMutation.mutate() }}>Retry</Button>
            <Button size="small" variant="danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Flash>
    )
  }

  // Completed
  if (analysis?.status === 'completed') {
    return (
      <div>
        {/* Analysis panel */}
        <div style={{
          border: '1px solid var(--borderColor-default)',
          borderRadius: '6px',
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            background: 'var(--bgColor-muted)',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--borderColor-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Text weight="semibold">Devin Recommendation</Text>
              {analysis.confidence_score != null && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '2em',
                  fontWeight: 600,
                  background: getConfidenceColor(analysis.confidence_score),
                  color: '#fff',
                }}>
                  Confidence: {analysis.confidence_score}/10
                </span>
              )}
              {analysis.devin_url && (
                <PrimerLink href={analysis.devin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem' }}>
                  View session
                </PrimerLink>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button size="small" onClick={() => { setTriggered(false); analyzeMutation.mutate() }} disabled={analyzeMutation.isPending}>
                {analyzeMutation.isPending ? 'Starting...' : 'Re-analyze'}
              </Button>
              <Button size="small" variant="danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>

          {/* Plan content */}
          {analysis.plan && (
            <div style={{
              padding: '1rem',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'var(--fontStack-monospace)',
              lineHeight: 1.6,
            }}>
              {analysis.plan}
            </div>
          )}
        </div>

        {/* Fix section */}
        {analysis.plan && (
          <FixWithDevin githubUrl={githubUrl} issue={issue} analysis={analysis} canPush={canPush} />
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
  canPush,
}: {
  githubUrl: string
  issue: Issue
  analysis: AnalysisResult
  canPush: boolean
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
    if (!canPush) {
      return (
        <Flash variant="warning" style={{ marginTop: '1rem' }}>
          Devin can't create a pull request for this repository. Your GitHub token doesn't have write access.
        </Flash>
      )
    }
    return (
      <div style={{ marginTop: '1rem' }}>
        <Button
          variant="primary"
          onClick={() => fixMutation.mutate()}
          disabled={fixMutation.isPending}
          style={{ backgroundColor: 'var(--bgColor-success-emphasis)' }}
        >
          {fixMutation.isPending ? 'Starting...' : 'Fix with Devin'}
        </Button>
        {fixMutation.isError && (
          <Flash variant="danger" style={{ marginTop: '0.5rem' }}>Failed to start fix. Please try again.</Flash>
        )}
      </div>
    )
  }

  // In progress
  if (isActive || (triggered && !fixStatus)) {
    return (
      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--fgColor-muted)' }}>
        <span className="spinner spinner--small" />
        <Text>Devin is implementing the fix...</Text>
        {fixStatus?.fix_devin_url && (
          <PrimerLink href={fixStatus.fix_devin_url} target="_blank" rel="noopener noreferrer">
            Watch live
          </PrimerLink>
        )}
      </div>
    )
  }

  // Failed
  if (fixStatus?.fix_status === 'failed') {
    return (
      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Label variant="danger">Fix failed</Label>
        <Button size="small" onClick={() => { setTriggered(false); fixMutation.mutate() }}>Retry</Button>
      </div>
    )
  }

  // Completed - PR view styled like GitHub
  if (fixStatus?.fix_status === 'completed') {
    return (
      <div style={{
        marginTop: '1rem',
        border: '1px solid var(--borderColor-success-muted, #238636)',
        borderRadius: '6px',
        overflow: 'hidden',
      }}>
        {/* PR header bar */}
        <div style={{
          background: 'var(--bgColor-success-muted, rgba(35, 134, 54, 0.15))',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--borderColor-success-muted, #238636)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <GitPullRequestIcon size={16} />
          <Text weight="semibold">Pull Request</Text>
          <StateLabel status="pullOpened">Open</StateLabel>
        </div>
        {/* PR body */}
        <div style={{
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {fixStatus.pr_url ? (
              <Button
                as="a"
                href={fixStatus.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
                leadingVisual={GitPullRequestIcon}
                style={{ backgroundColor: 'var(--bgColor-success-emphasis)' }}
              >
                View Pull Request
              </Button>
            ) : (
              <Text style={{ color: 'var(--fgColor-muted)' }}>Fix completed (no PR URL returned)</Text>
            )}
            {fixStatus.fix_devin_url && (
              <PrimerLink href={fixStatus.fix_devin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem' }}>
                View Devin session
              </PrimerLink>
            )}
          </div>
          <Button size="small" onClick={() => { setTriggered(false); fixMutation.mutate() }} disabled={fixMutation.isPending}>
            {fixMutation.isPending ? 'Starting...' : 'Re-run fix'}
          </Button>
        </div>
      </div>
    )
  }

  return null
}

export function IssueDetail() {
  const [searchParams] = useSearchParams()
  const githubUrl = searchParams.get('github_url') ?? ''
  const issueId = Number(searchParams.get('issue_id'))
  const repoName = extractRepoName(githubUrl)

  const { data: issuesResponse, isLoading, error } = useQuery<IssuesResponse>({
    queryKey: ['issues', githubUrl],
    queryFn: async () => {
      const { data, error, response } = await client.GET('/api/issues', {
        params: { query: { github_url: githubUrl } },
      })
      if (error) {
        if (response.status === 400) {
          throw new Error(error.error || "The URL provided is not a valid GitHub repository URL.")
        }
        if (response.status === 403) {
          throw new Error(error.error || "Cannot access this repository with the provided token.")
        }
        throw new Error(error.error || "Failed to load issues.")
      }
      return data
    },
    enabled: !!githubUrl,
  })

  const issue = issuesResponse?.issues?.find(i => i.issue_id === issueId)
  const canPush = issuesResponse?.can_push ?? true

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem clamp(1rem, 3vw, 2.5rem)' }}>
      {/* Navigation */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Breadcrumbs>
          <Breadcrumbs.Item as={Link} to="/">Home</Breadcrumbs.Item>
          <Breadcrumbs.Item as={Link} to={`/issues?github_url=${encodeURIComponent(githubUrl)}`}>
            {repoName}
          </Breadcrumbs.Item>
          <Breadcrumbs.Item selected>#{issueId}</Breadcrumbs.Item>
        </Breadcrumbs>
        <div style={{ marginTop: '0.5rem' }}>
          <Button
            as={Link}
            to={`/issues?github_url=${encodeURIComponent(githubUrl)}`}
            variant="default"
            leadingVisual={ArrowLeftIcon}
          >
            Back to issues
          </Button>
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <span className="spinner spinner--large" />
        </div>
      )}

      {error && (
        <Flash variant="danger" style={{ marginTop: '1rem' }}>
          Failed to load issue: {error.message}
        </Flash>
      )}

      {!isLoading && !error && !issue && (
        <Flash style={{ marginTop: '1rem' }}>Issue not found.</Flash>
      )}

      {issue && (
        <>
          {/* Issue header */}
          <div style={{
            marginBottom: '2rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid var(--borderColor-default)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <StateLabel status={issue.state === 'open' ? 'issueOpened' : 'issueClosed'}>
                {issue.state === 'open' ? 'Open' : 'Closed'}
              </StateLabel>
              <Text style={{ color: 'var(--fgColor-muted)' }}>#{issue.issue_id}</Text>
            </div>

            <Heading as="h1" style={{ marginBottom: '0.75rem' }}>{issue.issue_title}</Heading>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--fgColor-muted)', marginBottom: '0.5rem' }}>
              {issue.author_avatar && (
                <Avatar src={issue.author_avatar} alt={issue.author} size={20} />
              )}
              <Text weight="semibold">{issue.author}</Text>
              <span>opened {formatDate(issue.created_at)}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <CommentIcon size={14} />
                {issue.comment_count} comment{issue.comment_count !== 1 ? 's' : ''}
              </span>
            </div>

            {issue.labels && issue.labels.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {issue.labels.map(label => (
                  <span
                    key={label.name}
                    style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '2em',
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
              <Heading as="h2" variant="small" style={{ marginBottom: '0.75rem', color: 'var(--fgColor-muted)' }}>Description</Heading>
              <div style={{
                background: 'var(--bgColor-muted)',
                border: '1px solid var(--borderColor-default)',
                borderRadius: '6px',
                padding: '1rem',
                fontSize: '0.9rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.6,
              }}>
                {issue.body}
              </div>
            </div>
          )}

          {/* Analysis */}
          <div style={{
            border: '1px solid var(--borderColor-default)',
            borderRadius: '6px',
            padding: '1.25rem',
          }}>
            <Heading as="h2" variant="small" style={{ marginBottom: '0.75rem', color: 'var(--fgColor-muted)' }}>Devin Analysis</Heading>
            <DevinAnalysis githubUrl={githubUrl} issue={issue} canPush={canPush} />
          </div>
        </>
      )}
    </div>
  )
}
