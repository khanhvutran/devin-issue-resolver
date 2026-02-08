import { useQuery } from '@tanstack/react-query'
import createClient from 'openapi-fetch'
import type { paths, operations } from './api-schema'
import './App.css'

const client = createClient<paths>()

type HealthResponse = operations["app.routes.health.health_check"]["responses"]["200"]["content"]["application/json"]
type IssuesResponse = operations["app.routes.issues.issues"]["responses"]["200"]["content"]["application/json"]

export function App() {
  const { data, isLoading: healthLoading, error: healthError } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const { data, error } = await client.GET('/api/health')
      if (error) throw new Error(JSON.stringify(error))
      return data
    },
  })

  const { data: issues, error: issuesError } = useQuery<IssuesResponse>({
    queryKey: ['issues'],
    queryFn: async () => {
      const { data, error } = await client.GET('/api/issues')
      if (error) throw new Error(JSON.stringify(error))
      return data
    },
  })

  const error = healthError || issuesError

  return (
    <div className="App">
      <h1>Devin</h1>
      {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
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
        !error && healthLoading && <p>Loading...</p>
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
}
