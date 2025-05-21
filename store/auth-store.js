import { create } from "zustand"

export const useAuthStore = create((set) => ({
  // Auth state
  user: null,
  isAuthenticated: false,
  isLoaded: false,

  // Set the auth state as loaded (auth check complete)
  setLoaded: (loaded) => set({ isLoaded: loaded }),

  // Login: update state with user data
  login: (userData) =>
    set({
      user: userData,
      isAuthenticated: true,
      isLoaded: true,
    }),

  // Logout: clear user data
  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
    }),
}))
