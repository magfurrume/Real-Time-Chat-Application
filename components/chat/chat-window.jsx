"use client"

import { useState, useRef, useEffect } from "react"
import { useAuthStore } from "@/store/auth-store"
import { useChatStore } from "@/store/chat-store"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, User, Wifi, WifiOff } from "lucide-react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"

export default function ChatWindow({ onSendMessage, socketConnected }) {
  const { user } = useAuthStore()
  const { selectedFriend, messages } = useChatStore()
  const [newMessage, setNewMessage] = useState("")
  const messagesEndRef = useRef(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedFriend) return

    onSendMessage(newMessage.trim())
    setNewMessage("")
  }

  // If no friend is selected, show empty state
  if (!selectedFriend) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8">
        <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center mb-4">
          <User className="h-10 w-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Welcome to Chat</h2>
        <p className="text-gray-500 text-center max-w-md">
          Select a friend from the sidebar to start chatting or search for new friends to connect with.
        </p>
        <div className="mt-4">
          <Badge variant={socketConnected ? "success" : "destructive"} className="flex items-center gap-1">
            {socketConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {socketConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b bg-white flex items-center justify-between">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
            <User className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <h2 className="font-semibold">{selectedFriend.name}</h2>
            <p className="text-sm text-gray-500">{selectedFriend.phone_number}</p>
          </div>
        </div>
        <Badge variant={socketConnected ? "success" : "destructive"} className="flex items-center gap-1">
          {socketConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {socketConnected ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 bg-gray-50">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No messages yet. Start the conversation!</p>
          ) : (
            messages.map((message, index) => {
              const isCurrentUser = message.sender_id === user.id
              return (
                <div key={index} className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isCurrentUser ? "bg-primary text-primary-foreground" : "bg-white border border-gray-200"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p className={`text-xs mt-1 ${isCurrentUser ? "text-primary-foreground/80" : "text-gray-500"}`}>
                      {message.created_at ? format(new Date(message.created_at), "h:mm a · MMM d, yyyy") : "Just now"}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
        <div className="flex items-end gap-2">
          <Textarea
            placeholder={socketConnected ? "Type a message..." : "Waiting for connection..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 min-h-[80px] max-h-[200px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            disabled={!socketConnected}
          />
          <Button type="submit" size="icon" className="h-10 w-10" disabled={!socketConnected || !newMessage.trim()}>
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>
    </div>
  )
}
