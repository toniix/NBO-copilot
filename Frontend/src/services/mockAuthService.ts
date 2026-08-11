export type User = {
  id: string
  email: string
  name?: string
  role: 'asesor' | 'supervisor'
}

type InternalUser = User & { salt: string; passwordHash?: string }

const UNIVERSAL_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || 'Hackathon2026*'

// NOTE: Do NOT commit real secrets. Per-user initial passwords can be provided
// via environment variables (Vite `import.meta.env`) to avoid embedding them in source.
const users: InternalUser[] = [
  { id: 'advisor-vero', email: 'vero.demo@movistar.test', name: 'Vero', role: 'asesor', salt: 'movistar-vero-v1' },
  { id: 'advisor-gabriela', email: 'gabriela.demo@movistar.test', name: 'Gabriela', role: 'asesor', salt: 'movistar-gabriela-v1' },
  { id: 'advisor-anthony', email: 'anthony.demo@movistar.test', name: 'Anthony', role: 'asesor', salt: 'movistar-anthony-v1' },
  { id: 'demo-supervisor', email: 'supervisor.demo@movistar.test', name: 'Supervisor', role: 'supervisor', salt: 'movistar-supervisor-v1' },
]

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')

const hashPassword = async (password: string, salt: string) => {
  const enc = new TextEncoder()
  const pw = enc.encode(password)
  const s = enc.encode(salt)
  const key = await crypto.subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: s, iterations: 120000, hash: 'SHA-256' }, key, 256)
  return toHex(derived)
}

// Precompute password hashes for the universal password so UI never stores plaintext.
// Allow per-user initial passwords for quick local testing. If `initialPassword` is present
// on a user object it will be used; otherwise the universal demo password is used.
// Map optional environment variables for per-user initial passwords.
const envPasswords: Record<string, string | undefined> = {
  'vero.demo@movistar.test': import.meta.env.VITE_INIT_PASS_VERO,
  'gabriela.demo@movistar.test': import.meta.env.VITE_INIT_PASS_GABRIELA,
  'anthony.demo@movistar.test': import.meta.env.VITE_INIT_PASS_ANTHONY,
  'supervisor.demo@movistar.test': import.meta.env.VITE_INIT_PASS_SUPERVISOR,
}

const initialize = async () => {
  await Promise.all(
    users.map(async (u) => {
      const envPass = envPasswords[u.email]
      const userInitial = envPass || UNIVERSAL_PASSWORD
      u.passwordHash = await hashPassword(userInitial, u.salt)
    }),
  )
}

// Initialize eagerly; callers can await authenticateUser which will await any outstanding initialization.
const initPromise = initialize()

export const authenticateUser = async (email: string, password: string): Promise<User> => {
  await initPromise

  const normalized = email.trim().toLowerCase()
  const user = users.find((u) => u.email === normalized)
  if (!user) throw new Error('Usuario no registrado en entorno de demostración')

  const candidateHash = await hashPassword(password, user.salt)
  if (candidateHash !== user.passwordHash) throw new Error('Credenciales inválidas')

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }
}

export default { authenticateUser }
