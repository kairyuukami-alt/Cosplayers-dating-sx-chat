'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ChatMessage, MatchContext } from '@/lib/types'

async function hydrateMessage(message: ChatMessage, me?: string | null) {
  if (!message.media_path) return { ...message, media_url: null }
  if (message.view_once && message.sender_id !== me) return { ...message, media_url: null }
  const supabase = createClient()
  const { data } = await supabase.storage.from('chat-media').createSignedUrl(message.media_path, 3600)
  return { ...message, media_url: data?.signedUrl ?? null }
}

async function fetchChatData(matchId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { destination: '/login' as const, me: null, context: null, messages: [] as ChatMessage[] }

  const { data: contextData, error: contextError } = await supabase.rpc('get_match_context', { target_match: matchId })
  if (contextError) throw contextError
  if (!contextData?.length) return { destination: '/matches' as const, me: user.id, context: null, messages: [] as ChatMessage[] }

  const rawContext = contextData[0] as MatchContext
  if (rawContext.avatar_path) {
    const { data: signed } = await supabase.storage.from('profile-media').createSignedUrl(rawContext.avatar_path, 3600)
    rawContext.avatar_url = signed?.signedUrl ?? null
  }

  const { data: messageData, error: messageError } = await supabase.from('messages').select('*').eq('match_id', matchId).order('created_at', { ascending: true })
  if (messageError) throw messageError
  const messages = await Promise.all(((messageData ?? []) as ChatMessage[]).map(message => hydrateMessage(message, user.id)))
  return { destination: null, me: user.id, context: rawContext, messages }
}

export default function ChatPage() {
  const params = useParams<{ matchId: string }>()
  const matchId = params.matchId
  const router = useRouter()
  const [me, setMe] = useState<string | null>(null)
  const [context, setContext] = useState<MatchContext | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const [viewOnce, setViewOnce] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchChatData(matchId)
      .then(result => {
        if (cancelled) return
        if (result.destination) {
          router.replace(result.destination)
          return
        }
        setMe(result.me)
        setContext(result.context)
        setMessages(result.messages)
      })
      .catch(error => {
        if (cancelled) return
        setStatus(error instanceof Error ? error.message : 'Could not load this conversation.')
      })
    return () => { cancelled = true }
  }, [matchId, router])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`match:${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` }, async payload => {
        const incoming = await hydrateMessage(payload.new as ChatMessage, me)
        setMessages(previous => previous.some(item => item.id === incoming.id) ? previous : [...previous, incoming])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` }, payload => {
        const removed = payload.old as { id?: string }
        if (removed.id) setMessages(previous => previous.filter(item => item.id !== removed.id))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [matchId, me])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(event: FormEvent) {
    event.preventDefault()
    const body = text.trim()
    if (!body || !me) return
    setText('')
    const { error } = await createClient().from('messages').insert({ match_id: matchId, sender_id: me, body, message_type: 'text' })
    if (error) setStatus(error.message)
  }

  async function uploadMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !me) return
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) return setStatus('Choose an image or video file.')
    if (file.size > 25 * 1024 * 1024) return setStatus('Media must be 25 MB or smaller.')

    setUploading(true)
    setStatus('')
    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() || (isImage ? 'jpg' : 'mp4')
    const path = `${matchId}/${me}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('chat-media').upload(path, file)
    if (uploadError) {
      setUploading(false)
      return setStatus(uploadError.message)
    }
    const { error: messageError } = await supabase.from('messages').insert({
      match_id: matchId,
      sender_id: me,
      message_type: isImage ? 'image' : 'video',
      media_path: path,
      view_once: viewOnce,
    })
    setUploading(false)
    if (messageError) {
      await supabase.storage.from('chat-media').remove([path])
      setStatus(messageError.message)
      return
    }
    setViewOnce(false)
  }

  async function openViewOnce(message: ChatMessage) {
    if (!message.media_path || message.sender_id === me || message.viewed_at) return
    const supabase = createClient()
    const { data: signed, error: signError } = await supabase.storage.from('chat-media').createSignedUrl(message.media_path, 60)
    if (signError || !signed?.signedUrl) return setStatus(signError?.message || 'Media is unavailable.')

    const { error: consumeError } = await supabase.rpc('consume_view_once_media', { target_message: message.id })
    if (consumeError) return setStatus(consumeError.message)

    setMessages(previous => previous.map(item => item.id === message.id ? { ...item, viewed_at: new Date().toISOString(), media_url: signed.signedUrl } : item))
    window.setTimeout(() => {
      setMessages(previous => previous.map(item => item.id === message.id ? { ...item, media_url: null } : item))
    }, 60000)
  }

  async function deleteMessage(message: ChatMessage) {
    if (message.sender_id !== me || !window.confirm('Delete this message for both people?')) return
    const supabase = createClient()
    if (message.media_path) {
      const { error: mediaError } = await supabase.storage.from('chat-media').remove([message.media_path])
      if (mediaError) return setStatus(mediaError.message)
    }
    const { error } = await supabase.from('messages').delete().eq('id', message.id)
    if (error) return setStatus(error.message)
    setMessages(previous => previous.filter(item => item.id !== message.id))
  }

  async function reportUser() {
    if (!context) return
    const details = window.prompt('Briefly describe what happened. Do not include passwords or other sensitive information.')
    if (details === null) return
    const { error } = await createClient().rpc('report_user', {
      reported_user: context.other_user_id,
      report_reason: 'inappropriate_behavior',
      report_details: details.trim().slice(0, 1000),
    })
    setStatus(error ? error.message : 'Report submitted. Thank you.')
  }

  async function blockUser() {
    if (!context || !window.confirm(`Block ${context.display_name}? This will remove the match and close this conversation.`)) return
    const { error } = await createClient().rpc('block_user', { blocked_user: context.other_user_id })
    if (error) return setStatus(error.message)
    router.replace('/matches')
    router.refresh()
  }

  const title = useMemo(() => context?.display_name || 'Chat', [context])

  return (
    <main className="chat-shell">
      <header className="chat-header">
        <Link href="/matches" className="back-link">← Matches</Link>
        <div className="chat-person">
          <div className="mini-avatar" style={context?.avatar_url ? { backgroundImage: `url(${context.avatar_url})` } : undefined}>{!context?.avatar_url && title.slice(0,1)}</div>
          <div><strong>{title}</strong><span>{context ? `@${context.username}` : 'Loading…'}</span></div>
        </div>
        <div className="chat-safety"><button className="ghost small" onClick={reportUser} disabled={!context}>Report</button><button className="danger small" onClick={blockUser} disabled={!context}>Block</button></div>
      </header>

      <section className="message-list">
        {messages.map(message => {
          const mine = message.sender_id === me
          const consumed = message.view_once && !!message.viewed_at && !message.media_url
          return <article className={`message ${mine ? 'mine' : ''}`} key={message.id}>
            {message.message_type === 'text' && <p>{message.body}</p>}
            {message.message_type !== 'text' && message.view_once && !mine && !message.viewed_at && <button className="view-once-card" onClick={() => openViewOnce(message)}>◎ Open once</button>}
            {message.message_type !== 'text' && consumed && <p className="view-once-gone">View-once media opened</p>}
            {message.message_type === 'image' && message.media_url && <img src={message.media_url} alt={message.view_once ? 'View-once media' : 'Shared in chat'} />}
            {message.message_type === 'video' && message.media_url && <video src={message.media_url} controls preload="metadata" />}
            {message.view_once && mine && <small>View once{message.viewed_at ? ' · opened' : ''}</small>}
            <div className="message-meta"><time>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{mine && <button onClick={() => deleteMessage(message)}>Delete</button>}</div>
          </article>
        })}
        {!messages.length && !status && <div className="chat-empty"><div className="eyebrow">MATCHED</div><h2>Start with the cosplay.</h2><p>Ask about a character, convention, build, photoshoot or shared fandom.</p></div>}
        <div ref={bottomRef} />
      </section>

      <footer className="composer-wrap">
        {status && <div className="chat-status">{status}<button onClick={() => setStatus('')}>×</button></div>}
        <div className="media-mode"><label><input type="checkbox" checked={viewOnce} onChange={event => setViewOnce(event.target.checked)} /> Send the next photo/video as view once</label></div>
        <form className="composer" onSubmit={send}>
          <label className="attach-button" title="Send photo or video">＋<input type="file" accept="image/*,video/*" onChange={uploadMedia} disabled={uploading} /></label>
          <input aria-label="Message" placeholder={uploading ? 'Uploading media…' : 'Message your match…'} value={text} onChange={event => setText(event.target.value)} maxLength={2000} disabled={!context || uploading} />
          <button className="send-button" disabled={!text.trim() || !context}>Send</button>
        </form>
        <p className="chat-note">Only share media you have permission to send. View-once links expire quickly and cannot be reopened normally after viewing.</p>
      </footer>
    </main>
  )
}
