import { Component, StrictMode, lazy, Suspense, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import './ui/base.css'
import './site/site.css'
import './app/app.css'
import Landing from './site/Landing'
import PublicLayout from './site/PublicLayout'
import NotFound from './site/NotFound'
import { ArcLoader } from './ui/arc'

const HowItWorks = lazy(() => import('./site/HowItWorks'))
const AppShell = lazy(() => import('./app/AppShell'))
const TestRoof = lazy(() => import('./app/TestRoof'))
const History = lazy(() => import('./app/History'))
const MySystem = lazy(() => import('./app/MySystem'))
const Brand = lazy(() => import('./pages/Brand'))

/** Old /sample/* links open the same results page with the sample loaded. */
function SampleRedirect() {
  const site = new URLSearchParams(useLocation().search).get('site') ?? 'demohemant01'
  return <Navigate to={`/test?sample=${site}`} replace />
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="wrap not-found" role="alert">
        <h1>Something broke on this page.</h1>
        <p className="lead">Your data is safe. Reload to try again.</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>Reload</button>
      </div>
    )
  }
}

const loading = <div className="center-screen"><ArcLoader /></div>

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={loading}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<Landing />} />
              <Route path="how-it-works" element={<HowItWorks />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route element={<AppShell />}>
              <Route path="test" element={<TestRoof />} />
              <Route path="r/:id" element={<TestRoof />} />
              <Route path="history" element={<History />} />
              <Route path="settings" element={<MySystem />} />
            </Route>
            <Route path="app/history" element={<Navigate to="/history" replace />} />
            <Route path="app/settings" element={<Navigate to="/settings" replace />} />
            <Route path="app/*" element={<Navigate to="/test" replace />} />
            <Route path="sample/*" element={<SampleRedirect />} />
            <Route path="legacy" element={<Navigate to="/test" replace />} />
            <Route path="brand" element={<Brand />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
