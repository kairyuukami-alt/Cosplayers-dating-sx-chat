'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Nav } from '@/components/nav'
import { createClient } from '@/lib/supabase/client'
import type { SupportMessage } from '@/lib/types'

async function fetchSupportThread() {
  const supabase = createClient()
  const { data: thread, error: threadError } = await supabase.rpc('get_my_support_thread')
  if (threadError) throw threadError
  const id = thread as string
  const { data, error } = await supabase.from('support_messages').select('*').eq('thread_id', id).order('created_at', { ascending: true })
  if (error) throw error
  return { threadId: id, messages: (data ?? []) as SupportMessage[] }
}

export default function SupportPage() {
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchSupportThread()
      .then(result => {
        if (cancelled) return
        setThreadId(result.threadId)
        setMessages(result.messages)
      })
      .catch(error => {
        if (cancelled) return
        setStatus(error instanceof Error ? error.message : 'Could not load support.')
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!threadId) return
    const supabase = createClient()
    const channel = supabase.channel(`support:${threadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `thread_id=eq.${threadId}` }, payload => {
        const incoming = payload.new as SupportMessage
        setMessages(previous => previous.some(item => item.id === incoming.id) ? previous : [...previous, incoming])
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [threadId])

  async function send(event: FormEvent) {
    event.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    const { error } = await createClient().rpc('send_support_message', { message_body: body })
    if (error) setStatus(error.message)
  }

  return (
    <>
      <Nav />
      <main className="page-shell narrow">
        <section className="panel">
          <div className="eyebrow">PLATFORM SUPPORT</div>
          <h1>Talk to the Cosplay Match team.</h1>
          <p className="hero-copy">This is a separate, clearly labeled support conversation with the platform. It is not part of your private dating chats.</p>

          <div className="support-feed">
            {messages.map(message => (
              <article key={message.id} className={`support-message ${message.sender_role === 'user' ? 'mine' : ''}`}>
                <strong>{message.sender_role === 'admin' ? 'Cosplay Match Support' : 'You'}</strong>
                <p>{message.body}</p>
                <time>{new Date(message.created_at).toLocaleString()}</time>
              </article>
            ))}
            {!messages.length && <p className="status">No support messages yet.</p>}
          </div>

          {status && <p className="status">{status}</p>}
          <form className="support-composer" onSubmit={send}>
            <textarea value={text} onChange={event => setText(event.target.value)} maxLength={3000} rows={3} placeholder="Message platform support…" />
            <button className="primary" disabled={!text.trim()}>Send</button>
          </form>
        </section>
      </main>
    </>
  )
}
