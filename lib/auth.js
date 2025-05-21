import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { getUserByPhone } from "@/lib/db"

// Helper function to get JWT secret key
const getJWTSecretKey = () => {
  const secret = process.env.JWT_SECRET || "your-fallback-secret-key-for-development"
  return secret
}

// Validate phone number format
export function validatePhoneNumber(phone) {
  // Basic validation - you might want to use a more sophisticated regex
  return /^\+?[0-9]{10,15}$/.test(phone)
}

// Generate JWT token
export async function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      phone_number: user.phone_number,
    },
    getJWTSecretKey(),
    { expiresIn: "7d" },
  )
}

// Set auth cookie
export async function setAuthCookie(token) {
  const cookieStore = await cookies()
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
  })
}

// Verify password
export async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword)
}

// Get authenticated user from token
export async function getAuthUser() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value

    if (!token) return null

    const decoded = jwt.verify(token, getJWTSecretKey())

    if (!decoded || !decoded.id) return null

    // Get user from database
    const user = await getUserByPhone(decoded.phone_number)

    if (!user) return null

    return {
      id: user.id,
      name: user.name,
      phone_number: user.phone_number,
      created_at: user.created_at,
    }
  } catch (error) {
    console.error("Auth user error:", error)
    return null
  }
}

// Clear auth cookie
export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete("auth_token")
}
