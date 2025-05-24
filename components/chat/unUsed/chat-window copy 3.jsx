"use client"

import { useState, useRef, useEffect } from "react"
import { useAuthStore } from "@/store/auth-store"
import { useChatStore } from "@/store/chat-store"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Send,
  User,
  Wifi,
  WifiOff,
  Menu,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile, // Already imported, will be used to toggle picker
  Mic,
  CircleDot,
} from "lucide-react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Import the EmojiPicker component
import EmojiPicker from 'emoji-picker-react';

export default function ChatWindow({ onSendMessage, socketConnected, onOpenSidebar, onStartCall }) {
  const { user } = useAuthStore()
  const { selectedFriend, messages } = useChatStore()
  const [newMessage, setNewMessage] = useState("")
  const messagesEndRef = useRef(null)

  // New state for emoji picker visibility
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // Ref for the textarea to control cursor position
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedFriend) return

    onSendMessage(newMessage.trim())
    setNewMessage("")
    setShowEmojiPicker(false); // Close emoji picker after sending
  }

  // Helper function to determine if an avatar should be shown for a friend's message
  const shouldShowFriendAvatar = (currentMessage, prevMessage, currentIndex) => {
    if (currentMessage.sender_id === user.id) return false
    if (!prevMessage) return true
    return currentMessage.sender_id !== prevMessage.sender_id
  }

  // Handler for emoji selection
  const handleEmojiClick = (emojiObject) => {
    const emoji = emojiObject.emoji;
    const textarea = textareaRef.current;

    if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        // Insert emoji at the current cursor position
        const newText = newMessage.substring(0, start) + emoji + newMessage.substring(end);
        setNewMessage(newText);

        // Move cursor to after the inserted emoji
        // Using setTimeout to ensure state update has rendered before setting selection
        setTimeout(() => {
            textarea.focus(); // Keep focus on textarea
            textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        }, 0);
    } else {
        // Fallback: append emoji if textareaRef is not available
        setNewMessage((prev) => prev + emoji);
    }
  };

  // If no friend is selected, show empty state
  if (!selectedFriend) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-card p-8 text-center rounded-2xl m-4 shadow-xl relative">
        {/* Mobile Sidebar Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSidebar}
          className="absolute top-4 left-4 sm:hidden z-10"
          title="Open Sidebar"
        >
          <Menu className="h-6 w-6 text-foreground" />
        </Button>

        <div className="h-28 w-28 rounded-full bg-chat-avatar-blue-light flex items-center justify-center mb-6 animate-pulse-slow">
          <User className="h-14 w-14 text-chat-avatar-blue-dark" />
        </div>
        <h2 className="text-3xl font-bold mb-4 text-foreground">Welcome to Chat</h2>
        <p className="text-lg text-muted-foreground max-w-md">
          Select a friend from the sidebar to start chatting or search for new friends to connect with.
        </p>
        <div className="mt-8">
          <Badge variant={socketConnected ? "success" : "destructive"} className="flex items-center gap-2 px-5 py-2.5 text-base rounded-full shadow-md transition-all duration-200">
            {socketConnected ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            {socketConnected ? "Connected to Server" : "Disconnected"}
          </Badge>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col bg-card  shadow-xl overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-border bg-card flex items-center justify-between shadow-sm">
          <div className="flex items-center">
            {/* Mobile Sidebar Toggle Button (when a friend is selected) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSidebar}
              className="mr-3 sm:hidden z-10"
              title="Open Sidebar"
            >
              <Menu className="h-6 w-6 text-foreground" />
            </Button>

            {/* Friend's Avatar */}
            <div className="relative h-12 w-12 rounded-full bg-chat-avatar-blue-light flex items-center justify-center mr-3 flex-shrink-0">
              <User className="h-7 w-7 text-chat-avatar-blue-dark" />
              {/* Online indicator */}
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[var(--online-indicator)] border-2 border-card" title="Online"></span>
            </div>

            {/* Friend's Name and Status */}
            <div>
              <h2 className="font-semibold text-xl text-foreground">{selectedFriend.name}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <CircleDot className="h-3 w-3 text-[var(--online-indicator)]" /> Active now
              </p>
            </div>
          </div>

          {/* Action Buttons (Call, Video, More Options) */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10">
                  <Phone className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <Button onClick={onStartCall} disabled={!socketConnected} variant="outline" className="flex gap-2 items-center">
          <Phone className="w-5 h-5" /> Call
        </Button>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10">
                  <Video className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Video Call</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>More Options</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-6 bg-background custom-scrollbar">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-base">Start the conversation! Say hello.</p>
            ) : (
              messages.map((message, index) => {
                const isCurrentUser = message.sender_id === user.id
                const prevMessage = messages[index - 1]
                const showAvatar = shouldShowFriendAvatar(message, prevMessage, index)

                return (
                  <div key={message.id || index} className={`flex items-end ${isCurrentUser ? "justify-end" : "justify-start"} animate-fade-in`}>
                    {/* Friend's Avatar (conditional render) */}
                    {!isCurrentUser && (
                      <div className={`flex-shrink-0 mr-2 ${showAvatar ? 'opacity-100' : 'opacity-0'} h-8 w-8 rounded-full bg-muted-foreground flex items-center justify-center`}>
                        {showAvatar ? <User className="h-4 w-4 text-white" /> : null}
                      </div>
                    )}

                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-xl text-base ${
                        isCurrentUser
                          ? "bg-primary text-primary-foreground rounded-br-none"
                          : "bg-chat-bubble-friend-bg text-chat-bubble-friend-text rounded-bl-none"
                      } shadow-sm`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      <p className={`text-xs mt-1 text-right ${isCurrentUser ? "text-primary-foreground/80" : "text-muted-foreground/80"}`}>
                        {message.created_at ? format(new Date(message.created_at), "h:mm a") : "Sending..."}
                      </p>
                    </div>

                    {isCurrentUser && (
                        <div className="flex-shrink-0 ml-2 h-4 w-4 rounded-full bg-muted-foreground flex items-center justify-center opacity-0">
                        </div>
                    )}
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        {/* Added relative to the form for absolute positioning of the emoji picker */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-card shadow-lg  bottom-0 relative">
          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-4 z-50"> {/* Position above input area */}
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                width={300} // Adjust width as needed
                height={400} // Adjust height as needed
                theme="light" // Or "dark" based on your theme, or "auto"
                skinTonePickerLocation="PREVIEW" // You can change this
                searchDisabled={false} // Enable search bar
                lazyLoadEmojis={true}
                emojiStyle="native" // Use native emojis or "facebook", "twitter", "google", "apple"
                // Add more props as needed from emoji-picker-react docs
              />
            </div>
          )}

          <div className="flex items-end gap-3">
            {/* Left-side icons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  <Paperclip className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Attach File</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setShowEmojiPicker(prev => !prev)} // Toggle emoji picker visibility
                  type="button" // Important: Prevents form submission when clicking this button
                >
                  <Smile className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Emoji</p>
              </TooltipContent>
            </Tooltip>

            <Textarea
              ref={textareaRef} // Assign the ref here
              placeholder={socketConnected ? "Type your message here..." : "Waiting for connection to send message..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 min-h-[50px] max-h-[180px] rounded-2xl border border-input focus:border-ring focus:ring-ring transition-all duration-200 p-3 text-base resize-none custom-scrollbar"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              disabled={!socketConnected}
            />

            {/* Right-side icons/buttons */}
            {!newMessage.trim() ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                    <Mic className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Voice Message</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 transition-all duration-200 shadow-md"
                disabled={!socketConnected || !newMessage.trim()}
              >
                <Send className="h-5 w-5 text-primary-foreground" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </TooltipProvider>
  )
}