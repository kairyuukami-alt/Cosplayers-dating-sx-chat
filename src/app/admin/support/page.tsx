'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { AdminDirectoryUser, SupportMessage } from '@/lib/types'

async function fetchDirectory(term = '') {
  const { data, error } = await createClient().rpc('admin_directory', { search_term: term || null })
  if (error) throw error
  return (data ?? []) as AdminDirectoryUser[]
}

async function fetchSupportMessages(threadId: string) {
  const { data, error } = await createClient().from('support_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as SupportMessage[]
}

export default function AdminSupportPage() {
  const [users, setUsers] = useState<AdminDirectoryUser[]>([])
  const [selected, setSelected] = useState<AdminDirectoryUser | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [query, setQuery] = useState('')
  const [text, setText] = useState('')
  const [status, setStatus] = useState('Checking admin access…')

  useEffect(() => {
    let cancelled = false
    fetchDirectory()
      .then(data => {
        if (cancelled) return
        setUsers(data)
        setStatus('')
      })
      .catch(error => {
        if (cancelled) return
        setUsers([])
        setStatus(error instanceof Error ? error.message : 'Admin access required')
      })
    return () => { cancelled = true }
  }, [])

  async function search(term = '') {
    try {
      setUsers(await fetchDirectory(term))
      setStatus('')
    } catch (error) {
      setUsers([])
      setStatus(error instanceof Error ? error.message : 'Search failed')
    }
  }

  async function openUser(user: AdminDirectoryUser) {
    setSelected(user)
    setMessages([])
    setStatus('')
    if (!user.support_thread_id) return
    try {
      setMessages(await fetchSupportMessages(user.support_thread_id))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load support messages')
    }
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault()
    await search(query.trim())
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!selected || !text.trim()) return
    const body = text.trim()
    setText('')
    const { error } = await createClient().rpc('admin_send_support', {
      target_user: selected.user_id,
      message_body: body,
    })
    if (error) return setStatus(error.message)

    const refreshedList = await fetchDirectory(selected.username)
    const refreshed = refreshedList.find(item => item.user_id === selected.user_id) ?? selected
    setSelected(refreshed)
    if (refreshed.support_thread_id) setMessages(await fetchSupportMessages(refreshed.support_thread_id))
  }

  return (
    <main className="page-shell">
      <header className="section-heading">
        <div><div className="eyebrow">CREATOR CONSOLE</div><h1>Platform support inbox.</h1></div>
        <p>This console can contact any registered user through a clearly labeled support channel. It does not expose private dating conversations.</p>
      </header>

      <section className="admin-support-grid">
        <aside className="panel compact">
          <Link className="ghost small" href="/discover">← App</Link>
          <form className="stack" onSubmit={submitSearch}>
            <label>Find user<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Username or display name" /></label>
            <button className="secondary">Search</button>
          </form>
          <div className="admin-user-list">
            {users.map(user => (
              <button key={user.user_id} onClick={() => void openUser(user)} className={selected?.user_id === user.user_id ? 'selected' : ''}>
                <strong>{user.display_name}</strong><span>@{user.username}{user.city ? ` · ${user.city}` : ''}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel compact">
          {selected ? <>
            <div className="eyebrow">PLATFORM SUPPORT</div>
            <h2>{selected.display_name} <small>@{selected.username}</small></h2>
            <div className="support-feed admin-feed">
              {messages.map(message => (
                <article key={message.id} className={`support-message ${message.sender_role === 'admin' ? 'mine' : ''}`}>
                  <strong>{message.sender_role === 'admin' ? 'You · Support' : selected.display_name}</strong>
                  <p>{message.body}</p>
                  <time>{new Date(message.created_at).toLocaleString()}</time>
                </article>
              ))}
              {!messages.length && <p className="status">No support conversation yet. You can start one below.</p>}
            </div>
            <form className="support-composer" onSubmit={send}>
              <textarea rows={3} maxLength={3000} value={text} onChange={event => setText(event.target.value)} placeholder={`Message ${selected.display_name} as platform support…`} />
              <button className="primary" disabled={!text.trim()}>Send as Support</button>
            </form>
          </> : <div className="discover-empty"><h2>Select a user.</h2><p>Search or choose someone from the directory to open their platform-support thread.</p></div>}
          {status && <p className="status">{status}</p>}
        </section>
      </section>
    </main>
  )
}
