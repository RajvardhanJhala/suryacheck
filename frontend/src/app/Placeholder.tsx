import { Link } from 'react-router'
import { usePageMeta } from '../lib/seo'
import { SetSun } from '../site/NotFound'

/** Branded empty state; screens are filled in step 3. */
export default function Placeholder({ title }: { title: string }) {
  usePageMeta(title)
  return (
    <section className="empty">
      <SetSun size={180} />
      <h1>{title}</h1>
      <p className="muted">Nothing here yet. Start with a check of your roof.</p>
      <Link className="btn btn-primary" to="/app/check">Start a new check</Link>
    </section>
  )
}
