import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import EmissionData from './pages/EmissionData'
import Forecast from './pages/Forecast'
import Analytics from './pages/Analytics'
import ModelAccuracy from './pages/ModelAccuracy'
import Reports from './pages/Reports'
// Login is intentionally not wired into route protection yet — that
// belongs to the Supabase Auth phase (see README "Next steps").
// import Login from './pages/Login'

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
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
