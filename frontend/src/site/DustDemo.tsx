import { useId, useState } from 'react'
import { Icon } from '../ui/icons'

// Illustration only: the sample roof (3 kW, Chandkheda) loses about 14% to a dry spell's dust,
// worth about ₹366 a month at ₹6/unit. Cleaning fraction f scales that linearly.
const FULL_LOSS = 0.14
const FULL_LOSS_INR = 366

const COLS = 4, ROWS = 2, W = 400, H = 220, GAP = 6
const modW = (W - GAP * (COLS + 1)) / COLS, modH = (H - GAP * (ROWS + 1)) / ROWS

// Fixed speckle field (deterministic, so the dust never "jumps").
const SPECKS = Array.from({ length: 420 }, (_, i) => {
  const r = Math.sin(i * 12.9898) * 43758.5453, s = Math.sin(i * 78.233) * 12345.6789
  return { x: (r - Math.floor(r)) * W, y: (s - Math.floor(s)) * H, r: 0.6 + ((i * 7) % 5) * 0.35 }
})

export default function DustDemo() {
  const [cleaned, setCleaned] = useState(15)   // % of the array wiped clean, from the left
  const id = useId()
  const f = cleaned / 100
  const output = Math.round((1 - FULL_LOSS * (1 - f)) * 100)
  const lostInr = Math.round(FULL_LOSS_INR * (1 - f))
  const x = W * f

  return (
    <figure className="dust-demo">
      <div className="dust-stage">
        <svg viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Solar panel array, ${cleaned}% cleaned. Output ${output}% of normal, ₹${lostInr} lost per month.`}>
          <defs>
            <clipPath id={`${id}-dirty`}><rect x={x} y="0" width={W - x} height={H} /></clipPath>
          </defs>
          <rect width={W} height={H} rx="10" fill="#2b3640" />
          {Array.from({ length: COLS * ROWS }, (_, i) => {
            const cx = GAP + (i % COLS) * (modW + GAP), cy = GAP + Math.floor(i / COLS) * (modH + GAP)
            return (
              <g key={i}>
                <rect x={cx} y={cy} width={modW} height={modH} rx="3" fill="#1f4a6b" />
                {[1, 2, 3, 4, 5].map((k) => <line key={`v${k}`} x1={cx + (modW * k) / 6} y1={cy} x2={cx + (modW * k) / 6} y2={cy + modH} stroke="#3d6d91" strokeWidth=".8" />)}
                {[1, 2, 3].map((k) => <line key={`h${k}`} x1={cx} y1={cy + (modH * k) / 4} x2={cx + modW} y2={cy + (modH * k) / 4} stroke="#3d6d91" strokeWidth=".8" />)}
                <line x1={cx + 4} y1={cy + 4} x2={cx + modW * 0.45} y2={cy + 4} stroke="#ffffff" strokeOpacity=".18" strokeWidth="2" />
              </g>
            )
          })}
          <g clipPath={`url(#${id}-dirty)`} className="dust-layer">
            <rect width={W} height={H} rx="10" fill="#b8915a" opacity=".42" />
            {SPECKS.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#d9c29a" opacity=".75" />)}
          </g>
          <line x1={x} y1="0" x2={x} y2={H} stroke="var(--sun)" strokeWidth="3" />
          <circle cx={x} cy={H / 2} r="13" fill="var(--sun)" stroke="#fff" strokeWidth="2" />
          <path d={`M ${x - 4} ${H / 2 - 4} l -4 4 4 4 M ${x + 4} ${H / 2 - 4} l 4 4 -4 4`} stroke="#1f1b14" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <label htmlFor={`${id}-range`} className="sr-only">Drag to clean the panels</label>
        <input id={`${id}-range`} className="dust-range" type="range" min={0} max={100} value={cleaned}
          onChange={(e) => setCleaned(+e.target.value)} />
      </div>
      <figcaption className="dust-readout">
        <div>
          <span className="eyebrow">Output vs sunshine</span>
          <span className={`reading md ${output >= 97 ? 'is-clean' : 'is-dust'}`}>{output}<small>%</small></span>
        </div>
        <div>
          <span className="eyebrow">Lost per month</span>
          <span className={`reading md ${lostInr > 0 ? 'is-dust' : 'is-clean'}`}>₹{lostInr}</span>
        </div>
        <p className="dust-hint muted"><Icon name="arrowRight" size={16} /> Drag the handle to clean. Illustration based on the sample
          roof: 3 kW in Chandkheda after 20 dry days.</p>
      </figcaption>
    </figure>
  )
}
