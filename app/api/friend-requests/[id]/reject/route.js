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

    // Update friend request status
    await query("UPDATE friend_requests SET status = 'rejected' WHERE id = $1", [requestId])

    return NextResponse.json({ message: "Friend request rejected" })
  } catch (error) {
    console.error("Error rejecting friend request:", error)
    return NextResponse.json({ message: "Failed to reject friend request" }, { status: 500 })
  }
}
