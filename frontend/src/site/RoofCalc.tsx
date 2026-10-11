import { useId, useState } from 'react'
import { Link } from 'react-router'
import { cumulative, soilingAfter } from '../lib/money'
import { todayIST } from '../lib/verdict'
import { RATE } from './dustScene'

const KWH_PER_KWP = 4.8      // a clean Ahmedabad roof in October (the sample: 14.4 kWh/day from 3 kWp)

/** Rough cost of dust for your roof, from the same soiling model the report uses. */
export default function RoofCalc() {
  const id = useId()
  const [kwp, setKwp] = useState(3), [days, setDays] = useState(20), [tariff, setTariff] = useState(6)
  const loss = soilingAfter(0, RATE, days)
  const month = Math.round(loss * kwp * KWH_PER_KWP * tariff * 30)
  const year = Math.round(cumulative({ normalKwh: kwp * KWH_PER_KWP, lossNow: loss, dustRate: RATE, tariff, cleaningCost: 0, today: todayIST() }, null)[364])
  const inr = (n: number) => '₹' + n.toLocaleString('en-IN')
  const slider = (key: string, label: string, value: number, set: (v: number) => void, min: number, max: number, step: number, show: string) => (
    <div className="calc-field">
      <label htmlFor={`${id}-${key}`}>{label} <b className="reading">{show}</b></label>
      <input id={`${id}-${key}`} type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)} />
    </div>
  )
  return (
    <div className="calc">
      <div className="calc-inputs">
        {slider('kwp', 'System size', kwp, setKwp, 1, 10, 0.5, `${kwp} kWp`)}
        {slider('days', 'Days since rain or cleaning', days, setDays, 0, 45, 1, `${days}`)}
        {slider('tariff', 'Electricity rate', tariff, setTariff, 3, 12, 0.5, `₹${tariff}/unit`)}
      </div>
      <output className="calc-out" htmlFor={`${id}-kwp ${id}-days ${id}-tariff`} aria-live="polite">
        <span><span className="eyebrow">Lost per month</span><span className="reading lg is-dust">{inr(month)}</span></span>
        <span><span className="eyebrow">Next 12 months if left</span><span className="reading lg is-dust">{inr(year)}</span></span>
      </output>
      <p className="muted small">Estimate: dust at 0.6% a day, up to 30%; monsoon rain washes it. <Link to="/test">Test your roof</Link> for your real number.</p>
    </div>
  )
}
