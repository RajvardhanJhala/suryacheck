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

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
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
}

export type Action = {
  actionId?: string; SK?: string; type: string; outcome: string; recheck_at?: string; whatsapp_url?: string | null
  as_of: string; monthly_loss_inr: number; next_step?: string
  recheck_result?: { outcome: string; recovered_inr_month?: number; pre_pi_norm?: number; post_pi_norm?: number; hc_days_after?: number; cleaned_on?: string | null; series?: { date: string; actual: number | null; expected: number }[] }
}

export type SiteView = {
  siteId: string; site: Site; readings: { date: string; kwh: number; source: string }[]
  events: { date: string; type: string }[]; actions: Action[]; latestAnalysisId: string | null
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
  performance: { segment_start: string; baseline_pi: number }
}

export type Extraction = { view: string; rows: Row[]; meter_total_kwh: number | null; warnings: string[] }

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
