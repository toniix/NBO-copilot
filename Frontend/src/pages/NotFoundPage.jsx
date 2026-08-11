import { Link } from 'react-router-dom'

const NotFoundPage = () => (
  <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
    <div>
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-3xl font-bold text-text">Página no encontrada</h1>
      <Link to="/dashboard" className="btn-primary mt-6 inline-flex">
        Volver al dashboard
      </Link>
    </div>
  </main>
)

export default NotFoundPage