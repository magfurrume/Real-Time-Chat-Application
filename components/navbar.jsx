"use client"

import Link from "next/link"
import { useAuthStore } from "@/store/auth-store"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

export default function Navbar() {
  const { isAuthenticated, logout } = useAuthStore()
  const { toast } = useToast()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      // Call logout API to clear cookies
      await fetch("/api/auth/logout", {
        method: "POST",
      })

      // Update client state
      logout()

      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      })

      router.push("/")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-8">
        <Link href="/" className="text-xl font-bold">
          Auth App
        </Link>

        <nav className="flex gap-4 items-center">
          {isAuthenticated ? (
            <>
              <Button asChild variant="ghost">
                <Link href="/chat">Chat</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button onClick={handleLogout} variant="outline">
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
