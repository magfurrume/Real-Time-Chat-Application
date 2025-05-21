"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth-store"
import ChatLayout from "@/components/chat/chat-layout"

export default function DashboardPage() {
  const { user, isAuthenticated, isLoaded } = useAuthStore()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  // Check authentication status after the auth state is loaded
  useEffect(() => {
    if (isLoaded) {
      if (!isAuthenticated) {
        router.push("/")
      } else {
        setIsLoading(false)
      }
    }
  }, [isAuthenticated, isLoaded, router])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return <ChatLayout />
}
