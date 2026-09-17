'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Gender } from '@/lib/types'

function yearsOld(date: string) {
  const birth = new Date(`${date}T00:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export default function OnboardingPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState<Gender>('man')
  const [interestedIn, setInterestedIn] = useState<Gender>('woman')
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')
  const [characters, setCharacters] = useState('')
  const [fandoms, setFandoms] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setInterestedIn(gender === 'man' ? 'woman' : 'man')
  }, [gender])

  const isAdult = useMemo(() => dob ? yearsOld(dob) >= 18 : false, [dob])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!isAdult) return setMessage('You must be at least 18 years old to use this app.')
    setBusy(true)
    setMessage('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      display_name: displayName.trim(),
      username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
      date_of_birth: dob,
      gender,
      interested_in: interestedIn,
      city: city.trim() || null,
      bio: bio.trim() || null,
      cosplay_characters: characters.split(',').map(v => v.trim()).filter(Boolean),
      fandoms: fandoms.split(',').map(v => v.trim()).filter(Boolean),
    })

    if (error) {
      setMessage(error.message)
      setBusy(false)
      return
    }
    router.replace('/profile')
  }

  return (
    <main className="page-shell narrow">
      <section className="panel">
        <div className="eyebrow">CREATE YOUR PROFILE</div>
        <h1>Who are you when the wig comes off?</h1>
        <form className="form-grid" onSubmit={save}>
          <label>Display name<input required maxLength={50} value={displayName} onChange={e => setDisplayName(e.target.value)} /></label>
          <label>Username<input required pattern="[A-Za-z0-9_]+" maxLength={24} value={username} onChange={e => setUsername(e.target.value)} placeholder="cosplay_handle" /></label>
          <label>Date of birth<input required type="date" value={dob} onChange={e => setDob(e.target.value)} /></label>
          <label>Gender<select value={gender} onChange={e => setGender(e.target.value as Gender)}><option value="man">Man</option><option value="woman">Woman</option></select></label>
          <label>Looking for<select value={interestedIn} onChange={e => setInterestedIn(e.target.value as Gender)}><option value="woman">Women</option><option value="man">Men</option></select></label>
          <label>City<input maxLength={80} value={city} onChange={e => setCity(e.target.value)} /></label>
          <label className="span-2">Cosplay characters <span>(comma separated)</span><input value={characters} onChange={e => setCharacters(e.target.value)} placeholder="Makima, Gojo, Frieren" /></label>
          <label className="span-2">Fandoms <span>(comma separated)</span><input value={fandoms} onChange={e => setFandoms(e.target.value)} placeholder="Chainsaw Man, JJK, Frieren" /></label>
          <label className="span-2">Bio<textarea maxLength={500} rows={5} value={bio} onChange={e => setBio(e.target.value)} placeholder="Conventions, crafting, photography, games…" /></label>
          <button className="primary span-2" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        </form>
        {message && <p className="status">{message}</p>}
      </section>
    </main>
  )
}
