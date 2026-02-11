import React from 'react'
import { useSearchParams, Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Heading, Text, Button, Flash, StateLabel,
  Avatar, Breadcrumbs,
} from '@primer/react'
import { ArrowLeftIcon, CommentIcon } from '@primer/octicons-react'
import createClient from 'openapi-fetch'
import type { paths, components } from '../api-schema'
import { DevinAnalysis } from './DevinAnalysis'
import { extractRepoName, formatDate } from '../utils'

const client = createClient<paths>()

type IssuesResponse = components['schemas']['IssuesResponse']

export const IssueDetail = React.memo(function IssueDetailFn() {
  const [searchParams] = useSearchParams()
  const githubUrl = searchParams.get('github_url') ?? ''
  const issueId = Number(searchParams.get('issue_id'))
  const repoName = extractRepoName(githubUrl)

  const { data: issuesResponse, isLoading, error } = useQuery<IssuesResponse, Error>({
    queryKey: ['issues', githubUrl],
    queryFn: async () => {
      const { data, error, response } = await client.GET('/api/issues', {
        params: { query: { github_url: githubUrl } },
      })
      if (error) {
        if (response.status === 400) {
          throw new Error(error.error || 'The URL provided is not a valid GitHub repository URL.')
        }
        if (response.status === 403) {
          throw new Error(error.error || 'Cannot access this repository with the provided token.')
        }
        throw new Error(error.error || 'Failed to load issues.')
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
})
