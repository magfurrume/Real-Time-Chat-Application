import { NextResponse } from "next/server"
import { generateToken, setAuthCookie, validatePhoneNumber } from "@/lib/auth"
import { createUser, getUserByPhone } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(request) {
  try {
    const { name, phone_number, password } = await request.json()

    // Basic validation
    if (!name || !phone_number || !password) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    // Validate phone number format
    if (!validatePhoneNumber(phone_number)) {
      return NextResponse.json({ message: "Invalid phone number format" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await getUserByPhone(phone_number)
    if (existingUser) {
      return NextResponse.json({ message: "User with this phone number already exists" }, { status: 409 })
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create new user in the database
    const newUser = await createUser(name, phone_number, hashedPassword)

    // Create a sanitized user object (without password)
    const userForClient = {
      id: newUser.id,
      name: newUser.name,
      phone_number: newUser.phone_number,
      created_at: newUser.created_at,
    }

    // Generate JWT token
    const token = await generateToken(userForClient)

    // Set auth cookie
    await setAuthCookie(token)

    // Return success response with user data
    return NextResponse.json(
      {
        message: "User created successfully",
        user: userForClient,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
