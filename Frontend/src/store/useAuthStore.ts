import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { authenticateUser, User as AuthUser } from '../services/mockAuthService'

export type User = AuthUser

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  login: (email: string, password: string) => Promise<void>
  logout: () => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })

        try {
          const user = await authenticateUser(email, password)
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, isLoading: false })
        sessionStorage.removeItem('portal-auth-storage')
      },

      clearAuth: () => {
        set({ user: null, isAuthenticated: false, isLoading: false })
        sessionStorage.removeItem('portal-auth-storage')
      },
    }),
    {
      name: 'portal-auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)

export default useAuthStore