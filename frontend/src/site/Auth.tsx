import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { auth, authMessage } from '../lib/auth'
import { usePageMeta } from '../lib/seo'
import { LogoMark } from '../ui/arc'
import { Button, Field, Notice } from '../ui/primitives'

type Mode = 'login' | 'signup' | 'forgot'
type Stage = 'form' | 'confirm' | 'reset'

const TITLES: Record<Mode, string> = { login: 'Log in', signup: 'Create your account', forgot: 'Reset your password' }

export default function Auth({ mode }: { mode: Mode }) {
  usePageMeta(TITLES[mode], 'Log in to SuryaCheck to check your rooftop solar.')
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/app') ? params.get('next')! : '/app'
  const [stage, setStage] = useState<Stage>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')

  const run = (fn: () => Promise<void>) => async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(''); setInfo('')
    try { await fn() } catch (x) { setErr(authMessage(x)) } finally { setBusy(false) }
  }

  const login = run(async () => {
    const r = await auth.signIn(email, password)
    if (r.nextStep.signInStep === 'CONFIRM_SIGN_UP') { await auth.resendCode(email); setStage('confirm'); return }
    nav(next, { replace: true })
  })
  const signup = run(async () => { await auth.signUp(email, password); setStage('confirm'); setInfo(`We sent a 6-digit code to ${email}.`) })
  const confirm = run(async () => { await auth.confirmSignUp(email, code); await auth.signIn(email, password); nav('/app/settings?welcome=1', { replace: true }) })
  const forgot = run(async () => { await auth.resetPassword(email); setStage('reset'); setInfo(`If ${email} has an account, a code is on its way.`) })
  const reset = run(async () => { await auth.confirmReset(email, code, password); setStage('form'); setInfo('Password changed. Log in with it now.'); nav('/login', { replace: true }) })

  const pwHint = 'At least 8 characters, with a lowercase letter and a number.'
  return (
    <div className="auth wrap">
      <div className="auth-card card">
        <LogoMark size={44} />
        {stage === 'form' && mode === 'login' && (
          <form onSubmit={login} noValidate>
            <h1>Log in</h1>
            <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field id="password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            {err && <Notice tone="fault" title={err} />}
            {info && <Notice tone="clean" title={info} />}
            <Button block disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</Button>
            <p className="auth-links"><Link to="/forgot">Forgot password?</Link><Link to="/signup">Create an account</Link></p>
          </form>
        )}
        {stage === 'form' && mode === 'signup' && (
          <form onSubmit={signup} noValidate>
            <h1>Check your roof</h1>
            <p className="muted">Free. We only use your email to log you in.</p>
            <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field id="password" label="Password" type="password" autoComplete="new-password" required hint={pwHint} value={password} onChange={(e) => setPassword(e.target.value)} />
            {err && <Notice tone="fault" title={err} />}
            <Button block disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
            <p className="auth-links"><span className="muted">Already have one?</span><Link to="/login">Log in</Link></p>
          </form>
        )}
        {stage === 'confirm' && (
          <form onSubmit={confirm} noValidate>
            <h1>Check your email</h1>
            {info && <p className="muted">{info}</p>}
            <Field id="code" label="6-digit code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value.trim())} />
            {err && <Notice tone="fault" title={err} />}
            <Button block disabled={busy}>{busy ? 'Checking…' : 'Confirm and continue'}</Button>
            <p className="auth-links"><button type="button" className="linklike" onClick={() => auth.resendCode(email).then(() => setInfo('New code sent.'))}>Send a new code</button></p>
          </form>
        )}
        {stage === 'form' && mode === 'forgot' && (
          <form onSubmit={forgot} noValidate>
            <h1>Reset your password</h1>
            <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            {err && <Notice tone="fault" title={err} />}
            <Button block disabled={busy}>{busy ? 'Sending…' : 'Send reset code'}</Button>
            <p className="auth-links"><Link to="/login">Back to log in</Link></p>
          </form>
        )}
        {stage === 'reset' && (
          <form onSubmit={reset} noValidate>
            <h1>Choose a new password</h1>
            {info && <p className="muted">{info}</p>}
            <Field id="code" label="Code from the email" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value.trim())} />
            <Field id="password" label="New password" type="password" autoComplete="new-password" required hint={pwHint} value={password} onChange={(e) => setPassword(e.target.value)} />
            {err && <Notice tone="fault" title={err} />}
            <Button block disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</Button>
          </form>
        )}
      </div>
    </div>
  )
}
