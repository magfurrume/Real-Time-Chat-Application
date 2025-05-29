"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  User,
  Wifi,
  WifiOff,
  Menu,
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneCall,
  Mic,
  MicOff,
  CircleDot,
  Paperclip,
  Smile,
  MoreVertical,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import EmojiPicker from "emoji-picker-react";
import { useWebRTC } from "./useWebRTC";
import { CallErrorBoundary } from "./CallErrorBoundary";

export default function ChatWindow({
  onSendMessage,
  socketConnected,
  onOpenSidebar,
  socket,
}) {
  const { user } = useAuthStore();
  const { selectedFriend, messages } = useChatStore();
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Add call timer state
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  // Format time for display (HH:MM:SS)
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const {
    callState,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    cleanUpCall,
  } = useWebRTC({
    socket,
    user,
    selectedFriend,
  });

  useEffect(() => {
    if (callState.isInCall) {
      originalTitleRef.current = document.title;
      const updateTitle = () => {
        document.title = `📞 ${formatTime(callDuration)} - ${
          callState.currentCall?.receiverName || "Call"
        }`;
      };
      updateTitle();
      const titleInterval = setInterval(updateTitle, 1000);
      return () => {
        clearInterval(titleInterval);
        document.title = originalTitleRef.current;
      };
    }
  }, [callState.isInCall, callDuration, callState.currentCall]);

  // Timer control
  useEffect(() => {
    if (callState.isInCall) {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        document.title = originalTitleRef.current;
      }
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callState.isInCall]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedFriend) return;
    onSendMessage(newMessage.trim());
    setNewMessage("");
    setShowEmojiPicker(false);
  };

  const handleEmojiClick = (emojiObject) => {
    const emoji = emojiObject.emoji;
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText =
        newMessage.substring(0, start) + emoji + newMessage.substring(end);
      setNewMessage(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      }, 0);
    } else {
      setNewMessage((prev) => prev + emoji);
    }
  };

  const shouldShowFriendAvatar = (currentMessage, prevMessage) => {
    if (currentMessage.sender_id === user.id) return false;
    if (!prevMessage) return true;
    return currentMessage.sender_id !== prevMessage.sender_id;
  };

  const handleStartCall = useCallback(async () => {
    if (
      !selectedFriend ||
      !socketConnected ||
      callState.isInCall ||
      callState.isCalling
    )
      return;

    try {
      await startCall(selectedFriend.id, selectedFriend.name);
    } catch (error) {
      console.error("Call initiation failed:", error);
    }
  }, [selectedFriend, socketConnected, callState, startCall]);

  // Beautiful call interface component
  const CallInterface = ({ mode, onEndCall, onToggleMute, isMuted }) => {
    const callModes = {
      incoming: {
        title: "Incoming Call",
        description: "is calling you",
        buttons: [
          {
            text: "Decline",
            icon: <PhoneOff className="h-5 w-5" />,
            onClick: onEndCall,
            className: "bg-red-500 hover:bg-red-600",
          },
          {
            text: "Accept",
            icon: <Phone className="h-5 w-5" />,
            onClick: () => {}, // Handled by parent
            className: "bg-green-500 hover:bg-green-600",
          },
        ],
      },
      active: {
        title: "On Call",
        description: formatTime(callDuration),
        buttons: [
          {
            text: isMuted ? "Unmute" : "Mute",
            icon: isMuted ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            ),
            onClick: onToggleMute,
            className: isMuted
              ? "bg-amber-500/90 hover:bg-amber-600/90"
              : "bg-blue-500/90 hover:bg-blue-600/90",
          },
          {
            text: "End",
            icon: <PhoneOff className="h-5 w-5" />,
            onClick: onEndCall,
            className: "bg-red-500 hover:bg-red-600",
          },
        ],
      },
      calling: {
        title: "Calling",
        description: "Ringing...",
        buttons: [
          {
            text: "Cancel",
            icon: <PhoneOff className="h-5 w-5" />,
            onClick: onEndCall,
            className: "bg-red-500 hover:bg-red-600",
          },
        ],
      },
    };

    const currentMode = callModes[mode];
    const callerName =
      callState.currentCall?.receiverName ||
      callState.incomingCall?.callerName ||
      "Caller";

    return (
      <CallErrorBoundary>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-purple-900 flex flex-col items-center justify-center z-50 p-6 text-center">
          {/* Tab-friendly header */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full mr-2 ${
                  mode === "active"
                    ? "bg-green-400 animate-pulse"
                    : "bg-yellow-400"
                }`}
              ></div>
              <span className="text-white/80 text-sm">{currentMode.title}</span>
            </div>
            <span className="text-white/60 text-sm font-mono">
              {mode === "active" ? formatTime(callDuration) : ""}
            </span>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            {/* Animated avatar */}
            <div className="relative mb-8 group">
              <div className="absolute -inset-4 bg-white/10 rounded-full animate-pulse-slow group-hover:animate-none"></div>
              <div className="relative h-32 w-32 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center border-2 border-white/20 transition-all duration-300 group-hover:scale-105 group-hover:border-blue-300">
                <User className="h-16 w-16 text-white" />
                {mode === "active" && (
                  <div className="absolute -bottom-2 -right-2 bg-green-400 rounded-full p-1.5 border-2 border-purple-900">
                    <Mic className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            </div>

            {/* Caller info */}
            <h2 className="text-3xl font-bold text-white mb-2">{callerName}</h2>
            <p className="text-xl text-white/80 mb-8">
              {currentMode.description}
            </p>

            {/* Audio visualization */}
            {mode === "active" && (
              <div className="w-full max-w-md mb-8">
                <div className="flex items-center justify-center space-x-1 h-8">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden"
                    >
                      <div
                        className="h-full bg-green-400 transition-all duration-200"
                        style={{
                          height: `${Math.random() * 80 + 20}%`,
                          opacity: isMuted ? 0.3 : 1,
                        }}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Call controls */}
          <div className="w-full max-w-md">
            <div
              className={`grid ${
                currentMode.buttons.length > 1 ? "grid-cols-2" : "grid-cols-1"
              } gap-4`}
            >
              {currentMode.buttons.map((btn, i) => (
                <Button
                  key={i}
                  onClick={btn.onClick}
                  className={`${btn.className} text-white py-6 rounded-xl shadow-lg transform transition-all hover:scale-105`}
                >
                  <span className="flex items-center justify-center">
                    {btn.icon}
                    <span className="ml-2">{btn.text}</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Quality indicator */}
          {mode === "active" && (
            <div className="absolute bottom-4 right-4 text-white/50 text-xs">
              {callState.audioQuality === "high"
                ? "HD"
                : callState.audioQuality === "medium"
                ? "Standard"
                : "Basic"}
            </div>
          )}
        </div>
      </CallErrorBoundary>
    );
  };

  // Enhanced call controls with illustrative design
  const renderCallControls = () => {
    if (
      callState.incomingCall &&
      callState.incomingCall.callerId === selectedFriend?.id
    ) {
      return (
        <CallInterface
          mode="incoming"
          onEndCall={rejectCall}
          onToggleMute={toggleMute}
          isMuted={callState.isMuted}
        />
      );
    }

    if (callState.isInCall) {
      return (
        <CallInterface
          mode="active"
          onEndCall={endCall}
          onToggleMute={toggleMute}
          isMuted={callState.isMuted}
        />
      );
    }

    if (callState.isCalling) {
      return (
        <CallInterface
          mode="calling"
          onEndCall={endCall}
          onToggleMute={toggleMute}
          isMuted={callState.isMuted}
        />
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
        <h2 className="text-3xl font-bold mb-4 text-foreground">
          Welcome to Chat
        </h2>
        <p className="text-lg text-muted-foreground max-w-md">
          Select a friend from the sidebar to start chatting or search for new
          friends to connect with.
        </p>
        <div className="mt-8">
          <Badge
            variant={socketConnected ? "success" : "destructive"}
            className="flex items-center gap-2 px-5 py-2.5 text-base rounded-full shadow-md transition-all duration-200"
          >
            {socketConnected ? (
              <Wifi className="h-5 w-5" />
            ) : (
              <WifiOff className="h-5 w-5" />
            )}
            {socketConnected ? "Connected to Server" : "Disconnected"}
          </Badge>
        </div>

        {callState.incomingCall && (
          <CallErrorBoundary>
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-background border border-primary shadow-xl p-4 rounded-lg z-50 w-11/12 max-w-sm">
              <div className="flex items-center mb-3">
                <PhoneIncoming className="h-6 w-6 text-primary mr-3 animate-bounce" />
                <h3 className="text-lg font-semibold">Incoming Call</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                From:{" "}
                <span className="font-medium text-foreground">
                  {callState.incomingCall.callerName || "Unknown User"}
                </span>
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  onClick={acceptCall}
                  className="bg-green-500 hover:bg-green-600"
                >
                  Accept
                </Button>
                <Button onClick={rejectCall} variant="destructive">
                  Reject
                </Button>
              </div>
            </div>
          </CallErrorBoundary>
        )}
      </div>
    );
  }

  const isCallActiveOrPending =
    callState.isInCall || callState.isCalling || callState.incomingCall;
  const hasIncomingCallFromOther =
    callState.incomingCall &&
    callState.incomingCall.callerId !== selectedFriend.id;

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col bg-card shadow-xl overflow-hidden relative">
        {renderCallControls()}

        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          style={{ display: "none" }}
        />

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
              <span
                className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[var(--online-indicator)] border-2 border-card"
                title="Online"
              ></span>
            </div>
            <div>
              <h2 className="font-semibold text-xl text-foreground">
                {selectedFriend.name}
              </h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <CircleDot className="h-3 w-3 text-[var(--online-indicator)]" />{" "}
                Active now
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
                  onClick={handleStartCall}
                  disabled={!socketConnected || isCallActiveOrPending}
                >
                  <Phone className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Voice Call</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary hover:bg-primary/10"
                  disabled
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>More Options</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div
          className={`flex-1 overflow-auto p-6 bg-background custom-scrollbar ${
            isCallActiveOrPending ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <div className="space-y-4">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-base">
                Start the conversation! Say hello.
              </p>
            ) : (
              messages.map((message, index) => {
                const isCurrentUser = message.sender_id === user.id;
                const prevMessage = messages[index - 1];
                const showAvatar = shouldShowFriendAvatar(message, prevMessage);

                return (
                  <div
                    key={message.id || index}
                    className={`flex items-end ${
                      isCurrentUser ? "justify-end" : "justify-start"
                    } animate-fade-in`}
                  >
                    {!isCurrentUser && (
                      <div
                        className={`flex-shrink-0 mr-2 ${
                          showAvatar ? "opacity-100" : "opacity-0"
                        } h-8 w-8 rounded-full bg-muted-foreground flex items-center justify-center`}
                      >
                        {showAvatar ? (
                          <User className="h-4 w-4 text-white" />
                        ) : null}
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-xl text-base ${
                        isCurrentUser
                          ? "bg-primary text-primary-foreground rounded-br-none"
                          : "bg-chat-bubble-friend-bg text-chat-bubble-friend-text rounded-bl-none"
                      } shadow-sm`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <p
                        className={`text-xs mt-1 text-right ${
                          isCurrentUser
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground/80"
                        }`}
                      >
                        {message.created_at
                          ? format(new Date(message.created_at), "h:mm a")
                          : "Sending..."}
                      </p>
                    </div>
                    {isCurrentUser && (
                      <div className="flex-shrink-0 ml-2 h-4 w-4 rounded-full bg-muted-foreground flex items-center justify-center opacity-0"></div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`p-4 border-t border-border bg-card shadow-lg sticky bottom-0 relative ${
            isCallActiveOrPending ? "opacity-50 pointer-events-none" : ""
          }`}
        >
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
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
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
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
              placeholder={
                socketConnected
                  ? "Type your message here..."
                  : "Waiting for connection to send message..."
              }
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 min-h-[50px] max-h-[180px] rounded-2xl border border-input focus:border-ring focus:ring-ring transition-all duration-200 p-3 text-base resize-none custom-scrollbar"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              disabled={!socketConnected}
            />
            {!newMessage.trim() ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
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

        {hasIncomingCallFromOther && (
          <CallErrorBoundary>
            <div className="absolute bottom-20 right-4 bg-background border border-primary shadow-xl p-4 rounded-lg z-[100] w-auto max-w-xs">
              <div className="flex items-center mb-2">
                <PhoneIncoming className="h-5 w-5 text-primary mr-2 animate-bounce" />
                <h3 className="text-md font-semibold">Incoming Call</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                From:{" "}
                <span className="font-medium text-foreground">
                  {callState.incomingCall.callerName || "Unknown User"}
                </span>
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={acceptCall}
                  size="sm"
                  className="bg-green-500 hover:bg-green-600"
                >
                  Accept
                </Button>
                <Button onClick={rejectCall} size="sm" variant="destructive">
                  Reject
                </Button>
              </div>
            </div>
          </CallErrorBoundary>
        )}
      </div>
    </TooltipProvider>
  );
}
