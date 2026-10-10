import { useEffect } from 'react'

/** Per-page title and description (SPA: set on navigation). */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title === 'SuryaCheck' ? title : `${title} · SuryaCheck`
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  }, [title, description])
}
