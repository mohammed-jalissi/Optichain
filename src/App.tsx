import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { BarChart3, Map, TrendingUp, Settings, Brain, LogOut } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import MapIntelligence from './pages/MapIntelligence'
import Predictions from './pages/Predictions'
import Analytics from './pages/Analytics'
import Training from './pages/Training'
import Login from './pages/Login'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import './App.css'

function Navigation() {
  const location = useLocation()
  const { logout } = useAuth()

  const navItems = [
    { path: '/', icon: BarChart3, label: 'Dashboard' },
    { path: '/map', icon: Map, label: 'Map Intelligence' },
    { path: '/training', icon: Brain, label: 'Entraînement' },
    { path: '/predictions', icon: TrendingUp, label: 'Prédictions' },
    { path: '/analytics', icon: Settings, label: 'IA Analytics' }
  ]

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="logo-container">
          <div className="logo-cube"></div>
          <h1>OptiChain</h1>
        </div>
      </div>
      <div className="navbar-links">
        {navItems.map(item => {
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
      <button className="logout-btn" onClick={logout} title="Se déconnecter">
        <LogOut size={20} />
      </button>
    </nav>
  )
}

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AppContent() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  return (
    <div className="app">
      {isAuthenticated && location.pathname !== '/login' && <Navigation />}
      <main className="main-content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
          <Route path="/map" element={<ProtectedRoute><MapIntelligence /></ProtectedRoute>} />
          <Route path="/predictions" element={<ProtectedRoute><Predictions /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Router>
          <AppContent />
        </Router>
      </DataProvider>
    </AuthProvider>
  )
}

export default App
