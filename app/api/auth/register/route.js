import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { setAuthCookie } from "@/lib/auth"

export async function POST(request) {
  try {
    const { name, phoneNumber, password } = await request.json()

    // Validate input
    if (!name || !phoneNumber || !password) {
      return NextResponse.json({ message: "Name, phone number, and password are required" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await db.query("SELECT * FROM users WHERE phone_number = $1", [phoneNumber])

    if (existingUser.rows.length > 0) {
      return NextResponse.json({ message: "User with this phone number already exists" }, { status: 409 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const result = await db.query(
      "INSERT INTO users (name, phone_number, password) VALUES ($1, $2, $3) RETURNING id, name, phone_number",
      [name, phoneNumber, hashedPassword],
    )

    const user = result.rows[0]

    // Generate JWT
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" })

    // Create response
    let response = NextResponse.json(
      {
        message: "Registration successful",
        user: {
          id: user.id,
          name: user.name,
          phoneNumber: user.phone_number,
        },
      },
      { status: 201 },
    )

    // Set HTTP-only cookie with improved settings
    response = await setAuthCookie(response, token)

    return response
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ message: "Registration failed" }, { status: 500 })
  }
}
