import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Map from './components/Map'

export default function App() {
  // undefined = resolving, null = logged out, Session = logged in
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    // Restore existing session immediately
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Avoid flash: wait until auth state is resolved
  if (session === undefined) return null

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ background: '#5B9FD4' }}>
      <Map user={session?.user ?? null} />
    </div>
  )
}
