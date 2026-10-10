const API = (import.meta.env.VITE_API_URL as string).replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  body: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.error ?? body.message ?? `Request failed (${status})`))
    this.status = status
    this.body = body
  }
}

// The app sets this to the Cognito access token getter; the legacy screens leave it unset.
let tokenProvider: (() => Promise<string | null>) | null = null
export const setTokenProvider = (fn: typeof tokenProvider) => { tokenProvider = fn }

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  const token = tokenProvider ? await tokenProvider() : null
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

export type Row = { date: string; kwh: number }

export type Site = {
  lat: number; lon: number; capacity_kwp: number; tariff_inr: number; cleaning_cost_inr: number
  installer_phone?: string | null; simulated?: boolean; label?: string
  tilt?: number; azimuth?: number; install_date?: string | null; language?: 'en' | 'hi'; notify_email?: boolean
}

export type Action = {
  actionId?: string; SK?: string; type: string; outcome: string; recheck_at?: string; whatsapp_url?: string | null
  as_of: string; monthly_loss_inr: number; next_step?: string
  recheck_result?: { outcome: string; recovered_inr_month?: number; pre_pi_norm?: number; post_pi_norm?: number; hc_days_after?: number; cleaned_on?: string | null; series?: { date: string; actual: number | null; expected: number }[] }
}

export type SiteView = {
  siteId: string; site: Site; readings: { date: string; kwh: number; source: string }[]
  events: { date: string; type: string }[]; actions: Action[]; latestAnalysisId: string | null
  panelPhotos?: { url: string; taken: string }[]
}

export type AnalysisSummary = { analysisId: string; status: string; as_of?: string; verdict?: string; monthly_loss_inr?: number; action?: string; finished_at?: string }

export type Performance = {
  segment_start: string; baseline_pi: number; segment_slope: number | null; segment_decline: number | null
  med3_latest: number | null; med7_latest: number | null; mean_expected_kwh: number; hc_days: number
  steps: { date: string; delta: number }[]; trip_days: string[]
}

export type SeriesPoint = {
  date: string; actual: number | null; expected: number; low_conf: boolean; rain_mm: number
  pi_norm: number | null; peer_pi_norm: number | null
}

export type Analysis = {
  status: 'PENDING' | 'DONE' | 'FAILED'; error?: string; as_of: string; verdict: string
  action: string; allowed_actions: Record<string, string[]>; tie_candidates: string[]
  monthly_loss_inr: number; window_loss_inr: number; evidence: string[]; recheck_days: number | null
  explanation: { headline: string; why: string; what_to_do: string }; explanation_source: string
  series: SeriesPoint[]; peers: { n_peers: number }; peers_simulated: boolean
  performance: Performance; scores: Record<string, number>
}

export type EvidenceKind = 'inverter_screenshot' | 'inverter_photo' | 'meter_photo' | 'panel_photo'
export type Extraction = {
  kind?: EvidenceKind; view?: string; rows: Row[]; warnings: string[]; engine?: string
  meter_total_kwh?: number | null; values?: Record<string, { value: number; confidence: number }>
}

type PresignedPost = { key: string; url: string; fields: Record<string, string> }

export const api = {
  createSite: (b: Partial<Site>) => call<{ siteId: string }>('POST', '/sites', b),
  getSite: (id: string) => call<SiteView>('GET', `/sites/${id}`),
  putReadings: (id: string, rows: Row[], source: string) =>
    call<{ saved: number; rejected: { date?: string; reason: string }[] }>('PUT', `/sites/${id}/readings`, { rows, source }),
  addMeter: (id: string, date: string, total_kwh: number) =>
    call<{ saved_days: number; avg_kwh_per_day?: number; message?: string }>('POST', `/sites/${id}/meter`, { date, total_kwh }),
  addEvent: (id: string, date: string, type: 'CLEANED' | 'REPAIR') => call('POST', `/sites/${id}/events`, { date, type }),
  startAnalysis: (id: string) => call<{ analysisId: string }>('POST', `/sites/${id}/analyses`, {}),
  getAnalysis: (id: string, aid: string) => call<Analysis>('GET', `/sites/${id}/analyses/${aid}`),
  createAction: (id: string, analysisId: string, action: string) =>
    call<Action>('POST', `/sites/${id}/actions`, { analysisId, action }),

  me: () => call<{ siteId: string | null }>('GET', '/me'),
  saveMySite: (b: Partial<Site>) => call<{ siteId: string }>('PUT', '/me/site', b),
  listAnalyses: (id: string) => call<{ analyses: AnalysisSummary[] }>('GET', `/sites/${id}/analyses`),

  async upload(id: string, tiles: Blob[], kind: EvidenceKind): Promise<string[]> {
    const { uploads } = await call<{ uploads: PresignedPost[] }>('POST', `/sites/${id}/uploads`,
      { tiles: tiles.length, contentType: 'image/jpeg', kind })
    await Promise.all(uploads.map(async (u, i) => {
      const form = new FormData()
      Object.entries(u.fields).forEach(([k, v]) => form.append(k, v))
      form.append('file', tiles[i])
      const r = await fetch(u.url, { method: 'POST', body: form })
      if (!r.ok) throw new Error('Upload failed. Is the image under 3.75 MB?')
    }))
    return uploads.map((u) => u.key)
  },
  extract: (id: string, keys: string[], kind: EvidenceKind) => call<Extraction>('POST', `/sites/${id}/extractions`, { keys, kind }),

  async uploadAndExtract(id: string, tiles: Blob[]): Promise<Extraction> {
    const { uploads } = await call<{ uploads: PresignedPost[] }>('POST', `/sites/${id}/uploads`,
      { tiles: tiles.length, contentType: 'image/jpeg' })
    await Promise.all(uploads.map(async (u, i) => {
      const form = new FormData()
      Object.entries(u.fields).forEach(([k, v]) => form.append(k, v))
      form.append('file', tiles[i])
      const r = await fetch(u.url, { method: 'POST', body: form })
      if (!r.ok) throw new Error('Upload failed. Is the image under 3.75 MB?')
    }))
    return call<Extraction>('POST', `/sites/${id}/extractions`, { keys: uploads.map((u) => u.key) })
  },

  async waitForAnalysis(id: string, aid: string, onTick?: (s: number) => void): Promise<Analysis> {
    const t0 = Date.now()
    for (;;) {
      const a = await api.getAnalysis(id, aid)
      if (a.status !== 'PENDING') return a
      if (Date.now() - t0 > 120_000) throw new Error('The check is taking too long. Please try again.')
      onTick?.(Math.round((Date.now() - t0) / 1000))
      await new Promise((r) => setTimeout(r, 2500))
    }
  },
}
