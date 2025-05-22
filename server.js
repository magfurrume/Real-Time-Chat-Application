const { createServer } = require("http")
const { Server } = require("socket.io")
const { Pool } = require("pg")
// const jwt = require("jsonwebtoken") // jwt was imported but not used, can be removed if not planned for future use

// Create a new pool using the connection string
const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_lSxTym5v4FuJ@ep-twilight-sunset-a14pm7xl-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
})

// Create HTTP server
const httpServer = createServer()

// Get port and CORS origin from environment variables
const PORT = process.env.PORT || 3005
const CORS_ORIGIN = process.env.CORS_ORIGIN || "https://real-time-chat-wheat.vercel.app/"

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

// Store connected users and their call status
const connectedUsers = new Map() // userId -> socket.id
const userCallStatus = new Map() // userId -> { inCallWith: otherUserId, busy: true }

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

  const userStrId = userId.toString();
  // Store user connection
  connectedUsers.set(userStrId, socket.id)
  // Initialize call status
  if (!userCallStatus.has(userStrId)) {
    userCallStatus.set(userStrId, { busy: false, inCallWith: null });
  }
  console.log(`User ${userStrId} connected with socket ${socket.id}`)
  console.log("Currently connected users:", Array.from(connectedUsers.keys()))
  console.log("User call statuses:", Object.fromEntries(userCallStatus));


  // Handle sending messages
  socket.on("sendMessage", async (data) => {
    try {
      const { receiverId, content } = data
      console.log(`User ${userStrId} sending message to ${receiverId}: ${content}`)

      if (!receiverId || !content) {
        console.error("Invalid message data")
        return
      }

      const friendshipResult = await query(
        "SELECT * FROM friendships WHERE ((user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)) AND status = 'accepted'",
        [userStrId, receiverId],
      )

      if (friendshipResult.rows.length === 0) {
        console.error(`Users ${userStrId} and ${receiverId} are not friends`)
        // Optionally, send an error back to the client
        socket.emit("messageError", { message: "Cannot send message. You are not friends with this user." });
        return
      }

      const result = await query(
        "INSERT INTO messages (sender_id, receiver_id, content, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *",
        [userStrId, receiverId, content],
      )

      const message = result.rows[0]


      socket.emit("message", message)
      console.log(`Message sent back to sender ${userStrId}`)

      const receiverSocketId = connectedUsers.get(receiverId.toString())
      if (receiverSocketId) {
        console.log(`Receiver ${receiverId} is online with socket ${receiverSocketId}, sending message`)
        io.to(receiverSocketId).emit("message", message)
      } else {
        console.log(`Receiver ${receiverId} is not online, message will be delivered when they connect`)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      socket.emit("messageError", { message: "Failed to send message." });
    }
  })

  // --- WebRTC Signaling ---

  const updateUserBusyStatus = (userId1, userId2, busy) => {
    const id1 = userId1.toString();
    const id2 = userId2 ? userId2.toString() : null;
    userCallStatus.set(id1, { busy: busy, inCallWith: busy ? id2 : null });
    if (id2) {
        userCallStatus.set(id2, { busy: busy, inCallWith: busy ? id1 : null });
    }
    console.log("Updated call statuses:", Object.fromEntries(userCallStatus));
  };

  // Initiate a call
  socket.on("call-user", (data) => {
    const { to, offer } = data;
    const toStr = to.toString();
    const fromStr = userStrId;

    console.log(`User ${fromStr} calling user ${toStr}`);

    const receiverSocketId = connectedUsers.get(toStr);
    const callerStatus = userCallStatus.get(fromStr);
    const receiverStatus = userCallStatus.get(toStr);

    if (callerStatus && callerStatus.busy) {
        console.log(`User ${fromStr} is already in a call.`);
        socket.emit("call-busy", { userId: fromStr, message: "You are already in a call." });
        return;
    }
    if (receiverStatus && receiverStatus.busy) {
        console.log(`User ${toStr} is busy.`);
        socket.emit("call-busy", { userId: toStr, message: `User ${toStr} is currently busy.` });
        return;
    }

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-made", {
        offer,
        from: fromStr,
        fromSocketId: socket.id, // Send caller's socket ID
      });
      console.log(`Call offer sent from ${fromStr} to ${toStr}`);
    } else {
      socket.emit("call-unavailable", { userId: toStr, message: `User ${toStr} is not online.` });
      console.log(`User ${toStr} is not online for call.`);
    }
  });

  // Answer a call
  socket.on("make-answer", (data) => {
    const { answer, toSocketId, toUserId } = data; // toSocketId is the original caller's socket.id
    const fromStr = userStrId;
    console.log(`User ${fromStr} answered call from user ${toUserId}`);

    // Mark both users as busy
    updateUserBusyStatus(fromStr, toUserId, true);


    io.to(toSocketId).emit("answer-made", {
      answer,
      from: fromStr, //This is the callee who answered
    });
    console.log(`Answer sent from ${fromStr} to socket ${toSocketId}`);
  });

  // Handle ICE candidates
  socket.on("ice-candidate", (data) => {
    const { candidate, toUserId } = data; // Send to specific user ID
    const toSocketId = connectedUsers.get(toUserId.toString());
    const fromStr = userStrId;

    if (toSocketId) {
        // console.log(`Relaying ICE candidate from ${fromStr} to ${toUserId}`);
        io.to(toSocketId).emit("ice-candidate", {
            candidate,
            from: fromStr,
        });
    }
  });

  // Handle call rejection
  socket.on("reject-call", (data) => {
    const { toUserId } = data; // User ID of the person who initiated the call
    const toSocketId = connectedUsers.get(toUserId.toString());
    const fromStr = userStrId; // User ID of the person who rejected the call

    console.log(`User ${fromStr} rejected call from ${toUserId}`);
    if (toSocketId) {
      io.to(toSocketId).emit("call-rejected", {
        from: fromStr,
      });
    }
  });

  // Handle call ending
  socket.on("end-call", (data) => {
    const { toUserId } = data; // The other user in the call
    const fromStr = userStrId;
    console.log(`User ${fromStr} ended call with ${toUserId}`);

    updateUserBusyStatus(fromStr, toUserId, false);


    const toSocketId = connectedUsers.get(toUserId.toString());
    if (toSocketId) {
      io.to(toSocketId).emit("call-ended", {
        from: fromStr,
      });
    }
  });
  // --- End WebRTC Signaling ---

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log(`Socket ${socket.id} disconnected. Reason: ${reason}`)

    // Remove user from connected users
    let disconnectedUserId = null;
    for (const [key, value] of connectedUsers.entries()) {
      if (value === socket.id) {
        disconnectedUserId = key;
        connectedUsers.delete(key)
        console.log(`User ${key} disconnected`)
        break
      }
    }

    // If user was in a call, notify the other party and clear status
    if (disconnectedUserId) {
        const callStatus = userCallStatus.get(disconnectedUserId);
        if (callStatus && callStatus.busy && callStatus.inCallWith) {
            const otherUserId = callStatus.inCallWith;
            const otherUserSocketId = connectedUsers.get(otherUserId);
            if (otherUserSocketId) {
                io.to(otherUserSocketId).emit("call-ended", {
                    from: disconnectedUserId,
                    reason: "disconnected"
                });
            }
            updateUserBusyStatus(disconnectedUserId, otherUserId, false);
        } else {
            userCallStatus.delete(disconnectedUserId); // Clean up if not in call
        }
    }


    console.log("Remaining connected users:", Array.from(connectedUsers.keys()))
    console.log("User call statuses after disconnect:", Object.fromEntries(userCallStatus));
  })
})

// Start server
httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`)
  console.log(`CORS configured for origin: ${CORS_ORIGIN}`)
})