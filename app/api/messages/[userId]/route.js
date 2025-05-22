import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET(request, context) {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const pathSegments = url.pathname.split("/")
    const friendId = pathSegments[pathSegments.length - 1]

    // Check if they are friends
    const friendshipResult = await query(
      "SELECT * FROM friendships WHERE ((user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)) AND status = 'accepted'",
      [user.id, friendId],
    )

    if (friendshipResult.rows.length === 0) {
      return NextResponse.json({ message: "You can only view messages from friends" }, { status: 403 })
    }

    // Get messages
    const result = await query(
      `
      SELECT 
        *
      FROM 
        messages
      WHERE 
        (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
      ORDER BY 
        created_at ASC
      `,
      [user.id, friendId],
    )

    return NextResponse.json({ messages: result.rows })
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ message: "Failed to fetch messages" }, { status: 500 })
  }
}
