// Live status in the browser tab: recolour the favicon's sun dot to the verdict colour.
const SUN = '#e8890c'
const TONE: Record<string, string> = { dust: '#b67d2c', clean: '#1d6c74', fault: '#b3361f' }

/** Points every icon link at /favicon.svg with its sun recoloured; returns a function that restores them. */
export function tintFavicon(tone: string): () => void {
  const colour = TONE[tone]
  const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')]
  const saved = links.map((l) => [l.href, l.type] as const)
  let cancelled = false
  if (colour) {
    fetch('/favicon.svg').then((r) => r.text()).then((svg) => {
      if (cancelled) return
      const url = 'data:image/svg+xml,' + encodeURIComponent(svg.split(`fill="${SUN}"`).join(`fill="${colour}"`))
      links.forEach((l) => { l.type = 'image/svg+xml'; l.href = url })
    }).catch(() => { /* keep the normal icon */ })
  }
  return () => { cancelled = true; links.forEach((l, i) => { l.href = saved[i][0]; l.type = saved[i][1] }) }
}
