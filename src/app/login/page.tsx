'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const supabase = createClient()

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else if (data.session) router.push('/onboarding')
      else setMessage('Check your email to confirm your account, then sign in.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
      else router.push('/discover')
    }
    setBusy(false)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">COSPLAY//MATCH</Link>
        <div className="segmented">
          <button className={mode === 'signup' ? 'selected' : ''} onClick={() => setMode('signup')}>Create account</button>
          <button className={mode === 'signin' ? 'selected' : ''} onClick={() => setMode('signin')}>Sign in</button>
        </div>
        <form onSubmit={submit} className="stack">
          <label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
          <label>Password<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
          <button className="primary full" disabled={busy}>{busy ? 'Working…' : mode === 'signup' ? 'Create 18+ account' : 'Sign in'}</button>
        </form>
        {message && <p className="status">{message}</p>}
        <p className="fine-print">By creating an account, you confirm you are at least 18 years old.</p>
      </section>
    </main>
  )
}
