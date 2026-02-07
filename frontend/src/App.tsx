import { useEffect, useState } from 'react'
import './App.css'

interface HealthResponse {
  message: string
  status: string
}

function App() {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json: HealthResponse) => setData(json))
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
}

export default App
