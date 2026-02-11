import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Text, Button, Flash,
  Link as PrimerLink,
} from '@primer/react'
import createClient from 'openapi-fetch'
import type { paths, components } from '../api-schema'
import { FixWithDevin } from './FixWithDevin'

const client = createClient<paths>()

type Issue = components['schemas']['Issue']
type AnalysisResult = components['schemas']['AnalysisResult']

function getConfidenceColor(score: number): string {
  if (score >= 8) return '#238636'
  if (score >= 5) return '#d29922'
  return '#d93025'
}

interface Props {
  githubUrl: string
  issue: Issue
  canPush: boolean
}

export const DevinAnalysis = React.memo(function DevinAnalysisFn({ githubUrl, issue, canPush }: Props) {
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
})
