import { useRef, useState } from 'react'
import { api, ApiError, type Extraction, type Row } from '../api'
import { go } from '../LegacyApp'
import { prepareTiles } from '../image'
import { todayIST } from '../format'

type Mode = 'camera' | 'screenshot' | 'type'

function lastDays(n: number): Row[] {
  const out: Row[] = []
  const today = new Date(todayIST() + 'T00:00:00')
  for (let i = n; i >= 1; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    out.push({ date: d.toISOString().slice(0, 10), kwh: NaN })
  }
  return out
}

export default function AddData({ siteId }: { siteId: string }) {
  const [mode, setMode] = useState<Mode>('camera')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [meter, setMeter] = useState<number | null>(null)
  const [source, setSource] = useState('manual')
  const [warnings, setWarnings] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const readImage = async (file: File | undefined, src: string) => {
    if (!file) return
    setErr(''); setWarnings([]); setStatus('Reading your photo…')
    try {
      const tiles = await prepareTiles(file)
      const ex: Extraction = await api.uploadAndExtract(siteId, tiles)
      setWarnings(ex.warnings)
      if (ex.meter_total_kwh != null) { setMeter(ex.meter_total_kwh); setRows(null) }
      else if (ex.rows.length) { setRows(ex.rows); setSource(src) }
      else setErr("Couldn't find any kWh numbers. Try a sharper photo without glare, or type the numbers in.")
    } catch (e) {
      const fallback = e instanceof ApiError && (e.status === 503 || e.status === 429)
      setErr((e as Error).message)
      if (fallback) { setMode('type'); setRows(lastDays(7)) }
    } finally { setStatus('') }
  }

  const submit = async () => {
    setErr('')
    try {
      if (meter != null) {
        setStatus('Saving meter reading…')
        const r = await api.addMeter(siteId, todayIST(), meter)
        if (!r.saved_days) { setStatus(''); setErr(r.message ?? 'Saved. Take another meter photo in a few days.'); return }
      } else {
        const clean = (rows ?? []).filter((r) => Number.isFinite(r.kwh))
        if (!clean.length) { setErr('Enter at least one day.'); return }
        setStatus('Saving…')
        const r = await api.putReadings(siteId, clean, source)
        if (r.rejected.length) setWarnings(r.rejected.map((x) => `${x.date ?? ''} ${x.reason}`))
      }
      setStatus('Starting the check…')
      await api.startAnalysis(siteId)
      go(`site/${siteId}`)
    } catch (e) {
      setErr((e as Error).message); setStatus('')
    }
  }

  const editRow = (i: number, k: keyof Row, v: string) =>
    setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, [k]: k === 'kwh' ? (v === '' ? NaN : +v) : v } : r)))

  return (
    <div className="panel">
      <h1>Add your daily units</h1>
      <div className="tabs" role="tablist">
        {([['camera', '📷 Photo'], ['screenshot', '🖼 Upload'], ['type', '⌨ Type']] as [Mode, string][]).map(([m, l]) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'tab on' : 'tab'}
            onClick={() => { setMode(m); setErr(''); if (m === 'type' && !rows) setRows(lastDays(7)) }}>{l}</button>
        ))}
      </div>

      {mode === 'camera' && !rows && meter == null && (
        <div className="capture">
          <p>Point your phone at the <b>inverter display</b> (the “Today” or “E-Today” number) or the
            <b> solar generation meter</b>.</p>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => readImage(e.target.files?.[0], 'screenshot')} />
          <button className="btn primary block big" onClick={() => cameraRef.current?.click()} disabled={!!status}>
            📷 Open camera
          </button>
          <p className="hint">Tip: stand straight in front of it, avoid glare, fill the frame with the numbers.</p>
        </div>
      )}

      {mode === 'screenshot' && !rows && meter == null && (
        <div className="capture">
          <p>Open your inverter app's <b>monthly</b> or daily list and take a screenshot. One screenshot gives up to a month of days.</p>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden
            onChange={(e) => readImage(e.target.files?.[0], 'screenshot')} />
          <button className="btn primary block big" onClick={() => fileRef.current?.click()} disabled={!!status}>
            Choose screenshot
          </button>
        </div>
      )}

      {meter != null && (
        <div className="confirm">
          <p>Meter reading today:</p>
          <input className="big-number" inputMode="decimal" value={meter} onChange={(e) => setMeter(+e.target.value)} />
          <p className="hint">Check it matches the meter. Daily units are worked out from two readings a few days apart.</p>
        </div>
      )}

      {rows && (
        <>
          <p className="muted">{mode === 'type' ? 'Type the units (kWh) your inverter shows for each day.'
            : 'Check these numbers against your photo and fix any mistakes.'}</p>
          <table className="rows">
            <thead><tr><th>Date</th><th>kWh</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><input type="date" value={r.date} onChange={(e) => editRow(i, 'date', e.target.value)} /></td>
                  <td><input inputMode="decimal" value={Number.isFinite(r.kwh) ? r.kwh : ''} placeholder="—"
                    onChange={(e) => editRow(i, 'kwh', e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn small" onClick={() => setRows([...rows, { date: todayIST(), kwh: NaN }])}>+ Add a day</button>
        </>
      )}

      {warnings.length > 0 && <ul className="warn-list">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
      {status && <p className="status"><span className="spinner" aria-hidden /> {status}</p>}
      {err && <p className="error">{err}</p>}

      {(rows || meter != null) && (
        <button className="btn primary block" onClick={submit} disabled={!!status}>Looks right — check my roof</button>
      )}
      <p className="hint center">At least 7 clear days are needed for a first verdict.</p>
    </div>
  )
}
