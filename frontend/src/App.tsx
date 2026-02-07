import React from 'react'
import createClient from 'openapi-fetch'
import type { paths, components } from './api-schema'
import './App.css'

const client = createClient<paths>()

type HealthResponse = components['schemas']['HealthOut']

export const App = React.memo(function AppFn() {
  const [data, setData] = React.useState<HealthResponse | null>(null)
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
    </div>
  )
});
