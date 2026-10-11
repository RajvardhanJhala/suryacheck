import { createContext, useContext } from 'react'
import type { Analysis, SiteView } from '../api'

export type SiteState = {
  base: '/test'
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

// No accounts: this browser remembers its own site id. Storage can throw in private modes.
// shortcut: lost if the browser's site data is cleared; add an export/bookmark link if users ask.
export const mySite = {
  get: (): string | null => { try { return localStorage.getItem('suryacheck.site') } catch { return null } },
  set: (id: string) => { try { localStorage.setItem('suryacheck.site', id) } catch { /* still works for this visit */ } },
}

export const SAMPLES = [
  { id: 'demohemant01', name: 'Hemant · dust' },
  { id: 'demomeera001', name: 'Meera · fault' },
  { id: 'demoreplay01', name: 'Hemant · after cleaning' },
]
