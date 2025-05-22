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
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);

     // Close sidebar automatically on larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) { // Tailwind's 'sm' breakpoint
        setIsSidebarOpen(false); // Ensure sidebar is closed on resize to larger screens
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // To prevent adding duplicate messages
  const messageIdsRef = useRef(new Set())

  // 1. Create socket connection
  useEffect(() => {
    if (!user) return

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://192.168.0.40:3005"

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
const handleOpenSidebar = () => setIsSidebarOpen(true);
  const handleCloseSidebar = () => setIsSidebarOpen(false);
 return (
    <div className="flex h-screen bg-background relative overflow-hidden"> {/* Added relative and overflow-hidden */}
      {/* Sidebar - conditionally shown and animated */}
      <div className={`
        fixed inset-y-0 left-0 z-50
        w-80 h-full bg-card shadow-xl transition-transform duration-300 ease-in-out
        transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        sm:translate-x-0 sm:relative sm:w-80 sm:block
        rounded-r-2xl sm:rounded-none sm:shadow-none
      `}>
        <Sidebar
          onLogout={handleLogout}
          onSelectFriend={handleCloseSidebar} // Close sidebar when a friend is selected
          onClose={handleCloseSidebar} // Explicit close for mobile
        />
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
          onClick={handleCloseSidebar}
        ></div>
      )}

      {/* Chat Window - takes remaining space, includes a toggle for sidebar on mobile */}
      <div className="flex-1 min-w-0 flex flex-col z-10"> {/* Ensure chat window stacks properly */}
        <ChatWindow
          onSendMessage={handleSendMessage}
          socketConnected={socketConnected}
          onOpenSidebar={handleOpenSidebar} // Pass function to open sidebar
        />
      </div>
    </div>
  )
}
