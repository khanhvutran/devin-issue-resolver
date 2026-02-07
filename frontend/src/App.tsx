import React from 'react'
import createClient from 'openapi-fetch'
import type { paths, operations } from './api-schema'
import './App.css'

const client = createClient<paths>()

type HealthResponse =  operations["app.routes.health.health_check"]["responses"]["200"]["content"]["application/json"]
type IssuesResponse = operations["app.routes.issues.issues"]["responses"]["200"]["content"]["application/json"]



export const App = React.memo(function AppFn() {
  const [data, setData] = React.useState<HealthResponse | null>(null)
  const [issues, setIssues] = React.useState<IssuesResponse | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    client
      .GET('/api/health')
      .then(({ data, error }) => {
        if (error) throw new Error(JSON.stringify(error))
        setData(data)
      })
      .catch((err) => setError(err.message))
  }, [])

  React.useEffect(() => {
    client
      .GET('/api/issues')
      .then(({ data, error }) => {
        if (error) throw new Error(JSON.stringify(error))
          setIssues(data)
      })
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div className="App">
      <h1>Devin</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {data ? (
        <div>
          <p>
            Backend says: <strong>{data.message}</strong>
          </p>
          <p>
            Status: <strong>{data.status}</strong>
          </p>
        </div>
      ) : (
        !error && <p>Loading...</p>
      )}
      {issues != null && (
        <ul className="space-y-2">
          {issues.map(issue => (
            <li key={issue.issue_id} className="p-3 border rounded hover:bg-gray-50">
              <span className="font-semibold">#{issue.issue_id}:</span> {issue.issue_title}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
});
