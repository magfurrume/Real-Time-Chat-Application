"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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
  Video, // We can use this for a future video call feature
  MoreVertical,
  Paperclip,
  Smile,
  Mic,
  CircleDot,
  PhoneOff, // For ending call / rejecting call
  PhoneIncoming, // For incoming call
  PhoneCall // For outgoing call / active call
} from "lucide-react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import EmojiPicker from 'emoji-picker-react';

// Configuration for RTCPeerConnection
const RTC_CONFIGURATION = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function ChatWindow({
  onSendMessage,
  socketConnected,
  onOpenSidebar,
  socket, // Pass socket directly for call handling
  onCallStateChange, // Callback to inform ChatLayout about call status
  incomingCallData, // Data for an incoming call
  onAcceptCall,     // Function to accept a call
  onRejectCall,     // Function to reject a call
  onEndCall,        // Function to end an active call
  isInCall,         // Boolean indicating if currently in a call
  isCalling,        // Boolean indicating if currently making a call
  currentCallTargetId, // ID of the user in the current call or being called
}) {
  const { user } = useAuthStore()
  const { selectedFriend, messages } = useChatStore()
  const [newMessage, setNewMessage] = useState("")
  const messagesEndRef = useRef(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);

  // WebRTC Refs
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remoteAudioRef = useRef(null); // Ref for the remote audio element

  // Local call state for UI feedback (e.g., "Calling...")
  const [callStatusMessage, setCallStatusMessage] = useState("");


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Cleanup on component unmount or when selectedFriend changes
  useEffect(() => {
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    };
  }, [selectedFriend]);


  const handleSubmit = (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedFriend) return

    onSendMessage(newMessage.trim())
    setNewMessage("")
    setShowEmojiPicker(false);
  }

  const shouldShowFriendAvatar = (currentMessage, prevMessage) => {
    if (currentMessage.sender_id === user.id) return false
    if (!prevMessage) return true
    return currentMessage.sender_id !== prevMessage.sender_id
  }

  const handleEmojiClick = (emojiObject) => {
    const emoji = emojiObject.emoji;
    const textarea = textareaRef.current;
    if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = newMessage.substring(0, start) + emoji + newMessage.substring(end);
        setNewMessage(newText);
        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        }, 0);
    } else {
        setNewMessage((prev) => prev + emoji);
    }
  };

  // --- WebRTC Call Functions ---

  const initializePeerConnection = useCallback((isInitiator) => {
    if (peerConnectionRef.current) {
        peerConnectionRef.current.close(); // Close existing connection if any
    }
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);

    pc.onicecandidate = (event) => {
      if (event.candidate && selectedFriend && socket) {
        // console.log("Sending ICE candidate to:", selectedFriend.id, event.candidate);
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          toUserId: selectedFriend.id,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Remote track received:", event.streams[0]);
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteStreamRef.current = event.streams[0];
      }
    };

    // Add local tracks if stream is ready
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    } else {
        console.warn("Local stream not ready when initializing peer connection");
    }

    peerConnectionRef.current = pc;
    return pc;
  }, [socket, selectedFriend]);


const startCall = async () => {
  if (!selectedFriend || !socket) return;
  if (isInCall || isCalling) {
    console.log("Already in a call or attempting to call.");
    return;
  }

  console.log(`Attempting to call ${selectedFriend.name}`);
  setCallStatusMessage(`Calling ${selectedFriend.name}...`);
  onCallStateChange({ type: "INITIATING_CALL", targetId: selectedFriend.id });

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;

    /**
     * ❗ We no longer add tracks here.
     * `initializePeerConnection(true)` will handle adding the tracks from `localStreamRef.current`.
     */
    const pc = initializePeerConnection(true);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("call-user", {
      to: selectedFriend.id,
      offer: offer,
    });
  } catch (error) {
    console.error("Error starting call:", error);
    setCallStatusMessage("Failed to start call.");
    onCallStateChange({ type: "CALL_FAILED" });

    // Stop and clean up local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  }
};


  const handleAcceptCall = async () => {
    if (!incomingCallData || !socket) return;
    setCallStatusMessage(`Answering call from ${incomingCallData.fromName}...`);
    onAcceptCall(initializePeerConnection); // Pass initializer
  };

  const handleRejectCall = () => {
    if (!incomingCallData || !socket) return;
    setCallStatusMessage("Call rejected.");
    onRejectCall();
  };

  const handleEndCall = () => {
    setCallStatusMessage("Call ended.");
    onEndCall(); // This will be handled in ChatLayout
  };


  // Render Call UI
  const renderCallControls = () => {
    // If there's an incoming call for the selected friend
    if (incomingCallData && incomingCallData.from === selectedFriend?.id) {
      return (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50 p-4 text-center">
          <p className="text-xl font-semibold text-white mb-2">Incoming call from</p>
          <p className="text-2xl font-bold text-white mb-6">{incomingCallData.fromName || "Unknown"}</p>
          <div className="flex gap-4">
            <Button onClick={handleAcceptCall} className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg">
              <Phone className="mr-2 h-5 w-5" /> Accept
            </Button>
            <Button onClick={handleRejectCall} variant="destructive" className="px-6 py-3 rounded-lg">
              <PhoneOff className="mr-2 h-5 w-5" /> Reject
            </Button>
          </div>
        </div>
      );
    }

    // If currently in a call with the selected friend
    if (isInCall && currentCallTargetId === selectedFriend?.id) {
      return (
        <div className="p-2 bg-destructive/10 text-center border-b border-border">
          <p className="text-sm text-destructive font-semibold">In call with {selectedFriend.name}</p>
          <Button onClick={handleEndCall} variant="destructive" size="sm" className="mt-1">
            <PhoneOff className="mr-2 h-4 w-4" /> End Call
          </Button>
        </div>
      );
    }

    // If currently trying to call the selected friend
    if (isCalling && currentCallTargetId === selectedFriend?.id) {
      return (
        <div className="p-2 bg-blue-500/10 text-center border-b border-border">
          <p className="text-sm text-blue-600 font-semibold">
            <PhoneCall className="inline mr-2 h-4 w-4 animate-pulse" />
            Calling {selectedFriend.name}...
          </p>
          <Button onClick={handleEndCall} variant="outline" size="sm" className="mt-1 border-destructive text-destructive hover:bg-destructive/10">
            <PhoneOff className="mr-2 h-4 w-4" /> Cancel
          </Button>
        </div>
      );
    }
    return null;
  };


  if (!selectedFriend) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-card p-8 text-center rounded-2xl m-4 shadow-xl relative">
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
         {/* Global Incoming Call Notification (when no friend is selected, or call is from someone else) */}
        {incomingCallData && !selectedFriend && (
             <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-background border border-primary shadow-xl p-4 rounded-lg z-50 w-11/12 max-w-sm">
              <div className="flex items-center mb-3">
                <PhoneIncoming className="h-6 w-6 text-primary mr-3 animate-bounce"/>
                <h3 className="text-lg font-semibold">Incoming Call</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                From: <span className="font-medium text-foreground">{incomingCallData.fromName || "Unknown User"}</span>
              </p>
              <div className="flex justify-end gap-3">
                <Button onClick={handleAcceptCall} className="bg-green-500 hover:bg-green-600">Accept</Button>
                <Button onClick={handleRejectCall} variant="destructive">Reject</Button>
              </div>
            </div>
        )}
      </div>
    )
  }

  const isCallActiveOrPendingWithSelectedFriend = (isInCall || isCalling) && currentCallTargetId === selectedFriend.id;
  const hasIncomingCallFromSelectedFriend = incomingCallData && incomingCallData.from === selectedFriend.id;

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col bg-card shadow-xl overflow-hidden relative"> {/* Added relative for call UI positioning */}
        {/* Call Controls / Status for selected friend */}
        {renderCallControls()}

        {/* Remote Audio Element */}
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />


        {/* Chat Header */}
        <div className="p-4 border-b border-border bg-card flex items-center justify-between shadow-sm">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSidebar}
              className="mr-3 sm:hidden z-10"
              title="Open Sidebar"
            >
              <Menu className="h-6 w-6 text-foreground" />
            </Button>
            <div className="relative h-12 w-12 rounded-full bg-chat-avatar-blue-light flex items-center justify-center mr-3 flex-shrink-0">
              <User className="h-7 w-7 text-chat-avatar-blue-dark" />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[var(--online-indicator)] border-2 border-card" title="Online"></span>
            </div>
            <div>
              <h2 className="font-semibold text-xl text-foreground">{selectedFriend.name}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <CircleDot className="h-3 w-3 text-[var(--online-indicator)]" /> Active now
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary hover:bg-primary/10"
                  onClick={startCall}
                  disabled={!socketConnected || isInCall || isCalling || (incomingCallData && incomingCallData.from !== selectedFriend.id) /* Disable if in call, calling, or incoming call from someone else */ }
                >
                  <Phone className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{(isInCall || isCalling) ? "Call actions managed above" : "Voice Call"}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10" disabled> {/* Video call disabled for now */}
                  <Video className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Video Call (Coming Soon)</p>
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
        <div className={`flex-1 overflow-auto p-6 bg-background custom-scrollbar ${isCallActiveOrPendingWithSelectedFriend || hasIncomingCallFromSelectedFriend ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="space-y-4">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-base">Start the conversation! Say hello.</p>
            ) : (
              messages.map((message, index) => {
                const isCurrentUser = message.sender_id === user.id
                const prevMessage = messages[index - 1]
                const showAvatar = shouldShowFriendAvatar(message, prevMessage)

                return (
                  <div key={message.id || index} className={`flex items-end ${isCurrentUser ? "justify-end" : "justify-start"} animate-fade-in`}>
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
        <form onSubmit={handleSubmit} className={`p-4 border-t border-border bg-card shadow-lg sticky bottom-0 relative ${isCallActiveOrPendingWithSelectedFriend || hasIncomingCallFromSelectedFriend ? 'opacity-50 pointer-events-none' : ''}`}>
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-4 z-50">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                width={300}
                height={400}
                theme="light"
                lazyLoadEmojis={true}
                emojiStyle="native"
              />
            </div>
          )}
          <div className="flex items-end gap-3">
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
                  onClick={() => setShowEmojiPicker(prev => !prev)}
                  type="button"
                >
                  <Smile className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Emoji</p>
              </TooltipContent>
            </Tooltip>
            <Textarea
              ref={textareaRef}
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
         {/* Global Incoming Call Notification (when a friend IS selected, but call is from someone else) */}
        {incomingCallData && selectedFriend && incomingCallData.from !== selectedFriend.id && (
             <div className="absolute bottom-20 right-4 bg-background border border-primary shadow-xl p-4 rounded-lg z-[100] w-auto max-w-xs">
              <div className="flex items-center mb-2">
                <PhoneIncoming className="h-5 w-5 text-primary mr-2 animate-bounce"/>
                <h3 className="text-md font-semibold">Incoming Call</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                From: <span className="font-medium text-foreground">{incomingCallData.fromName || "Unknown User"}</span>
              </p>
              <div className="flex justify-end gap-2">
                <Button onClick={handleAcceptCall} size="sm" className="bg-green-500 hover:bg-green-600">Accept</Button>
                <Button onClick={handleRejectCall} size="sm" variant="destructive">Reject</Button>
              </div>
            </div>
        )}
      </div>
    </TooltipProvider>
  )
}