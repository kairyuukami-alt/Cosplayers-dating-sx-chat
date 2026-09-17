'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { Nav } from '@/components/nav'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (!active) return
      if (!data) {
        window.location.href = '/onboarding'
        return
      }
      setProfile(data as Profile)
      if (data.avatar_path) {
        const { data: signed } = await supabase.storage.from('profile-media').createSignedUrl(data.avatar_path, 3600)
        if (signed?.signedUrl) setAvatarUrl(signed.signedUrl)
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !profile) return
    if (!file.type.startsWith('image/')) return setStatus('Please choose an image file.')
    if (file.size > 8 * 1024 * 1024) return setStatus('Avatar must be under 8 MB.')

    setStatus('Uploading…')
    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${profile.id}/avatar-${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('profile-media').upload(path, file, { upsert: false })
    if (uploadError) return setStatus(uploadError.message)
    const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', profile.id)
    if (error) return setStatus(error.message)
    const { data: signed } = await supabase.storage.from('profile-media').createSignedUrl(path, 3600)
    setAvatarUrl(signed?.signedUrl ?? null)
    setProfile({ ...profile, avatar_path: path })
    setStatus('Avatar updated.')
  }

  return (
    <>
      <Nav />
      <main className="page-shell">
        {loading ? <div className="panel">Loading profile…</div> : profile && (
          <section className="profile-layout">
            <article className="profile-card large">
              <div className="avatar-stage" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}>
                {!avatarUrl && <span>{profile.display_name.slice(0, 1).toUpperCase()}</span>}
              </div>
              <div>
                <div className="eyebrow">@{profile.username}</div>
                <h1>{profile.display_name}</h1>
                <p>{profile.city || 'Location not set'}</p>
                <p className="bio">{profile.bio || 'No bio yet.'}</p>
                <div className="tag-row">{profile.cosplay_characters.map(v => <span key={v}>🎭 {v}</span>)}</div>
                <div className="tag-row muted">{profile.fandoms.map(v => <span key={v}>#{v}</span>)}</div>
              </div>
            </article>
            <aside className="panel compact">
              <h2>Profile controls</h2>
              <label className="upload">Upload avatar<input type="file" accept="image/*" onChange={uploadAvatar} /></label>
              <Link className="secondary full center" href="/onboarding">Edit profile</Link>
              {status && <p className="status">{status}</p>}
              <p className="fine-print">Profile media is stored in a private bucket and served through temporary signed links.</p>
            </aside>
          </section>
        )}
      </main>
    </>
  )
}
