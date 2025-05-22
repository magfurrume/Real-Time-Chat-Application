const { createServer } = require("http")
const { Server } = require("socket.io")
const { Pool } = require("pg")
const jwt = require("jsonwebtoken")

// Create a new pool using the connection string
const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_lSxTym5v4FuJ@ep-twilight-sunset-a14pm7xl-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
})

// Create HTTP server
const httpServer = createServer()

// Get port and CORS origin from environment variables
const PORT = process.env.PORT || 3005
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://192.168.0.40:3000"

console.log("Starting Socket.io server with CORS origin:", CORS_ORIGIN)

// Create Socket.io server with detailed configuration
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 10000,
  cookie: false,
})

// Store connected users
const connectedUsers = new Map()

// Helper function to run queries
async function query(text, params) {
  try {
    const result = await pool.query(text, params)
    return result
  } catch (error) {
    console.error("Query error:", error)
    throw error
  }
}

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log("New connection:", socket.id)

  // Get user ID from auth data
  const userId = socket.handshake.auth.userId
  if (!userId) {
    console.log("No user ID provided, disconnecting")
    socket.disconnect(true)
    return
  }

  // Store user connection
  connectedUsers.set(userId.toString(), socket.id)
  console.log(`User ${userId} connected with socket ${socket.id}`)
  console.log("Currently connected users:", Array.from(connectedUsers.keys()))

  // Handle sending messages
  socket.on("sendMessage", async (data) => {
    try {
      const { receiverId, content } = data
      console.log(`User ${userId} sending message to ${receiverId}: ${content}`)

      if (!receiverId || !content) {
        console.error("Invalid message data")
        return
      }

      // Check if they are friends
      const friendshipResult = await query(
        "SELECT * FROM friendships WHERE ((user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)) AND status = 'accepted'",
        [userId, receiverId],
      )

      if (friendshipResult.rows.length === 0) {
        console.error(`Users ${userId} and ${receiverId} are not friends`)
        return
      }

      // Save message to database
      const result = await query(
        "INSERT INTO messages (sender_id, receiver_id, content, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *",
        [userId, receiverId, content],
      )

      const message = result.rows[0]
      console.log("Message saved to database:", message)

      // Send message to sender (for confirmation)
      socket.emit("message", message)
      console.log(`Message sent back to sender ${userId}`)

      // Send message to receiver if online
      const receiverSocketId = connectedUsers.get(receiverId.toString())
      if (receiverSocketId) {
        console.log(`Receiver ${receiverId} is online with socket ${receiverSocketId}, sending message`)

        // Use io.to() to send to a specific socket
        io.to(receiverSocketId).emit("message", message)

        // Double-check if message was sent
        const receiverSocket = io.sockets.sockets.get(receiverSocketId)
        if (receiverSocket) {
          console.log(`Confirmed receiver socket ${receiverSocketId} exists`)
        } else {
          console.log(`Warning: Receiver socket ${receiverSocketId} not found in io.sockets.sockets`)
        }
      } else {
        console.log(`Receiver ${receiverId} is not online, message will be delivered when they connect`)
      }
    } catch (error) {
      console.error("Error sending message:", error)
    }
  })

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log(`Socket ${socket.id} disconnected. Reason: ${reason}`)

    // Remove user from connected users
    for (const [key, value] of connectedUsers.entries()) {
      if (value === socket.id) {
        connectedUsers.delete(key)
        console.log(`User ${key} disconnected`)
        break
      }
    }

    console.log("Remaining connected users:", Array.from(connectedUsers.keys()))
  })
})

// Start server
httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`)
  console.log(`CORS configured for origin: ${CORS_ORIGIN}`)
})
