import Link from 'next/link'

export default function Home() {
  return (
    <main className="landing-shell">
      <section className="hero-card">
        <div className="eyebrow">18+ COSPLAY DATING</div>
        <h1>Meet someone who gets the character <em>and</em> the person behind it.</h1>
        <p className="hero-copy">Build a cosplay-first profile, discover people who match your dating preference, connect on mutual interest, then chat and share media privately.</p>
        <div className="hero-actions">
          <Link className="primary" href="/login">Create account</Link>
          <Link className="secondary" href="/login">Sign in</Link>
        </div>
        <div className="feature-grid">
          <article><strong>Cosplay-first</strong><span>Characters, fandoms and conventions belong on the profile.</span></article>
          <article><strong>Mutual matches</strong><span>Conversation starts only after both people choose each other.</span></article>
          <article><strong>Private sharing</strong><span>Chat photos and videos live in protected storage, not a public feed.</span></article>
        </div>
        <p className="fine-print">Adults 18+ only. Consent, blocking and reporting are built into the product model.</p>
      </section>
    </main>
  )
}
