import { Component, StrictMode, lazy, Suspense, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './ui/base.css'
import './site/site.css'
import './app/app.css'
import Landing from './site/Landing'
import PublicLayout from './site/PublicLayout'
import NotFound from './site/NotFound'
import { ArcLoader } from './ui/arc'

const HowItWorks = lazy(() => import('./site/HowItWorks'))
const AppShell = lazy(() => import('./app/AppShell'))
const Placeholder = lazy(() => import('./app/Placeholder'))
const Overview = lazy(() => import('./app/Overview'))
const NewCheck = lazy(() => import('./app/NewCheck'))
const Report = lazy(() => import('./app/Report'))
const Money = lazy(() => import('./app/Money'))
const MySystem = lazy(() => import('./app/MySystem'))
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
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="app" element={<AppShell mode="app" />}>
              <Route index element={<Overview />} />
              <Route path="check" element={<NewCheck />} />
              <Route path="report" element={<Report />} />
              <Route path="money" element={<Money />} />
              <Route path="clean" element={<Placeholder title="Get it cleaned" />} />
              <Route path="history" element={<Placeholder title="History" />} />
              <Route path="settings" element={<MySystem />} />
            </Route>
            <Route path="sample" element={<AppShell mode="sample" />}>
              <Route index element={<Overview />} />
              <Route path="check" element={<NewCheck />} />
              <Route path="report" element={<Report />} />
              <Route path="money" element={<Money />} />
              <Route path="clean" element={<Placeholder title="Get it cleaned" />} />
              <Route path="history" element={<Placeholder title="History" />} />
              <Route path="settings" element={<MySystem />} />
            </Route>
            <Route path="brand" element={<Brand />} />
            <Route path="legacy" element={<Legacy />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
