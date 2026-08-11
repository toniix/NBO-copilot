import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { authenticateUser } from '../services/mockAuthService.js'

export const useAuthStore = create()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
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