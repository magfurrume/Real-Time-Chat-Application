"use client"

import { useState, useEffect, useRef } from "react"
import { useAuthStore } from "@/store/auth-store"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import Sidebar from "@/components/chat/sidebar"
import ChatWindow from "@/components/chat/chat-window"
import { useChatStore } from "@/store/chat-store"
import { io } from "socket.io-client"

export default function ChatLayout() {
  const { user, logout } = useAuthStore()
  const {
    selectedFriend,
    setMessages,
    addMessage,
    messages,
  } = useChatStore()
  const router = useRouter()
  const { toast } = useToast()

  const [socket, setSocket] = useState(null)
  const [socketConnected, setSocketConnected] = useState(false)

  // To prevent adding duplicate messages
  const messageIdsRef = useRef(new Set())

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
      if (!messageIdsRef.current.has(msg.id)) {
        messageIdsRef.current.add(msg.id)

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
    }

    socket.on("message", handleIncoming)

    return () => {
      socket.off("message", handleIncoming)
    }
  }, [socket, selectedFriend, user, addMessage])

  // 3. Load message history when a friend is selected
  useEffect(() => {
    if (!selectedFriend) return

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages/${selectedFriend.id}`)
        if (res.ok) {
          const { messages } = await res.json()

          // Add message IDs to prevent duplicates
          messages.forEach((m) => messageIdsRef.current.add(m.id))

          setMessages(messages)
        }
      } catch (err) {
        console.error("Error loading messages:", err)
      }
    }

    fetchMessages()
  }, [selectedFriend])

  // 4. Send message
  const handleSendMessage = (content) => {
    if (!selectedFriend || !content.trim()) return

    if (!socket) {
      toast({
        title: "Socket not connected",
        description: "Unable to send message",
        variant: "destructive",
      })
      return
    }

    socket.emit("sendMessage", {
      receiverId: selectedFriend.id,
      content,
    })
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
