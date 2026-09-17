'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Nav } from '@/components/nav'
import { createClient } from '@/lib/supabase/client'
import type { DiscoverProfile } from '@/lib/types'

async function withAvatar(profile: DiscoverProfile) {
  if (!profile.avatar_path) return { ...profile, avatar_url: null }
  const supabase = createClient()
  const { data } = await supabase.storage.from('profile-media').createSignedUrl(profile.avatar_path, 3600)
  return { ...profile, avatar_url: data?.signedUrl ?? null }
}

async function fetchDiscoverProfiles() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { destination: '/login' as const, profiles: [] as DiscoverProfile[] }

  const { data: ownProfile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (!ownProfile) return { destination: '/onboarding' as const, profiles: [] as DiscoverProfile[] }

  const { data, error } = await supabase.rpc('discover_profiles', { limit_count: 25 })
  if (error) throw error
  const hydrated = await Promise.all(((data ?? []) as DiscoverProfile[]).map(withAvatar))
  return { destination: null, profiles: hydrated }
}

export default function DiscoverPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [matched, setMatched] = useState<DiscoverProfile | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchDiscoverProfiles()
      .then(result => {
        if (cancelled) return
        if (result.destination) {
          router.replace(result.destination)
          return
        }
        setProfiles(result.profiles)
        setLoading(false)
      })
      .catch(error => {
        if (cancelled) return
        setStatus(error instanceof Error ? error.message : 'Could not load profiles.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [router])

  async function reload() {
    setLoading(true)
    setStatus('')
    try {
      const result = await fetchDiscoverProfiles()
      if (result.destination) return router.replace(result.destination)
      setProfiles(result.profiles)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load profiles.')
    } finally {
      setLoading(false)
    }
  }

  async function swipe(decision: 'like' | 'pass') {
    const current = profiles[0]
    if (!current) return
    setStatus('')
    const supabase = createClient()
    const { data: matchId, error } = await supabase.rpc('swipe_profile', {
      target_user: current.id,
      swipe_decision: decision,
    })
    if (error) return setStatus(error.message)
    setProfiles(previous => previous.slice(1))
    if (decision === 'like' && matchId) setMatched(current)
  }

  const current = profiles[0]

  return (
    <>
      <Nav />
      <main className="page-shell discover-shell">
        <header className="section-heading">
          <div><div className="eyebrow">DISCOVER</div><h1>Find your co-star.</h1></div>
          <p>Profiles shown here match both people&apos;s stated dating preference.</p>
        </header>

        {loading ? <section className="panel discover-empty">Loading profiles…</section> : current ? (
          <section className="swipe-card">
            <div className="swipe-photo" style={current.avatar_url ? { backgroundImage: `url(${current.avatar_url})` } : undefined}>
              {!current.avatar_url && <span>{current.display_name.slice(0, 1).toUpperCase()}</span>}
              <div className="photo-gradient" />
              <div className="photo-meta"><strong>{current.display_name}, {current.age}</strong><span>@{current.username}{current.city ? ` · ${current.city}` : ''}</span></div>
            </div>
            <div className="swipe-details">
              <p className="bio">{current.bio || 'This cosplayer has not written a bio yet.'}</p>
              <h3>Cosplays</h3>
              <div className="tag-row">{current.cosplay_characters.length ? current.cosplay_characters.map(v => <span key={v}>🎭 {v}</span>) : <span>Still building the closet</span>}</div>
              <h3>Fandoms</h3>
              <div className="tag-row muted">{current.fandoms.map(v => <span key={v}>#{v}</span>)}</div>
              <div className="swipe-actions"><button className="pass-button" onClick={() => swipe('pass')} aria-label="Pass">✕</button><button className="like-button" onClick={() => swipe('like')} aria-label="Like">♥</button></div>
              {status && <p className="status">{status}</p>}
            </div>
          </section>
        ) : (
          <section className="panel discover-empty"><div className="eyebrow">YOU&apos;RE CAUGHT UP</div><h2>No new profiles right now.</h2><p>As new compatible cosplayers join, they will appear here.</p><button className="secondary" onClick={reload}>Check again</button></section>
        )}
      </main>

      {matched && <div className="match-overlay"><div className="match-modal"><div className="eyebrow">IT&apos;S A MATCH</div><h2>You and {matched.display_name} chose each other.</h2><p>Chat is unlocked for this mutual match.</p><div className="hero-actions"><Link className="primary" href="/matches">Open matches</Link><button className="secondary" onClick={() => setMatched(null)}>Keep discovering</button></div></div></div>}
    </>
  )
}
