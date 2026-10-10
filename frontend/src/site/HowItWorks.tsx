import { Link } from 'react-router'
import { usePageMeta } from '../lib/seo'
import { ArcDivider } from '../ui/arc'
import { Notice } from '../ui/primitives'

export default function HowItWorks() {
  usePageMeta('How it works', 'How SuryaCheck computes expected solar yield, separates dust from weather and faults, and what it cannot know.')
  return (
    <article className="wrap prose">
      <p className="eyebrow">Methodology</p>
      <h1>How SuryaCheck measures your roof</h1>
      <p className="lead">Plain explanations of every number, and an honest list of what we cannot know.</p>

      <h2>1. What your roof should have made</h2>
      <p>For every hour we fetch real sunlight (direct and diffuse), air temperature and wind for your roof's location from
        Open-Meteo. The open-source <strong>pvlib</strong> model turns that into expected output for your system size, tilt and direction:</p>
      <pre className="formula">sunlight on tilted panel  = Hay–Davies transposition(direct, diffuse, sun position)
cell temperature          = Faiman model(sunlight, air temp, wind)
DC power                  = size × sunlight/1000 × (1 − 0.37%/°C × (cell temp − 25))
expected daily kWh        = Σ hours [ DC × (1 − 14% system losses) × 96% inverter ]</pre>

      <h2>2. Your own yardstick</h2>
      <p>Every roof is a little different, so we never judge you against a textbook. We compute a daily
        <strong> performance index</strong> — your units divided by the expected units — and compare it with
        <strong> your own best week</strong> in the last 90 days.</p>
      <pre className="formula">performance index  = actual kWh ÷ expected kWh
% of normal        = performance index ÷ your best 7-day median (90 days)</pre>
      <p>Cloudy days (over 60% cloud), very dim days and heavy-rain days are left out of the verdict, because the weather
        model is least reliable then. They still count towards the money.</p>

      <h2>3. Telling dust from faults and weather</h2>
      <p>Each cause leaves a different signature in the numbers:</p>
      <ul>
        <li><strong>Dust:</strong> a steady slide that starts after the last rain of 5 mm or more (or your last cleaning).
          We need at least 7 clear days, a slope of at least 0.2% a day whose 95% confidence range stays below zero, and a total
          drop of 5–30%.</li>
        <li><strong>String or inverter fault:</strong> a step down of 15% or more within two days that holds for at least three
          clear days.</li>
        <li><strong>Inverter trip:</strong> a clear day with less than 10% of expected output.</li>
        <li><strong>Weather:</strong> nearby systems (within about 5 km) dipped by the same amount. Then it is not your system.</li>
      </ul>
      <p>When two causes score within 0.10 of each other, we say so instead of pretending to be sure.</p>

      <h2>4. The money</h2>
      <pre className="formula">lost kWh per day   = expected × your normal − actual
₹ per month        = average of the last 7 clear days × 30 × your tariff
recovered ₹        = ₹ per month × share of the gap closed after the action</pre>
      <p>We recommend cleaning only when the monthly loss is larger than what a cleaning costs you. Otherwise we tell you to wait
        — which also saves water.</p>

      <ArcDivider />

      <h2>What we cannot know</h2>
      <Notice tone="info" title="Limitations, stated plainly">
        <ul>
          <li>Weather data is modelled, not measured on your roof. On partly cloudy days it can be off by 20% or more, so those days are excluded.</li>
          <li>Daily totals cannot tell shading from other steady losses. Hourly data would.</li>
          <li>Neighbour comparison needs real neighbours. Until enough homes join, the sample system uses simulated neighbours, clearly labelled.</li>
          <li>Reading numbers from photos can misread glare or seven-segment digits. You always confirm the values before analysis.</li>
          <li>Our thresholds were tested on simulated roofs, not yet on a large set of real ones.</li>
        </ul>
      </Notice>

      <h2>Data and licences</h2>
      <p>Weather: <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0, non-commercial
        use). Solar model: <a href="https://pvlib-python.readthedocs.io" target="_blank" rel="noreferrer">pvlib-python</a> (BSD-3).
        Photo reading: Amazon Textract. Places: Amazon Location Service.</p>
      <p><Link className="btn btn-primary" to="/signup">Check my roof</Link></p>
    </article>
  )
}
