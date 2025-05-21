import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Get all pending friend requests sent to the current user
    const result = await query(
      `
      SELECT 
        fr.id,
        fr.sender_id,
        u.name as sender_name,
        u.phone_number as sender_phone,
        fr.created_at
      FROM 
        friend_requests fr
      JOIN 
        users u ON fr.sender_id = u.id
      WHERE 
        fr.receiver_id = $1 AND fr.status = 'pending'
      `,
      [user.id],
    )

    return NextResponse.json({ requests: result.rows })
  } catch (error) {
    console.error("Error fetching friend requests:", error)
    return NextResponse.json({ message: "Failed to fetch friend requests" }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ message: "User ID is required" }, { status: 400 })
    }

    // Check if the user exists
    const userExists = await query("SELECT id FROM users WHERE id = $1", [userId])
    if (userExists.rows.length === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    // Check if a friend request already exists
    const existingRequest = await query(
      "SELECT * FROM friend_requests WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)",
      [user.id, userId],
    )

    if (existingRequest.rows.length > 0) {
      return NextResponse.json({ message: "Friend request already exists" }, { status: 409 })
    }

    // Check if they are already friends
    const existingFriendship = await query(
      "SELECT * FROM friendships WHERE (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)",
      [user.id, userId],
    )

    if (existingFriendship.rows.length > 0) {
      return NextResponse.json({ message: "Already friends" }, { status: 409 })
    }

    // Create friend request
    await query("INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES ($1, $2, 'pending')", [
      user.id,
      userId,
    ])

    return NextResponse.json({ message: "Friend request sent" }, { status: 201 })
  } catch (error) {
    console.error("Error sending friend request:", error)
    return NextResponse.json({ message: "Failed to send friend request" }, { status: 500 })
  }
}
