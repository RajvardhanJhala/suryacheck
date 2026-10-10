// One line-icon family: 24 grid, 1.75 stroke, round caps/joins, currentColor. No emoji as icons.
const P: Record<string, string> = {
  sun: 'M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9ZM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  arc: 'M3 18a9 9 0 0 1 18 0M2 18h20M15.5 9.2a1.6 1.6 0 1 1 0 .01',
  panel: 'M4 5h16l-2 10H6L4 5ZM9.3 5l-.7 10M14.7 5l.7 10M5 10h14M12 15v4M8 19h8',
  meter: 'M5 3h14v18H5zM8 7h8v4H8zM9 15h.01M12 15h.01M15 15h.01M9 18h6',
  inverter: 'M4 4h16v16H4zM8 8h8v5H8zM8 16.5h3M14 16.5h2',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4zM12 10.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  upload: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v5h16v-5',
  rupee: 'M7 4h10M7 8h10M7 4c4.5 0 6 1.6 6 4s-2 4-6 4l7 8',
  dust: 'M5 17h.01M9 14h.01M8 19h.01M13 17h.01M17 15h.01M16 19.5h.01M12 12h.01M19 11h.01M6 11h.01',
  droplet: 'M12 3s6 6.4 6 10.5a6 6 0 1 1-12 0C6 9.4 12 3 12 3Z',
  wrench: 'M14.5 5.5a4 4 0 0 0 4.9 4.9L21 12l-9 9-3-3 9-9-1.6-1.6a4 4 0 0 0-4.9-4.9L14 5Z',
  bolt: 'M13 2 5 13h6l-1 9 8-11h-6l1-9Z',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18Z',
  shade: 'M12 3v18M12 4a8 8 0 0 1 0 16',
  check: 'M5 12.5 10 17.5 19 7.5',
  alert: 'M12 4 2.5 20h19L12 4ZM12 10v4.5M12 17.5h.01',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM12 11v6M12 7.5h.01',
  phone: 'M5 4h3.5l1.5 4.5-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2L20 15.5V19a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1Z',
  chat: 'M4 5h16v11H9l-5 4V5ZM8 9.5h8M8 12.5h5',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  pin: 'M12 21s-7-6.1-7-11.5a7 7 0 1 1 14 0C19 14.9 12 21 12 21ZM12 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z',
  home: 'M3 11 12 4l9 7M5.5 9.5V20h13V9.5',
  history: 'M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4M12 8v4.5l3 2',
  settings: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5 19.8 7',
  chart: 'M4 4v16h16M8 15l3.5-4 3 2.5L20 7',
  plus: 'M12 5v14M5 12h14',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  logout: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
  globe: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z',
}

export type IconName = keyof typeof P

export function Icon({ name, size = 20, label, className }: { name: IconName; size?: number; label?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" className={className}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={P[name]} />
    </svg>
  )
}
