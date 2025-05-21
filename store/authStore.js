import { useStore } from "@/context/StoreProvider"

export const createAuthSlice = (set) => ({
  user: null,
  loading: false,
  error: null,
  isLoaded: false,

  login: (user) => set({ user, isLoaded: true }),

  logout: () => set({ user: null }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  setLoaded: (isLoaded) => set({ isLoaded }),
})

// Hook for accessing auth store in components
export const useAuthStore = (selector) => useStore(selector)
