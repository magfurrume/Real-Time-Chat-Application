"use client"

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/auth-store"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import Sidebar from "@/components/chat/sidebar"
import ChatWindow from "@/components/chat/chat-window"
import { useChatStore } from "@/store/chat-store"
import { io } from "socket.io-client"

export default function ChatLayout() {
  const { user, logout } = useAuthStore()
  const { selectedFriend, setMessages, addMessage } = useChatStore()
  const router = useRouter()
  const { toast } = useToast()
  const [socket, setSocket] = useState(null)
  const [socketConnected, setSocketConnected] = useState(false)

  // Initialize socket connection
  useEffect(() => {
    if (!user) return

    // Get the socket URL from environment variable
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3005"
    console.log("Connecting to Socket.io server at:", socketUrl)

    // Connect to Socket.io server with explicit configuration
    const socketInstance = io(socketUrl, {
      auth: {
        userId: user.id,
      },
      transports: ["websocket", "polling"], // Try WebSocket first, fallback to polling
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000, // Increase timeout
    })

    // Set up event listeners
    socketInstance.on("connect", () => {
      console.log("Connected to Socket.io server with ID:", socketInstance.id)
      setSocketConnected(true)
      toast({
        title: "Connected",
        description: "Real-time chat connection established",
      })
    })

    socketInstance.on("connect_error", (error) => {
      console.error("Socket connection error:", error)
      setSocketConnected(false)
      toast({
        title: "Connection Error",
        description: "Failed to connect to chat server: " + error.message,
        variant: "destructive",
      })
    })

    socketInstance.on("disconnect", (reason) => {
      console.log("Disconnected from Socket.io server:", reason)
      setSocketConnected(false)
      toast({
        title: "Disconnected",
        description: "Chat connection lost: " + reason,
        variant: "destructive",
      })
    })

    socketInstance.on("message", (message) => {
      console.log("Received message via socket:", message)

      // Check if this message belongs to the current conversation
      if (selectedFriend && (message.sender_id === selectedFriend.id || message.receiver_id === selectedFriend.id)) {
        console.log("Adding message to current conversation")
        addMessage(message)
      } else {
        console.log("Message is for a different conversation")
        // Optionally show a notification for messages from other conversations
        if (message.sender_id !== user.id) {
          toast({
            title: "New Message",
            description: "You received a new message from another conversation",
          })
        }
      }
    })

    // Save socket instance
    setSocket(socketInstance)

    // Clean up on unmount
    return () => {
      console.log("Cleaning up socket connection")
      socketInstance.disconnect()
    }
  }, [user, addMessage, toast])

  // Update socket event handler when selectedFriend changes
  useEffect(() => {
    if (!socket) return

    const messageHandler = (message) => {
      console.log("Received message via socket:", message)

      // Check if this message belongs to the current conversation
      if (selectedFriend && (message.sender_id === selectedFriend.id || message.receiver_id === selectedFriend.id)) {
        console.log("Adding message to current conversation")
        addMessage(message)
      } else {
        console.log("Message is for a different conversation")
        // Optionally show a notification for messages from other conversations
        if (message.sender_id !== user?.id) {
          toast({
            title: "New Message",
            description: "You received a new message from another conversation",
          })
        }
      }
    }

    // Remove previous listener and add updated one
    socket.off("message")
    socket.on("message", messageHandler)

    return () => {
      socket.off("message", messageHandler)
    }
  }, [socket, selectedFriend, addMessage, toast, user])

  // Load messages when a friend is selected
  useEffect(() => {
    if (!selectedFriend) return

    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/messages/${selectedFriend.id}`)
        if (response.ok) {
          const data = await response.json()
          setMessages(data.messages)
        }
      } catch (error) {
        console.error("Error loading messages:", error)
      }
    }

    loadMessages()
  }, [selectedFriend, setMessages])

  const handleLogout = async () => {
    try {
      // Disconnect socket
      if (socket) {
        socket.disconnect()
      }

      // Call logout API
      await fetch("/api/auth/logout", {
        method: "POST",
      })

      // Update client state
      logout()

      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      })

      router.push("/")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const handleSendMessage = async (content) => {
    if (!selectedFriend || !socket) return

    try {
      console.log("Sending message to:", selectedFriend.id, "Content:", content)

      // Create message object
      const messageObj = {
        sender_id: user.id,
        receiver_id: selectedFriend.id,
        content,
        created_at: new Date().toISOString(),
      }

      // Add message to UI immediately (optimistic update)
      addMessage(messageObj)

      // Send message via socket
      socket.emit("sendMessage", {
        receiverId: selectedFriend.id,
        content,
      })

      // Also save via API for redundancy
      await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiverId: selectedFriend.id,
          content,
        }),
      })
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar onLogout={handleLogout} />
      <ChatWindow onSendMessage={handleSendMessage} socketConnected={socketConnected} />
    </div>
  )
}
