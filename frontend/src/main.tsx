import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, BaseStyles } from '@primer/react'
import '@primer/primitives/dist/css/functional/themes/light.css'
import './index.css'
import { App } from './App.tsx'
import { Issues } from './pages/Issues.tsx'
import { IssueDetail } from './pages/IssueDetail.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider colorMode="day" dayScheme="light">
      <BaseStyles>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<App />} />
                <Route path="/issues" element={<Issues />} />
                <Route path="/issue" element={<IssueDetail />} />
              </Routes>
            </BrowserRouter>
          </ErrorBoundary>
        </QueryClientProvider>
      </BaseStyles>
    </ThemeProvider>
  </StrictMode>,
)
