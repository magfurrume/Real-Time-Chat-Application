"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useAuthStore } from "@/store/auth-store"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import Sidebar from "@/components/chat/sidebar"
import ChatWindow from "@/components/chat/chat-window"
import { useChatStore } from "@/store/chat-store"
import { io } from "socket.io-client"

// WebRTC related refs and state that need to be managed at a higher level
// if calls can persist across selectedFriend changes, or for global notifications.
// For now, ChatWindow handles its own peerConnection initiation.

export default function ChatLayout() {
  const { user, logout } = useAuthStore()
  const {
    selectedFriend,
    setSelectedFriend, // To potentially switch to caller on incoming call
    friends, // To get caller's name
    setMessages,
    addMessage,
    // messages, // messages not directly used here for call logic
  } = useChatStore()
  const router = useRouter()
  const { toast } = useToast()

  const [socket, setSocket] = useState(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- Call State ---
  const [isInCall, setIsInCall] = useState(false); // Is a call currently active
  const [isCalling, setIsCalling] = useState(false); // Is the current user initiating a call
  const [incomingCallData, setIncomingCallData] = useState(null); // { offer, from, fromSocketId, fromName }
  const [callOfferData, setCallOfferData] = useState(null); // Stores the offer made by this client
  const [currentCallTargetId, setCurrentCallTargetId] = useState(null); // User ID of the person in call or being called
  
  const peerConnectionRef = useRef(null); // Manages the single RTCPeerConnection
  const localStreamRef = useRef(null);    // Manages the local audio stream
  // const remoteStreamRef = useRef(null); // Remote stream is handled in ChatWindow via audio tag

  const messageIdsRef = useRef(new Set())

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Create socket connection
  useEffect(() => {
    if (!user) return

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://192.168.0.40:3005";
    const s = io(socketUrl, {
      auth: { userId: user.id },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    })

    s.on("connect", () => {
      setSocketConnected(true);
      toast({ title: "Connected", description: "Real-time chat and call ready" });
    });
    s.on("connect_error", (err) => {
      setSocketConnected(false);
      toast({ title: "Connection error", description: err.message, variant: "destructive" });
    });
    s.on("disconnect", (reason) => {
      setSocketConnected(false);
      toast({ title: "Disconnected", description: reason, variant: "destructive" });
      // If in call and socket disconnects, end the call
      if (isInCall || isCalling) {
          cleanUpCall(false); // Don't emit end-call if socket is already down
          toast({ title: "Call Ended", description: "Connection lost.", variant: "destructive" });
      }
    });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [user, toast]); // Added toast to dependency array


  // --- WebRTC Call Logic and Socket Event Handlers ---

  const cleanUpCall = useCallback((emitEndCall = true) => {
    console.log("Cleaning up call resources. Emit:", emitEndCall);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    // remoteStream handled by ChatWindow's audio tag
    
    if (emitEndCall && socket && currentCallTargetId) {
      console.log("Emitting end-call to:", currentCallTargetId);
      socket.emit("end-call", { toUserId: currentCallTargetId });
    }

    setIsInCall(false);
    setIsCalling(false);
    setIncomingCallData(null);
    setCallOfferData(null);
    setCurrentCallTargetId(null); // Clear the target
  }, [socket, currentCallTargetId]);


  // Effect for handling call-related socket events
  useEffect(() => {
    if (!socket || !user) return;

    // When another user calls you
    const handleCallMade = async ({ offer, from, fromSocketId }) => {
      console.log("Call made from:", from, "Offer:", offer);
      if (isInCall || isCalling) {
        // If current user is busy, automatically reject the call
        console.log("User is busy, rejecting incoming call from", from);
        socket.emit("reject-call", { toUserId: from, reason: "busy" }); // Send to original caller
        return;
      }
      const caller = friends.find(f => f.id.toString() === from.toString());
      setIncomingCallData({ offer, from, fromSocketId, fromName: caller?.name || `User ${from}` });
      setCurrentCallTargetId(from.toString()); // Track who is calling
      toast({
        title: "Incoming Call",
        description: `Call from ${caller?.name || "Unknown"}. Open their chat to respond.`,
        duration: 10000,
      });
      // If chat with caller is open, ChatWindow will show controls.
      // Otherwise, a global notification could be shown.
    };

    // When your call offer is answered
    const handleAnswerMade = async ({ answer, from }) => {
      console.log("Answer made by:", from, "Answer:", answer);
      if (peerConnectionRef.current && callOfferData) { // Check if we made an offer
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setIsCalling(false); // No longer "calling", now "in call"
          setIsInCall(true);
          // currentCallTargetId should already be set from startCall
          console.log("Call established with", from);
          toast({ title: "Call Connected", description: `Call with ${friends.find(f=>f.id.toString() === from.toString())?.name || from} started.`});
        } catch (error) {
            console.error("Error setting remote description:", error);
            toast({ title: "Call Error", description: "Failed to establish call.", variant: "destructive" });
            cleanUpCall();
        }
      }
    };

    // Handle receiving ICE candidates
    const handleIceCandidate = async ({ candidate, from }) => {
      // console.log("Received ICE candidate from:", from, candidate);
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding received ICE candidate:", error);
        }
      }
    };

    // When a call you initiated or received is rejected
    const handleCallRejected = ({ from }) => {
      console.log("Call rejected by:", from);
      toast({
        title: "Call Rejected",
        description: `Your call with ${friends.find(f=>f.id.toString() === from.toString())?.name || from} was rejected.`,
        variant: "info",
      });
      cleanUpCall(false); // Don't emit end-call as it was rejected, not ended by us
    };

    // When the other user ends the call or disconnects
    const handleCallEnded = ({ from, reason }) => {
      console.log("Call ended by:", from, "Reason:", reason || "Hung up");
      toast({
        title: "Call Ended",
        description: `Call with ${friends.find(f=>f.id.toString() === from.toString())?.name || from} has ended.`,
      });
      cleanUpCall(false); // The other party already signaled the end or disconnected
    };

    const handleCallBusy = ({ userId, message }) => {
        toast({ title: "User Busy", description: message || `User ${userId} is busy.`, variant: "info" });
        // If we were the one calling, clean up our calling state
        if (isCalling && currentCallTargetId === userId.toString()) {
            cleanUpCall(false);
        }
    };
    
    const handleCallUnavailable = ({ userId, message }) => {
        toast({ title: "User Unavailable", description: message || `User ${userId} is unavailable for calls.`, variant: "info" });
        if (isCalling && currentCallTargetId === userId.toString()) {
            cleanUpCall(false);
        }
    };


    socket.on("call-made", handleCallMade);
    socket.on("answer-made", handleAnswerMade);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("call-rejected", handleCallRejected);
    socket.on("call-ended", handleCallEnded);
    socket.on("call-busy", handleCallBusy);
    socket.on("call-unavailable", handleCallUnavailable);


    return () => {
      socket.off("call-made", handleCallMade);
      socket.off("answer-made", handleAnswerMade);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("call-rejected", handleCallRejected);
      socket.off("call-ended", handleCallEnded);
      socket.off("call-busy", handleCallBusy);
      socket.off("call-unavailable", handleCallUnavailable);
    };
  }, [socket, user, isInCall, isCalling, callOfferData, cleanUpCall, friends, toast]);


  // Called from ChatWindow when user initiates a call
  const handleCallStateChange = useCallback(async (action) => {
    if (!socket || !selectedFriend) return;

    if (action.type === "INITIATING_CALL") {
      if (isInCall || isCalling) {
        toast({ title: "Call In Progress", description: "You are already in a call or calling someone.", variant: "info" });
        return;
      }
      setCurrentCallTargetId(action.targetId.toString());
      setIsCalling(true);
      setIncomingCallData(null); // Clear any previous incoming call data if we are initiating

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;

        // Initialize PC, add tracks
        // Note: initializePeerConnection is now passed to ChatWindow to be called there
        // We just set up the state here. The offer will be created and sent by ChatWindow's startCall.
        // The peerConnectionRef will be set by ChatWindow via the onAcceptCall callback (or its own startCall)

      } catch (error) {
        console.error("Error getting user media for outgoing call:", error);
        toast({ title: "Microphone Error", description: "Could not access microphone.", variant: "destructive" });
        cleanUpCall(false);
      }
    } else if (action.type === "CALL_FAILED") {
        cleanUpCall(false); // Don't emit if local failure
    }
  }, [socket, selectedFriend, isInCall, isCalling, toast, cleanUpCall]);


  const handleAcceptCall = useCallback(async (initializePcFn) => {
    if (!socket || !incomingCallData) return;

    setIsCalling(false); // Not initiating
    setIsInCall(true);   // Now in call
    // currentCallTargetId is already set by 'call-made' handler
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = initializePcFn(false); // Call the initializer passed from ChatWindow
      peerConnectionRef.current = pc; // Store the PC instance locally in ChatLayout
      
      // Ensure local tracks are added to the peer connection
      localStreamRef.current.getTracks().forEach(track => {
        if (peerConnectionRef.current.getSenders().find(sender => sender.track === track)) {
          // Track already added
          return;
        }
        peerConnectionRef.current.addTrack(track, localStreamRef.current);
      });
      
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      socket.emit("make-answer", {
        answer,
        toSocketId: incomingCallData.fromSocketId, // Send answer back to original caller's socket
        toUserId: incomingCallData.from, // And their user ID
      });
      
      setIncomingCallData(null); // Clear incoming call once accepted
      toast({ title: "Call Accepted", description: `Call with ${incomingCallData.fromName} started.` });

    } catch (error) {
      console.error("Error accepting call:", error);
      toast({ title: "Call Error", description: "Failed to accept call.", variant: "destructive" });
      cleanUpCall(true); // Emit end-call if failed during acceptance
    }
  }, [socket, incomingCallData, friends, toast, cleanUpCall]);


  const handleRejectCall = useCallback(() => {
    if (!socket || !incomingCallData) return;
    socket.emit("reject-call", { toUserId: incomingCallData.from });
    setIncomingCallData(null);
    setCurrentCallTargetId(null);
    toast({ title: "Call Rejected", description: `You rejected the call from ${incomingCallData.fromName}.` });
  }, [socket, incomingCallData, toast]);


  const handleEndCall = useCallback(() => {
    toast({ title: "Call Ended", description: `You ended the call with ${currentCallTargetId ? (friends.find(f=>f.id.toString() === currentCallTargetId)?.name || `User ${currentCallTargetId}`) : 'the user'}.` });
    cleanUpCall(true); // True to emit 'end-call' to the other party
  }, [currentCallTargetId, friends, toast, cleanUpCall]);


  // 2. Listen for incoming messages (existing logic)
  useEffect(() => {
    if (!socket) return

    const handleIncomingMessage = (msg) => {
      if (!messageIdsRef.current.has(msg.id)) {
        messageIdsRef.current.add(msg.id)

        if (
          selectedFriend &&
          (msg.sender_id.toString() === selectedFriend.id.toString() ||
           msg.receiver_id.toString() === selectedFriend.id.toString()) &&
           msg.sender_id.toString() !== user.id.toString() // Only add if it's from the selected friend
        ) {
          addMessage(msg)
        } else if (msg.sender_id.toString() !== user?.id.toString()) {
          // If it's not for the currently selected friend, show a toast
          const sender = friends.find(f => f.id.toString() === msg.sender_id.toString());
          toast({
            title: `New message from ${sender ? sender.name : "Unknown"}`,
            description: msg.content.substring(0, 30) + "...",
            action: (
                <Button variant="link" size="sm" onClick={() => {
                    if (sender) setSelectedFriend(sender);
                }}>
                    Open Chat
                </Button>
            )
          })
        }
        // If the message is an echo of what current user sent, ChatWindow already has it (optimistic update)
        // Server also sends it back via socket.emit("message", message) to sender for confirmation.
        // If we want to rely purely on server confirmation for sender's messages:
        else if (selectedFriend && msg.sender_id.toString() === user.id.toString() && msg.receiver_id.toString() === selectedFriend.id.toString()) {
            // This is a confirmation of our own message, potentially update its status (e.g., delivered)
            // For now, assuming optimistic updates are sufficient unless specific delivery status is needed.
            // addMessage(msg); // Could add it here if not doing optimistic updates.
        }
      }
    }
    socket.on("message", handleIncomingMessage);
    socket.on("messageError", ({ message }) => {
        toast({ title: "Message Error", description: message, variant: "destructive" });
    });

    return () => {
      socket.off("message", handleIncomingMessage);
      socket.off("messageError");
    }
  }, [socket, selectedFriend, user, addMessage, toast, friends, setSelectedFriend]);

  // 3. Load message history (existing logic)
  useEffect(() => {
    if (!selectedFriend || !user) { // Added user check
        setMessages([]); // Clear messages if no friend selected
        return;
    }
    messageIdsRef.current.clear(); // Clear message IDs when friend changes
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages/${selectedFriend.id}`)
        if (res.ok) {
          const { messages: fetchedMessages } = await res.json()
          fetchedMessages.forEach((m) => messageIdsRef.current.add(m.id))
          setMessages(fetchedMessages)
        } else {
            toast({ title: "Error", description: "Failed to load messages.", variant: "destructive" });
            setMessages([]);
        }
      } catch (err) {
        console.error("Error loading messages:", err)
        toast({ title: "Error", description: "Failed to load messages.", variant: "destructive" });
        setMessages([]);
      }
    }
    fetchMessages()
  }, [selectedFriend, user, setMessages, toast]) // Added user and toast

  // 4. Send message (existing logic)
  const handleSendMessage = (content) => {
    if (!selectedFriend || !content.trim() || !socket || !user) return

    // Optimistic update
    const tempMessage = {
      id: `temp-${Date.now()}`, // Temporary ID
      sender_id: user.id,
      receiver_id: selectedFriend.id,
      content,
      created_at: new Date().toISOString(), // Or use a "sending..." state
    };
    addMessage(tempMessage); // Add to local state immediately
    messageIdsRef.current.add(tempMessage.id);


    socket.emit("sendMessage", {
      receiverId: selectedFriend.id,
      content,
    })
  }

  // 5. Logout (existing logic)
  const handleLogout = async () => {
    if (socket) {
        if (isInCall || isCalling) {
            cleanUpCall(true); // Attempt to notify other user if in call
        }
        socket.disconnect();
    }
    await fetch("/api/auth/logout", { method: "POST" })
    logout()
    toast({ title: "Logged out", description: "See you again!" })
    router.push("/")
  }

  const handleOpenSidebar = () => setIsSidebarOpen(true);
  const handleCloseSidebar = () => setIsSidebarOpen(false);

 return (
    <div className="flex h-screen bg-background relative overflow-hidden">
      <div className={`
        fixed inset-y-0 left-0 z-50
        w-80 h-full bg-card shadow-xl transition-transform duration-300 ease-in-out
        transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        sm:translate-x-0 sm:relative sm:w-80 sm:block
        rounded-r-2xl sm:rounded-none sm:shadow-none
      `}>
        <Sidebar
          onLogout={handleLogout}
          onSelectFriend={(friend) => {
            setSelectedFriend(friend); // Ensure this updates selectedFriend for ChatWindow
            handleCloseSidebar();
          }}
          onClose={handleCloseSidebar}
          selectedFriendId={selectedFriend?.id}
          incomingCallFromId={incomingCallData?.from}
        />
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
          onClick={handleCloseSidebar}
        ></div>
      )}

      <div className="flex-1 min-w-0 flex flex-col z-10">
        <ChatWindow
          socket={socket}
          onSendMessage={handleSendMessage}
          socketConnected={socketConnected}
          onOpenSidebar={handleOpenSidebar}
          // Call related props
          onCallStateChange={handleCallStateChange}
          incomingCallData={incomingCallData}
          onAcceptCall={handleAcceptCall}
          onRejectCall={handleRejectCall}
          onEndCall={handleEndCall}
          isInCall={isInCall}
          isCalling={isCalling}
          currentCallTargetId={currentCallTargetId}
        />
      </div>
    </div>
  )
}