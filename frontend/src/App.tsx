import React, { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Heading, Text, TextInput, Button, FormControl } from '@primer/react'
import { MarkGithubIcon } from '@primer/octicons-react'
import { GITHUB_URL_RE } from './utils'

export const App = React.memo(function AppFn() {
  const [githubUrl, setGithubUrl] = useState('')
  const [validationError, setValidationError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const url = githubUrl.trim()
    if (!url) {
      setValidationError('Please enter a URL.')
      return
    }
    if (!GITHUB_URL_RE.test(url)) {
      setValidationError('Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo).')
      return
    }
    setValidationError('')
    navigate(`/issues?github_url=${encodeURIComponent(url)}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
      <MarkGithubIcon size={48} />
      <Heading as="h1" style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>Devin: The Quicker Fixer Upper</Heading>
      <Text as="p" size="medium" style={{ color: 'var(--fgColor-muted)', marginBottom: '2rem' }}>
        Enter a GitHub repository URL to browse its issues
      </Text>
      <div style={{
        width: '100%',
        maxWidth: '500px',
        border: '1px solid var(--borderColor-default)',
        borderRadius: '6px',
        padding: '1.5rem',
      }}>
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          <FormControl>
            <FormControl.Label visuallyHidden>GitHub URL</FormControl.Label>
            <TextInput
              value={githubUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setGithubUrl(e.target.value); setValidationError('') }}
              placeholder="https://github.com/owner/repo"
              size="large"
              block
              validationStatus={validationError ? 'error' : undefined}
              aria-label="GitHub repository URL"
            />
            {validationError && (
              <FormControl.Validation variant="error">{validationError}</FormControl.Validation>
            )}
          </FormControl>
          <Button variant="primary" size="large" type="submit" block>
            Browse Issues
          </Button>
        </form>
      </div>
    </div>
  )
})
