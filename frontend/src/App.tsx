import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import EmissionData from './pages/EmissionData'
import Forecast from './pages/Forecast'
import Analytics from './pages/Analytics'
import ModelAccuracy from './pages/ModelAccuracy'
import Reports from './pages/Reports'

function Layout({
  children,
  onSignOut,
}: {
  children: React.ReactNode
  onSignOut: () => void
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar onSignOut={onSignOut} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

export default function App() {
  // `undefined` = still loading; `null` = no session; Session = authenticated
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    // Seed initial session from storage
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    // Keep in sync with sign-in / sign-out / token refresh
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    // onAuthStateChange fires SIGNED_OUT → setSession(null) automatically
  }

  // ── Loading splash ─────────────────────────────────────────────────────────
  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    )
  }

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (!session) {
    return <Login />
  }

  // ── Authenticated ──────────────────────────────────────────────────────────
  return (
    <BrowserRouter>
      <Layout onSignOut={handleSignOut}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/emissions" element={<EmissionData />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/accuracy" element={<ModelAccuracy />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
