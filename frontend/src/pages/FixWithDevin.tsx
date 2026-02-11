import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Text, Button, Flash, Label, StateLabel,
  Link as PrimerLink,
} from '@primer/react'
import { GitPullRequestIcon } from '@primer/octicons-react'
import createClient from 'openapi-fetch'
import type { paths, components } from '../api-schema'

const client = createClient<paths>()

type Issue = components['schemas']['Issue']
type AnalysisResult = components['schemas']['AnalysisResult']
type FixStatusResult = components['schemas']['FixStatusResult']

interface Props {
  githubUrl: string
  issue: Issue
  analysis: AnalysisResult
  canPush: boolean
}

export const FixWithDevin = React.memo(function FixWithDevinFn({
  githubUrl,
  issue,
  analysis,
  canPush,
}: Props) {
  const [triggered, setTriggered] = useState(false)
  const queryClient = useQueryClient()

  const fixStatusQuery = useQuery<FixStatusResult | null>({
    queryKey: ['devin-fix', githubUrl, issue.issue_id],
    queryFn: async () => {
      const { data, error } = await client.GET('/api/devin/fix-status', {
        params: { query: { github_url: githubUrl, issue_id: issue.issue_id } },
      })
      if (error) throw new Error(JSON.stringify(error))
      if (data.fix_status === 'not_found') return null
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
})
