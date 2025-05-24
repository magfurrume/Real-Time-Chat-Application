// hooks/useCallHandlers.js
import { useState, useEffect, useRef, useCallback } from "react";

export function useCallHandlers({ socket, user, selectedFriend, friends, toast }) {
  const [isInCall, setIsInCall] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [callOfferData, setCallOfferData] = useState(null);
  const [currentCallTargetId, setCurrentCallTargetId] = useState(null);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const cleanUpCall = useCallback((emitEndCall = true) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (emitEndCall && socket && currentCallTargetId) {
      socket.emit("end-call", { toUserId: currentCallTargetId });
    }
    setIsInCall(false);
    setIsCalling(false);
    setIncomingCallData(null);
    setCallOfferData(null);
    setCurrentCallTargetId(null);
  }, [socket, currentCallTargetId]);

  useEffect(() => {
    if (!socket || !user) return;

    const handleCallMade = ({ offer, from, fromSocketId }) => {
      if (isInCall || isCalling) {
        socket.emit("reject-call", { toUserId: from, reason: "busy" });
        return;
      }
      const caller = friends.find(f => f.id.toString() === from.toString());
      setIncomingCallData({ offer, from, fromSocketId, fromName: caller?.name || `User ${from}` });
      setCurrentCallTargetId(from.toString());
      toast({
        title: "Incoming Call",
        description: `Call from ${caller?.name || "Unknown"}`,
        duration: 10000,
      });
    };

    const handleAnswerMade = async ({ answer }) => {
      if (peerConnectionRef.current && callOfferData) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setIsCalling(false);
          setIsInCall(true);
          toast({ title: "Call Connected", description: "Call established." });
        } catch {
          toast({ title: "Call Error", description: "Failed to connect.", variant: "destructive" });
          cleanUpCall();
        }
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding ICE candidate", err);
        }
      }
    };

    const handleCallRejected = ({ from }) => {
      toast({ title: "Call Rejected", description: `Call rejected by ${from}` });
      cleanUpCall(false);
    };

    const handleCallEnded = ({ from }) => {
      toast({ title: "Call Ended", description: `Call ended by ${from}` });
      cleanUpCall(false);
    };

    socket.on("call-made", handleCallMade);
    socket.on("answer-made", handleAnswerMade);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("call-rejected", handleCallRejected);
    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off("call-made", handleCallMade);
      socket.off("answer-made", handleAnswerMade);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("call-rejected", handleCallRejected);
      socket.off("call-ended", handleCallEnded);
    };
  }, [socket, user, isInCall, isCalling, callOfferData, friends, toast, cleanUpCall]);

  const handleCallStateChange = useCallback(async ({ type, targetId }) => {
    if (!socket || !selectedFriend) return;
    if (type === "INITIATING_CALL") {
      if (isInCall || isCalling) {
        toast({ title: "Already in Call", description: "You are in another call." });
        return;
      }
      setIsCalling(true);
      setCurrentCallTargetId(targetId);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
      } catch (err) {
        toast({ title: "Error", description: "Cannot access microphone.", variant: "destructive" });
        cleanUpCall(false);
      }
    }
  }, [socket, selectedFriend, isInCall, isCalling, cleanUpCall, toast]);

  const handleAcceptCall = useCallback(async (initializePcFn) => {
    if (!socket || !incomingCallData) return;
    setIsInCall(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = initializePcFn(false);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("make-answer", {
        answer,
        toSocketId: incomingCallData.fromSocketId,
        toUserId: incomingCallData.from,
      });
      setIncomingCallData(null);
      toast({ title: "Call Accepted" });
    } catch (err) {
      toast({ title: "Call Error", description: "Failed to accept call", variant: "destructive" });
      cleanUpCall(true);
    }
  }, [socket, incomingCallData, toast, cleanUpCall]);

  const handleRejectCall = useCallback(() => {
    if (!socket || !incomingCallData) return;
    socket.emit("reject-call", { toUserId: incomingCallData.from });
    setIncomingCallData(null);
    setCurrentCallTargetId(null);
    toast({ title: "Call Rejected" });
  }, [socket, incomingCallData, toast]);

  const handleEndCall = useCallback(() => {
    toast({ title: "Call Ended" });
    cleanUpCall(true);
  }, [toast, cleanUpCall]);

  return {
    isInCall,
    isCalling,
    incomingCallData,
    currentCallTargetId,
    handleCallStateChange,
    handleAcceptCall,
    handleRejectCall,
    handleEndCall,
    cleanUpCall,
  };
}
