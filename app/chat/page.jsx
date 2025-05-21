"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth-store"
// Import the AuthStatus component
import { AuthStatus } from "@/components/auth-status"

export default function ChatPage() {
  const { user, isAuthenticated, isLoaded } = useAuthStore()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  // Check authentication status after the auth state is loaded
  useEffect(() => {
    if (isLoaded) {
      if (!isAuthenticated) {
        router.push("/login?from=/chat")
      } else {
        setIsLoading(false)
      }
    }
  }, [isAuthenticated, isLoaded, router])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Chat</h1>
      <p className="text-muted-foreground">Welcome to the chat page, {user?.name}!</p>

      <div className="border rounded-lg p-6">
        <p>This is a protected chat page. You are authenticated!</p>
        <p className="mt-2">Your phone number: {user?.phone_number}</p>
      </div>

      <AuthStatus />
    </div>
  )
}
