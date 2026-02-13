import React, { useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Heading, Text, Button, Flash, StateLabel,
  Avatar, Breadcrumbs, TextInput, SegmentedControl,
} from '@primer/react'
import { ArrowLeftIcon, CommentIcon, IssueOpenedIcon, SearchIcon } from '@primer/octicons-react'
import createClient from 'openapi-fetch'
import type { paths, components } from '../api-schema'
import { AnalysisBadge } from './AnalysisBadge'
import { GITHUB_URL_RE, extractRepoName, formatDate } from '../utils'

const client = createClient<paths>()

type IssuesResponse = components['schemas']['IssuesResponse']
type StateFilter = 'open' | 'closed' | 'all'

const STATE_OPTIONS: { label: string; value: StateFilter }[] = [
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
  { label: 'All', value: 'all' },
]

export const Issues = React.memo(function IssuesFn() {
  const [searchParams] = useSearchParams()
  const githubUrl = searchParams.get('github_url') ?? ''
  const repoName = extractRepoName(githubUrl)
  const isValidUrl = GITHUB_URL_RE.test(githubUrl)

  const [searchText, setSearchText] = useState('')
  const [stateFilter, setStateFilter] = useState<StateFilter>('open')

  const { data: issuesResponse, isLoading, error, refetch } = useQuery<IssuesResponse, Error>({
    queryKey: ['issues', githubUrl, stateFilter],
    queryFn: async () => {
      const { data, error, response } = await client.GET('/api/issues', {
        params: { query: { github_url: githubUrl, state: stateFilter } },
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
    enabled: !!githubUrl && isValidUrl,
    retry: false,
  })

  const allIssues = issuesResponse?.issues
  const canPush = issuesResponse?.can_push ?? true

  const filteredIssues = useMemo(() => {
    if (!allIssues) return undefined
    if (!searchText.trim()) return allIssues
    const query = searchText.toLowerCase()
    return allIssues.filter(issue => issue.issue_title.toLowerCase().includes(query))
  }, [allIssues, searchText])

  const selectedStateIndex = STATE_OPTIONS.findIndex(o => o.value === stateFilter)

  if (!githubUrl) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem clamp(1rem, 3vw, 2.5rem)' }}>
        <Flash variant="warning">No GitHub URL provided. Please go back and enter a repository URL.</Flash>
        <div style={{ marginTop: '1rem' }}>
          <Button as={Link} to="/" variant="invisible" leadingVisual={ArrowLeftIcon}>Back to home</Button>
        </div>
      </div>
    )
  }

  if (!isValidUrl) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem clamp(1rem, 3vw, 2.5rem)' }}>
        <Flash variant="warning">
          "{githubUrl}" doesn't look like a valid GitHub URL. Please use a URL like https://github.com/owner/repo.
        </Flash>
        <div style={{ marginTop: '1rem' }}>
          <Button as={Link} to="/" variant="invisible" leadingVisual={ArrowLeftIcon}>Back to home</Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem clamp(1rem, 3vw, 2.5rem)' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Breadcrumbs>
          <Breadcrumbs.Item as={Link} to="/">Home</Breadcrumbs.Item>
          <Breadcrumbs.Item selected>{repoName}</Breadcrumbs.Item>
        </Breadcrumbs>
        <Heading as="h1" style={{ marginTop: '0.5rem' }}>{repoName}</Heading>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <TextInput
          leadingVisual={SearchIcon}
          placeholder="Search issues..."
          value={searchText}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
          aria-label="Search issues by title"
          style={{ flex: 1, minWidth: '200px' }}
        />
        <SegmentedControl aria-label="Issue state filter" onChange={(index: number) => setStateFilter(STATE_OPTIONS[index].value)}>
          {STATE_OPTIONS.map(opt => (
            <SegmentedControl.Button key={opt.value} selected={opt.value === STATE_OPTIONS[selectedStateIndex].value}>
              {opt.label}
            </SegmentedControl.Button>
          ))}
        </SegmentedControl>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <span className="spinner spinner--large" />
        </div>
      )}

      {error && (
        <Flash variant="danger" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error.message}</span>
          <Button size="small" onClick={() => refetch()}>Retry</Button>
        </Flash>
      )}

      {allIssues && !canPush && (
        <Flash variant="warning" style={{ marginBottom: '1rem' }}>
          You have read-only access to this repository. Devin won't be able to create pull requests for fixes.
        </Flash>
      )}

      {filteredIssues && allIssues && filteredIssues.length !== allIssues.length && filteredIssues.length > 0 && (
        <Text as="p" size="small" style={{ color: 'var(--fgColor-muted)', marginBottom: '0.75rem' }}>
          Showing {filteredIssues.length} of {allIssues.length} issues
        </Text>
      )}

      {allIssues && allIssues.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          border: '1px dashed var(--borderColor-default)',
          borderRadius: '6px',
          color: 'var(--fgColor-muted)',
        }}>
          <IssueOpenedIcon size={24} />
          <Heading as="h3" style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>No issues found</Heading>
          <Text>This repository doesn't have any {stateFilter === 'all' ? '' : stateFilter} issues.</Text>
        </div>
      )}

      {filteredIssues && allIssues && allIssues.length > 0 && filteredIssues.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          border: '1px dashed var(--borderColor-default)',
          borderRadius: '6px',
          color: 'var(--fgColor-muted)',
        }}>
          <SearchIcon size={24} />
          <Heading as="h3" style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>No issues match your search</Heading>
          <Text as="p">Try a different search term or adjust your filters.</Text>
          <Button
            variant="invisible"
            size="small"
            style={{ marginTop: '0.75rem' }}
            onClick={() => setSearchText('')}
          >
            Clear search
          </Button>
        </div>
      )}

      {filteredIssues && filteredIssues.length > 0 && (
        <div style={{
          border: '1px solid var(--borderColor-default)',
          borderRadius: '6px',
          overflow: 'hidden',
        }}>
          {filteredIssues.map((issue, idx) => (
            <div
              key={issue.issue_id}
              style={{
                padding: '1rem 1.25rem',
                borderTop: idx > 0 ? '1px solid var(--borderColor-default)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Text weight="semibold" style={{ color: 'var(--fgColor-muted)' }}>#{issue.issue_id}</Text>
                <StateLabel status={issue.state === 'open' ? 'issueOpened' : 'issueClosed'}>
                  {issue.state}
                </StateLabel>
                <AnalysisBadge githubUrl={githubUrl} issueId={issue.issue_id} />
              </div>

              <Heading as="h3" variant="small" style={{ margin: '0 0 0.5rem 0' }}>
                {issue.issue_title}
              </Heading>

              {issue.labels && issue.labels.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
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

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--fgColor-muted)' }}>
                  {issue.author_avatar && (
                    <Avatar src={issue.author_avatar} alt={issue.author} size={20} />
                  )}
                  <span>{issue.author}</span>
                  <span>opened {formatDate(issue.created_at)}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CommentIcon size={14} />
                    {issue.comment_count}
                  </span>
                </div>
                <Button
                  as={Link}
                  to={`/issue?github_url=${encodeURIComponent(githubUrl)}&issue_id=${issue.issue_id}`}
                  size="small"
                  variant="primary"
                >
                  View
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
