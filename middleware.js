import { NextResponse } from "next/server"
import { jwtVerify } from "jose"

// Define which routes are protected
const protectedRoutes = ["/dashboard"]

// Secret key for JWT verification
const getJWTSecretKey = () => {
  const secret = process.env.JWT_SECRET || "your-fallback-secret-key-for-development"
  return new TextEncoder().encode(secret)
}

export async function middleware(request) {
  // Get the pathname from the URL
  const { pathname } = request.nextUrl

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  if (isProtectedRoute) {
    // Get the auth token from cookies
    const token = request.cookies.get("auth_token")?.value

    // If there's no token, redirect to login
    if (!token) {
      const url = new URL("/", request.url)
      return NextResponse.redirect(url)
    }

    // Verify the token
    try {
      await jwtVerify(token, getJWTSecretKey())

      // Token is valid, allow the request
      return NextResponse.next()
    } catch (error) {
      console.error("Token verification failed:", error)

      // If token verification fails, redirect to login
      const url = new URL("/", request.url)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

// Update the matcher to include all protected routes
export const config = {
  matcher: ["/dashboard/:path*"],
}
