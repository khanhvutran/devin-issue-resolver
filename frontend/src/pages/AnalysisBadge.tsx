import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Text, Label } from '@primer/react'
import createClient from 'openapi-fetch'
import type { paths, components } from '../api-schema'
import { FixBadge } from './FixBadge'
import { getConfidenceColor, extractApiError, isNetworkError, getNetworkErrorMessage } from '../utils'

const client = createClient<paths>()

type AnalysisResult = components['schemas']['AnalysisResult']

interface Props {
  githubUrl: string
  issueId: number
}

export const AnalysisBadge = React.memo(function AnalysisBadgeFn({ githubUrl, issueId }: Props) {
  const { data: analysis, error: queryError } = useQuery<AnalysisResult | null>({ 
    queryKey: ['devin-analysis', githubUrl, issueId],
    queryFn: async () => {
      try {
        const { data, error } = await client.GET('/api/devin/analysis', {
          params: { query: { github_url: githubUrl, issue_id: issueId } },
        })
        if (error) throw new Error(extractApiError(error, 'Failed to load analysis status.'))
        if (data.status === 'not_found') return null
        return data
      } catch (err) {
        if (isNetworkError(err)) throw new Error(getNetworkErrorMessage())
        throw err
      }
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'pending' || status === 'analyzing') return 5000
      return false
    },
  })

  if (queryError) return <Label variant="attention">Error</Label>

  if (!analysis) return null

  if (analysis.status === 'pending' || analysis.status === 'analyzing') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <span className="spinner spinner--small" /> <Text size="small" style={{ color: 'var(--fgColor-muted)' }}>Analyzing...</Text>
      </span>
    )
  }

  if (analysis.status === 'failed') {
    return <Label variant="danger">Failed</Label>
  }

  if (analysis.status === 'completed' && analysis.confidence_score != null) {
    return (
      <>
        <span style={{
          fontSize: '0.75rem',
          padding: '2px 8px',
          borderRadius: '2em',
          fontWeight: 600,
          background: getConfidenceColor(analysis.confidence_score),
          color: '#fff',
        }}>
          Score: {analysis.confidence_score}/10
        </span>
        <FixBadge githubUrl={githubUrl} issueId={issueId} />
      </>
    )
  }

  if (analysis.status === 'completed') {
    return (
      <>
        <Label variant="success">Analyzed</Label>
        <FixBadge githubUrl={githubUrl} issueId={issueId} />
      </>
    )
  }

  return null
})
