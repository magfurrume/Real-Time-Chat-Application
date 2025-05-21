"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/store/auth-store"

export function AuthProvider({ children }) {
  const { login, isLoaded, setLoaded } = useAuthStore()

  // Check for existing session on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        })

        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            // Update auth state with user data from server
            login(data.user)
          }
        }
      } catch (error) {
        console.error("Auth check error:", error)
      } finally {
        // Mark auth check as complete
        setLoaded(true)
      }
    }

    if (!isLoaded) {
      checkAuth()
    }
  }, [login, isLoaded, setLoaded])

  return children
}
