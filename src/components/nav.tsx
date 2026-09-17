'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const links = [
  ['Discover', '/discover'],
  ['Matches', '/matches'],
  ['Support', '/support'],
  ['Profile', '/profile'],
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/')
    router.refresh()
  }

  return (
    <nav className="app-nav">
      <Link className="brand" href="/discover">COSPLAY//MATCH</Link>
      <div className="nav-links">
        {links.map(([label, href]) => (
          <Link key={href} className={pathname.startsWith(href) ? 'active' : ''} href={href}>{label}</Link>
        ))}
        <button className="ghost small" onClick={signOut}>Sign out</button>
      </div>
    </nav>
  )
}
