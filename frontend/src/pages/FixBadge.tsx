import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Text, Label, Link as PrimerLink } from '@primer/react'
import createClient from 'openapi-fetch'
import type { paths, components } from '../api-schema'

const client = createClient<paths>()

type FixStatusResult = components['schemas']['FixStatusResult']

interface Props {
  githubUrl: string
  issueId: number
}

export const FixBadge = React.memo(function FixBadgeFn({ githubUrl, issueId }: Props) {
  const { data: fixStatus } = useQuery<FixStatusResult | null>({
    queryKey: ['devin-fix', githubUrl, issueId],
    queryFn: async () => {
      const { data, error } = await client.GET('/api/devin/fix-status', {
        params: { query: { github_url: githubUrl, issue_id: issueId } },
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

  if (!fixStatus) return null

  if (fixStatus.fix_status === 'pending' || fixStatus.fix_status === 'analyzing') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <span className="spinner spinner--small" /> <Text size="small" style={{ color: 'var(--fgColor-muted)' }}>Fixing...</Text>
      </span>
    )
  }

  if (fixStatus.fix_status === 'completed' && fixStatus.pr_url) {
    return (
      <Label variant="done">
        <PrimerLink
          href={fixStatus.pr_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          PR
        </PrimerLink>
      </Label>
    )
  }

  if (fixStatus.fix_status === 'failed') {
    return <Label variant="danger">Fix failed</Label>
  }

  return null
})
