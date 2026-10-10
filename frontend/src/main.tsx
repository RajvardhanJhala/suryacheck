import { Component, StrictMode, lazy, Suspense, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import './ui/base.css'
import './site/site.css'
import Landing from './site/Landing'
import PublicLayout from './site/PublicLayout'
import NotFound from './site/NotFound'
import { ArcLoader } from './ui/arc'

const HowItWorks = lazy(() => import('./site/HowItWorks'))
const Auth = lazy(() => import('./site/Auth'))
const AppShell = lazy(() => import('./app/AppShell'))
const Placeholder = lazy(() => import('./app/Placeholder'))
const Brand = lazy(() => import('./pages/Brand'))
// shortcut: old screens stay at /legacy until step 3 replaces them.
const Legacy = lazy(() => import('./LegacyApp'))

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
              <Route path="login" element={<Auth mode="login" />} />
              <Route path="signup" element={<Auth mode="signup" />} />
              <Route path="forgot" element={<Auth mode="forgot" />} />
              <Route path="sample" element={<Navigate to={{ pathname: '/legacy', hash: '#/site/demohemant01' }} replace />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="app" element={<AppShell />}>
              <Route index element={<Placeholder title="Overview" />} />
              <Route path="check" element={<Placeholder title="New check" />} />
              <Route path="report" element={<Placeholder title="Report" />} />
              <Route path="money" element={<Placeholder title="Money" />} />
              <Route path="clean" element={<Placeholder title="Get it cleaned" />} />
              <Route path="history" element={<Placeholder title="History" />} />
              <Route path="settings" element={<Placeholder title="My system" />} />
            </Route>
            <Route path="brand" element={<Brand />} />
            <Route path="legacy" element={<Legacy />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
