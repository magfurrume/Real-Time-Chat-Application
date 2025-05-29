"use client";
import { useState, useRef } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import { useWebRTC } from "./useWebRTC";
import { CallErrorBoundary } from "./CallErrorBoundary";
import { CallInterface } from "./CallInterface/CallInterface";
import { ChatHeader } from "./ChatHeader/ChatHeader";
import { MessageList } from "./MessageList/MessageList";
import { MessageInput } from "./MessageInput/MessageInput";
import { EmptyChatState } from "./EmptyChatState";

export default function ChatWindow({
  onSendMessage,
  socketConnected,
  onOpenSidebar,
  socket,
}) {
  const { user } = useAuthStore();
  const { selectedFriend, messages } = useChatStore();

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

  const handleStartCall = () => {
    if (
      !selectedFriend ||
      !socketConnected ||
      callState.isInCall ||
      callState.isCalling
    )
      return;

    try {
      startCall(selectedFriend.id, selectedFriend.name);
    } catch (error) {
      console.error("Call initiation failed:", error);
    }
  };

  if (!selectedFriend) {
    return (
      <EmptyChatState
        socketConnected={socketConnected}
        onOpenSidebar={onOpenSidebar}
        callState={callState}
        acceptCall={acceptCall}
        rejectCall={rejectCall}
      />
    );
  }

  const isCallActiveOrPending =
    callState.isInCall || callState.isCalling || callState.incomingCall;
  const hasIncomingCallFromOther =
    callState.incomingCall &&
    callState.incomingCall.callerId !== selectedFriend.id;

  return (
    <div className="flex-1 flex flex-col bg-card shadow-xl overflow-hidden relative">
      {/* Call related components */}
      <CallInterface
        callState={callState}
        selectedFriend={selectedFriend}
        rejectCall={rejectCall}
        endCall={endCall}
        toggleMute={toggleMute}
      />

      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ display: "none" }}
      />

      {/* Chat UI */}
      <ChatHeader
        selectedFriend={selectedFriend}
        onOpenSidebar={onOpenSidebar}
        socketConnected={socketConnected}
        isCallActiveOrPending={isCallActiveOrPending}
        handleStartCall={handleStartCall}
      />

      <MessageList
        messages={messages}
        user={user}
        isCallActiveOrPending={isCallActiveOrPending}
      />

      <MessageInput
        onSendMessage={onSendMessage}
        socketConnected={socketConnected}
        isCallActiveOrPending={isCallActiveOrPending}
      />

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
  );
}
