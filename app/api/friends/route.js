import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Get all friendships where the current user is involved and status is 'accepted'
    const result = await query(
      `
      SELECT 
        u.id, 
        u.name, 
        u.phone_number
      FROM 
        friendships f
      JOIN 
        users u ON (f.user_id_1 = u.id OR f.user_id_2 = u.id)
      WHERE 
        (f.user_id_1 = $1 OR f.user_id_2 = $1)
        AND u.id != $1
        AND f.status = 'accepted'
      `,
      [user.id],
    )

    return NextResponse.json({ friends: result.rows })
  } catch (error) {
    console.error("Error fetching friends:", error)
    return NextResponse.json({ message: "Failed to fetch friends" }, { status: 500 })
  }
}
