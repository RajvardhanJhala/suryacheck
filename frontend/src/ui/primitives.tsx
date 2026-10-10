import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import { reducedMotion } from './arc'

/** Instrument reading: monospaced tabular figures that count up when they scroll into view. */
export function Reading({ value, unit, prefix, decimals = 0, size = 'lg', tone }: {
  value: number; unit?: string; prefix?: string; decimals?: number; size?: 'md' | 'lg' | 'xl'
  tone?: 'dust' | 'clean' | 'sun'
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(reducedMotion() ? value : 0)
  useEffect(() => {
    if (reducedMotion()) { setShown(value); return }
    const el = ref.current
    if (!el) return
    let raf = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / 900)
        setShown(value * (1 - Math.pow(1 - k, 3)))
        if (k < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, { threshold: 0.3 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value])
  const text = shown.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return (
    <span ref={ref} className={`reading ${size}${tone ? ` is-${tone}` : ''}`}>
      {prefix}{text}{unit && <small>{unit}</small>}
    </span>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; icon?: IconName; block?: boolean }
export function Button({ variant = 'primary', icon, block, className = '', children, ...rest }: BtnProps) {
  return (
    <button className={`btn btn-${variant}${block ? ' btn-block' : ''} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={18} />}{children}
    </button>
  )
}

export function Card({ children, className = '', as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <Tag className={`card ${className}`}>{children}</Tag>
}

/** Badges always carry text; colour only reinforces it. */
export function Badge({ tone = 'neutral', icon, children }: { tone?: 'neutral' | 'dust' | 'clean' | 'fault' | 'sun'; icon?: IconName; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{icon && <Icon name={icon} size={14} />}{children}</span>
}

export function Field({ label, hint, error, id, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; id: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={!!error} aria-describedby={hint || error ? `${id}-help` : undefined} {...input} />
      {(error || hint) && <p id={`${id}-help`} className={error ? 'field-error' : 'field-hint'}>{error ?? hint}</p>}
    </div>
  )
}

/** Inline state message: success / error / info, always with an icon and words. */
export function Notice({ tone, title, children }: { tone: 'clean' | 'fault' | 'info' | 'dust'; title: string; children?: ReactNode }) {
  const icon: IconName = tone === 'clean' ? 'check' : tone === 'fault' ? 'alert' : tone === 'dust' ? 'dust' : 'info'
  return (
    <div className={`notice notice-${tone}`} role={tone === 'fault' ? 'alert' : 'status'}>
      <Icon name={icon} size={20} />
      <div><strong>{title}</strong>{children && <div className="notice-body">{children}</div>}</div>
    </div>
  )
}
