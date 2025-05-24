// hooks/useWebRTC.js
import { useState, useRef, useEffect, useCallback } from "react";

export function useWebRTC({ socket, user, selectedFriend, toast }) {
  const [callState, setCallState] = useState({
    isInCall: false,
    isCalling: false,
    incomingCall: null,
    currentCall: null,
    isMuted: false
  });

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const ringtoneRef = useRef(null);

  const cleanUpCall = useCallback((emitEndCall = true) => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    if (emitEndCall && socket && callState.currentCall?.receiverId) {
      socket.emit("end-call", { 
        callId: callState.currentCall.callId,
        userId: user.id 
      });
    }
    setCallState(prev => ({
      ...prev,
      isInCall: false,
      isCalling: false,
      incomingCall: null,
      currentCall: null
    }));
  }, [socket, callState.currentCall, user?.id]);

  const setupPeerConnection = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(e => console.error("Audio play error:", e));
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && callState.currentCall?.receiverId) {
          socket.emit("ice-candidate", {
            receiverId: callState.currentCall.receiverId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected") {
          cleanUpCall(false);
          toast({ title: "Call Ended", description: "Connection lost" });
        }
      };

      return pc;
    } catch (error) {
      console.error("Error setting up peer connection:", error);
      toast({
        title: "Media Error",
        description: "Could not access microphone",
        variant: "destructive"
      });
      throw error;
    }
  }, [socket, callState.currentCall, cleanUpCall, toast]);

  const startCall = useCallback(async (friendId, friendName) => {
    if (!socket || !user || callState.isInCall || callState.isCalling) return;

    try {
      setCallState(prev => ({
        ...prev,
        isCalling: true,
        currentCall: {
          callId: `call_${Date.now()}_${user.id}_${friendId}`,
          receiverId: friendId,
          receiverName: friendName
        }
      }));

      const pc = await setupPeerConnection();
      peerRef.current = pc;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call-user", {
        callerId: user.id,
        receiverId: friendId,
        callerName: user.name
      });

    } catch (error) {
      console.error("Error starting call:", error);
      cleanUpCall(false);
      toast({
        title: "Call Failed",
        description: "Could not initiate call",
        variant: "destructive"
      });
    }
  }, [socket, user, callState.isInCall, callState.isCalling, setupPeerConnection, cleanUpCall, toast]);

  const acceptCall = useCallback(async () => {
    if (!callState.incomingCall || !socket || !user) return;

    try {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }

      const pc = await setupPeerConnection();
      peerRef.current = pc;

      await pc.setRemoteDescription(
        new RTCSessionDescription(callState.incomingCall.offer)
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer-call", {
        callerId: callState.incomingCall.callerId,
        answer: answer
      });

      setCallState(prev => ({
        ...prev,
        isInCall: true,
        isCalling: false,
        incomingCall: null,
        currentCall: {
          callId: callState.incomingCall.callId,
          receiverId: callState.incomingCall.callerId,
          receiverName: callState.incomingCall.callerName
        }
      }));

      toast({ title: "Call Connected", description: "You are now in a call" });

    } catch (error) {
      console.error("Error accepting call:", error);
      cleanUpCall(true);
      toast({
        title: "Call Failed",
        description: "Could not accept call",
        variant: "destructive"
      });
    }
  }, [callState.incomingCall, socket, user, setupPeerConnection, cleanUpCall, toast]);

  const rejectCall = useCallback(() => {
    if (!callState.incomingCall || !socket) return;

    socket.emit("reject-call", {
      callId: callState.incomingCall.callId
    });

    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }

    setCallState(prev => ({
      ...prev,
      incomingCall: null
    }));
  }, [callState.incomingCall, socket]);

  const endCall = useCallback(() => {
    cleanUpCall(true);
  }, [cleanUpCall]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const newMuteState = !callState.isMuted;
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = newMuteState;
      });
      setCallState(prev => ({ ...prev, isMuted: newMuteState }));
    }
  }, [callState.isMuted]);

  // Setup socket listeners
  useEffect(() => {
    if (!socket || !user) return;

    ringtoneRef.current = new Audio("/ringtone.mp3");
    ringtoneRef.current.loop = true;

    const handleIncomingCall = ({ callId, callerId, callerName, offer }) => {
      if (callState.isInCall || callState.isCalling) {
        socket.emit("reject-call", { callId, reason: "busy" });
        return;
      }

      ringtoneRef.current.play().catch(() => {
        document.addEventListener("click", function playOnClick() {
          ringtoneRef.current?.play();
          document.removeEventListener("click", playOnClick);
        }, { once: true });
      });

      setCallState(prev => ({
        ...prev,
        incomingCall: { callId, callerId, callerName, offer }
      }));

      toast({
        title: "Incoming Call",
        description: `From ${callerName}`,
        duration: 30000
      });
    };

    const handleCallAccepted = async ({ answer }) => {
      if (peerRef.current && callState.isCalling) {
        try {
          await peerRef.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
          setCallState(prev => ({
            ...prev,
            isInCall: true,
            isCalling: false
          }));
          toast({ title: "Call Connected", description: "Call accepted" });
        } catch (error) {
          console.error("Error setting remote description:", error);
          cleanUpCall(true);
        }
      }
    };

    const handleCallRejected = ({ callId }) => {
      if (callState.currentCall?.callId === callId) {
        cleanUpCall(false);
        toast({ title: "Call Rejected", description: "The call was rejected" });
      }
    };

    const handleCallEnded = ({ callId }) => {
      if (callState.currentCall?.callId === callId) {
        cleanUpCall(false);
        toast({ title: "Call Ended", description: "The call has ended" });
      }
    };

    const handleIceCandidate = ({ candidate }) => {
      if (peerRef.current && candidate) {
        peerRef.current.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(e => console.error("Error adding ICE candidate:", e));
      }
    };

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-answered", handleCallAccepted);
    socket.on("call-rejected", handleCallRejected);
    socket.on("call-ended", handleCallEnded);
    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-answered", handleCallAccepted);
      socket.off("call-rejected", handleCallRejected);
      socket.off("call-ended", handleCallEnded);
      socket.off("ice-candidate", handleIceCandidate);
      cleanUpCall(false);
    };
  }, [socket, user, callState, cleanUpCall, toast]);

  return {
    callState,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    cleanUpCall
  };
}