import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET(request) {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const searchQuery = request.nextUrl.searchParams.get("query")

    if (!searchQuery) {
      return NextResponse.json({ message: "Search query is required" }, { status: 400 })
    }

    // Search users by phone number
    const result = await query(
      `
      SELECT 
        id, name, phone_number
      FROM 
        users
      WHERE 
        phone_number LIKE $1
        AND id != $2
      LIMIT 10
      `,
      [`%${searchQuery}%`, user.id],
    )

    return NextResponse.json({ users: result.rows })
  } catch (error) {
    console.error("Error searching users:", error)
    return NextResponse.json({ message: "Failed to search users" }, { status: 500 })
  }
}
