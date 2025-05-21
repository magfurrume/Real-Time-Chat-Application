import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { query } from "@/lib/db"

export async function POST(request, { params }) {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const requestId = params.id

    // Get the friend request
    const requestResult = await query(
      "SELECT * FROM friend_requests WHERE id = $1 AND receiver_id = $2 AND status = 'pending'",
      [requestId, user.id],
    )

    if (requestResult.rows.length === 0) {
      return NextResponse.json({ message: "Friend request not found" }, { status: 404 })
    }

    const friendRequest = requestResult.rows[0]

    // Begin transaction
    await query("BEGIN")

    try {
      // Update friend request status
      await query("UPDATE friend_requests SET status = 'accepted' WHERE id = $1", [requestId])

      // Create friendship
      await query("INSERT INTO friendships (user_id_1, user_id_2, status) VALUES ($1, $2, 'accepted')", [
        friendRequest.sender_id,
        user.id,
      ])

      // Get friend details
      const friendResult = await query("SELECT id, name, phone_number FROM users WHERE id = $1", [
        friendRequest.sender_id,
      ])

      // Commit transaction
      await query("COMMIT")

      return NextResponse.json({
        message: "Friend request accepted",
        friend: friendResult.rows[0],
      })
    } catch (error) {
      // Rollback transaction on error
      await query("ROLLBACK")
      throw error
    }
  } catch (error) {
    console.error("Error accepting friend request:", error)
    return NextResponse.json({ message: "Failed to accept friend request" }, { status: 500 })
  }
}
