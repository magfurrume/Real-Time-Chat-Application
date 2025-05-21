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

  // 1. Create socket connection
  useEffect(() => {
    if (!user) return

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3005"

    const s = io(socketUrl, {
      auth: { userId: user.id },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    })

    s.on("connect", () => {
      setSocketConnected(true)
      toast({ title: "Connected", description: "Real-time chat ready" })
    })

    s.on("connect_error", (err) => {
      setSocketConnected(false)
      toast({
        title: "Connection error",
        description: err.message,
        variant: "destructive",
      })
    })

    s.on("disconnect", (reason) => {
      setSocketConnected(false)
      toast({
        title: "Disconnected",
        description: reason,
        variant: "destructive",
      })
    })

    setSocket(s)

    return () => {
      s.disconnect()
    }
  }, [user])

  // 2. Listen for incoming messages
  useEffect(() => {
    if (!socket) return

    const handleIncoming = (msg) => {
      if (
        selectedFriend &&
        (msg.sender_id === selectedFriend.id ||
          msg.receiver_id === selectedFriend.id)
      ) {
        addMessage(msg)
      } else if (msg.sender_id !== user?.id) {
        toast({
          title: "New message",
          description: "You received a message in another chat",
        })
      }
    }

    socket.on("message", handleIncoming)

    return () => {
      socket.off("message", handleIncoming)
    }
  }, [socket, selectedFriend, user])

  // 3. Load message history when a friend is selected
  useEffect(() => {
    if (!selectedFriend) return

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages/${selectedFriend.id}`)
        if (res.ok) {
          const { messages } = await res.json()
          setMessages(messages)
        }
      } catch (err) {
        console.error("Error loading messages:", err)
      }
    }

    fetchMessages()
  }, [selectedFriend])

  // 4. Send message
  const handleSendMessage = async (content) => {
    if (!socket || !selectedFriend || !content.trim()) return

    try {
      socket.emit("sendMessage", {
        receiverId: selectedFriend.id,
        content,
      })

      // Let server echo the message back, no optimistic update
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: selectedFriend.id, content }),
      })
    } catch (err) {
      console.error("Send error:", err)
      toast({
        title: "Send error",
        description: "Could not send message. Try again.",
        variant: "destructive",
      })
    }
  }

  // 5. Logout
  const handleLogout = async () => {
    if (socket) socket.disconnect()
    await fetch("/api/auth/logout", { method: "POST" })
    logout()
    toast({ title: "Logged out", description: "See you again!" })
    router.push("/")
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar onLogout={handleLogout} />
      <ChatWindow
        onSendMessage={handleSendMessage}
        socketConnected={socketConnected}
      />
    </div>
  )
}
