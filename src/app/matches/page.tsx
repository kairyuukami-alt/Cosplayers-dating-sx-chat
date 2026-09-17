'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Nav } from '@/components/nav'
import { createClient } from '@/lib/supabase/client'
import type { MatchSummary } from '@/lib/types'

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('my_matches')
      if (error) {
        setStatus(error.message)
        setLoading(false)
        return
      }
      const hydrated = await Promise.all(((data ?? []) as MatchSummary[]).map(async match => {
        if (!match.avatar_path) return { ...match, avatar_url: null }
        const { data: signed } = await supabase.storage.from('profile-media').createSignedUrl(match.avatar_path, 3600)
        return { ...match, avatar_url: signed?.signedUrl ?? null }
      }))
      setMatches(hydrated)
      setLoading(false)
    })()
  }, [])

  return (
    <>
      <Nav />
      <main className="page-shell">
        <header className="section-heading"><div><div className="eyebrow">MATCHES</div><h1>Your mutual connections.</h1></div><p>Only people who liked each other can open a conversation.</p></header>
        {loading ? <section className="panel">Loading matches…</section> : matches.length ? (
          <section className="match-grid">
            {matches.map(match => (
              <Link className="match-card" key={match.match_id} href={`/chat/${match.match_id}`}>
                <div className="match-avatar" style={match.avatar_url ? { backgroundImage: `url(${match.avatar_url})` } : undefined}>{!match.avatar_url && match.display_name.slice(0,1).toUpperCase()}</div>
                <div><strong>{match.display_name}, {match.age}</strong><span>{match.city || `@${match.username}`}</span><small>{match.cosplay_characters.slice(0,2).join(' · ') || 'Cosplayer'}</small></div>
                <b>Chat →</b>
              </Link>
            ))}
          </section>
        ) : <section className="panel discover-empty"><h2>No matches yet.</h2><p>Mutual likes will appear here.</p><Link className="primary" href="/discover">Discover people</Link></section>}
        {status && <p className="status">{status}</p>}
      </main>
    </>
  )
}
