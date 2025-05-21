"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/auth-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function AuthStatus() {
  const { user, isAuthenticated, isLoaded, logout } = useAuthStore()
  const [tokenInfo, setTokenInfo] = useState(null)
  const router = useRouter()

  useEffect(() => {
    // Get the auth token from cookies
    const getCookieValue = (name) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop().split(";").shift()
      return null
    }

    const token = getCookieValue("auth_token")

    if (token) {
      // Decode the JWT token (without verification)
      try {
        const base64Url = token.split(".")[1]
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join(""),
        )

        const payload = JSON.parse(jsonPayload)
        setTokenInfo({
          id: payload.id,
          exp: new Date(payload.exp * 1000).toLocaleString(),
          iat: new Date(payload.iat * 1000).toLocaleString(),
        })
      } catch (error) {
        console.error("Error decoding token:", error)
        setTokenInfo({ error: "Invalid token format" })
      }
    }
  }, [isAuthenticated])

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      })
      logout()
      router.push("/login")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  if (!isLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Authentication Status</CardTitle>
          <CardDescription>Checking authentication...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Authentication Status</CardTitle>
        <CardDescription>Current authentication state</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="font-medium">Status:</span>
            <span className={isAuthenticated ? "text-green-600" : "text-red-600"}>
              {isAuthenticated ? "Authenticated" : "Not authenticated"}
            </span>
          </div>

          {isAuthenticated && user && (
            <>
              <div className="flex justify-between">
                <span className="font-medium">User ID:</span>
                <span>{user.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Name:</span>
                <span>{user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Phone:</span>
                <span>{user.phone_number}</span>
              </div>
            </>
          )}

          {tokenInfo && (
            <>
              <div className="pt-2 border-t">
                <p className="font-medium">Token Information:</p>
                <div className="flex justify-between">
                  <span className="font-medium">User ID in token:</span>
                  <span>{tokenInfo.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Issued at:</span>
                  <span>{tokenInfo.iat}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Expires at:</span>
                  <span>{tokenInfo.exp}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {isAuthenticated && (
          <Button onClick={handleLogout} variant="destructive" className="w-full">
            Logout
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
