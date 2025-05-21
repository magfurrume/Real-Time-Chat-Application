"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"
import Cookies from "js-cookie"

export default function AuthProvider({ children }) {
  const { user, login, logout } = useAuthStore()
  const [isLoaded, setIsLoaded] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Check authentication status on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Skip auth check for public routes if needed
        if (pathname === "/register") {
          setIsLoaded(true)
          return
        }

        // Check if we have a token in cookies
        const token = Cookies.get("auth_token")

        if (!token) {
          // No token, ensure logged out state
          logout()
          setIsLoaded(true)

          // Only redirect if on a protected route
          if (pathname === "/chat") {
            router.push("/")
          }
          return
        }

        // If we have a token, fetch user data
        const response = await fetch("/api/auth/me")
        const data = await response.json()

        if (response.ok && data.authenticated) {
          // Set user in state
          login(data.user)
        } else {
          // Invalid token, clear it
          Cookies.remove("auth_token")
          logout()

          // Only redirect if on a protected route
          if (pathname === "/chat") {
            router.push("/")
          }
        }
      } catch (error) {
        console.error("Auth check failed:", error)
        // On error, ensure user is logged out
        Cookies.remove("auth_token")
        logout()

        // Only redirect if on a protected route
        if (pathname === "/chat") {
          router.push("/")
        }
      } finally {
        setIsLoaded(true)
      }
    }

    if (!isLoaded) {
      checkAuth()
    }
  }, [isLoaded, pathname, login, logout, router, user])

  // Don't render anything until auth check is complete
  if (!isLoaded && pathname === "/chat") {
    return null
  }

  return children
}
