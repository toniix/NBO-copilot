import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

// Features
import NewLoginPage from './features/auth/Login'
import Dashboard from './features/dashboard/Dashboard.jsx'
import SupervisorDashboard from './features/supervisor/SupervisorDashboard.jsx'

// Layouts
import NotFoundPage from './pages/NotFoundPage'

// Store
import { useAuthStore } from './store/useAuthStore'

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore()
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

const SupervisorRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== 'supervisor') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Routes>
            {/* Ruta pública de login */}
            <Route path="/login" element={<NewLoginPage />} />
            
            {/* Ruta protegida de dashboard directa */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />

            <Route
              path="/supervisor"
              element={
                <SupervisorRoute>
                  <SupervisorDashboard />
                </SupervisorRoute>
              }
            />
            
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App