import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { query } from "@/lib/db"

export async function POST(request) {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { receiverId, content } = await request.json()

    if (!receiverId || !content) {
      return NextResponse.json({ message: "Receiver ID and content are required" }, { status: 400 })
    }

    // Check if they are friends
    const friendshipResult = await query(
      "SELECT * FROM friendships WHERE ((user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)) AND status = 'accepted'",
      [user.id, receiverId],
    )

    if (friendshipResult.rows.length === 0) {
      return NextResponse.json({ message: "You can only send messages to friends" }, { status: 403 })
    }

    // Save message
    const result = await query(
      "INSERT INTO messages (sender_id, receiver_id, content, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *",
      [user.id, receiverId, content],
    )

    return NextResponse.json({ message: result.rows[0] })
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json({ message: "Failed to send message" }, { status: 500 })
  }
}
