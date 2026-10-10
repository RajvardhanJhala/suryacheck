import { createContext, useContext } from 'react'
import type { Analysis, SiteView } from '../api'

export type SiteState = {
  base: '/app' | '/sample'
  sample: boolean
  siteId: string | null
  view: SiteView | null
  analysis: Analysis | null
  analysisId: string | null
  loading: boolean
  error: string
  reload: () => Promise<void>
  setSiteId: (id: string) => void
}

export const SiteCtx = createContext<SiteState | null>(null)

export function useSite(): SiteState {
  const s = useContext(SiteCtx)
  if (!s) throw new Error('useSite outside AppShell')
  return s
}

export const SAMPLES = [
  { id: 'demohemant01', name: 'Hemant · dust' },
  { id: 'demomeera001', name: 'Meera · fault' },
  { id: 'demoreplay01', name: 'Hemant · after cleaning' },
]
