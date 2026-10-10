import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './ui/base.css'
import './pages/brand.css'
import Brand from './pages/Brand'
import { ArcLoader } from './ui/arc'

// shortcut: old screens stay reachable until steps 2-3 replace them; their CSS loads only with them.
const Legacy = lazy(() => import('./LegacyApp'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<ArcLoader />}>
        <Routes>
          <Route path="/brand" element={<Brand />} />
          <Route path="*" element={<Legacy />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
