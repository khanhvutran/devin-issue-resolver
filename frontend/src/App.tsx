import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import './App.css'

const GITHUB_URL_RE = /^https?:\/\/github\.com\/[^/]+\/[^/]+/

export function App() {
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
    <div className="App">
      <h1>Devin</h1>
      <p style={{ marginBottom: '2rem', color: '#888' }}>
        Enter a GitHub repository URL to browse its issues
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <input
          type="text"
          value={githubUrl}
          onChange={e => { setGithubUrl(e.target.value); setValidationError('') }}
          placeholder="https://github.com/owner/repo"
          style={{
            width: '100%',
            maxWidth: '500px',
            padding: '0.8rem 1rem',
            fontSize: '1.1rem',
            borderRadius: '8px',
            border: `1px solid ${validationError ? '#d93025' : '#444'}`,
            background: 'inherit',
            color: 'inherit',
          }}
        />
        {validationError && (
          <p style={{ color: '#d93025', margin: 0, fontSize: '0.9rem' }}>
            {validationError}
          </p>
        )}
        <button type="submit" style={{ padding: '0.8rem 2rem', fontSize: '1.1rem' }}>
          Browse Issues
        </button>
      </form>
    </div>
  )
}
