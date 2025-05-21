import { NextResponse } from "next/server"
import { getUserByPhone, testConnection } from "@/lib/db"
import { generateToken, setAuthCookie, verifyPassword } from "@/lib/auth"

export async function POST(request) {
  try {
    // Test database connection
    await testConnection()

    const { phone_number, password } = await request.json()

    // Basic validation
    if (!phone_number || !password) {
      return NextResponse.json({ message: "Phone number and password are required" }, { status: 400 })
    }

    // Get user from database
    const user = await getUserByPhone(phone_number)

    if (!user) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })
    }

    // Create a sanitized user object (without password)
    const userForClient = {
      id: user.id,
      name: user.name,
      phone_number: user.phone_number,
      created_at: user.created_at,
    }

    // Generate JWT token
    const token = await generateToken(userForClient)

    // Set auth cookie
    await setAuthCookie(token)

    // Return success response with user data
    return NextResponse.json({
      message: "Login successful",
      user: userForClient,
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ message: "Login failed", error: error.message }, { status: 500 })
  }
}
