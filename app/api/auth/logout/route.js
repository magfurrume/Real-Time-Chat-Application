import { NextResponse } from "next/server"
import { clearAuthCookie } from "@/lib/auth"

export async function POST() {
  try {
    // Clear the auth cookie
    await clearAuthCookie()

    // Return success response
    return NextResponse.json({
      message: "Logout successful",
    })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ message: "Logout failed" }, { status: 500 })
  }
}
