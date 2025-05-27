import { useState, useRef, useEffect, useCallback } from "react";

export function useWebRTC({ socket, user, toast }) {
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
    peerRef.current?.close();
    peerRef.current = null;

    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;

    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }

    if (emitEndCall && socket && callState.currentCall?.callId) {
      socket.emit("end-call", {
        callId: callState.currentCall.callId,
        userId: user.id
      });
    }

    setCallState({
      isInCall: false,
      isCalling: false,
      incomingCall: null,
      currentCall: null,
      isMuted: false
    });
  }, [socket, user?.id, callState.currentCall?.callId]);

  const checkMediaPermissions = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        throw new Error("Media devices API not supported");
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudio = devices.some(d => d.kind === "audioinput");

      if (!hasAudio) throw new Error("No microphone found");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());

      return true;
    } catch (error) {
      toast?.({
        title: "Media Error",
        description: error.message || "Microphone access failed",
        variant: "destructive"
      });
      throw error;
    }
  }, [toast]);

  const setupPeerConnection = useCallback(async () => {
    try {
      await checkMediaPermissions();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });

      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = event => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(console.error);
        }
      };

      pc.onicecandidate = event => {
        if (event.candidate && callState.currentCall?.receiverId) {
          socket.emit("ice-candidate", {
            callId: callState.currentCall.callId,
            candidate: event.candidate,
            targetId: callState.currentCall.receiverId
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected") {
          cleanUpCall(false);
          toast?.({ title: "Call Ended", description: "Connection lost" });
        }
      };

      return pc;
    } catch (error) {
      throw error;
    }
  }, [checkMediaPermissions, socket, callState.currentCall?.receiverId, cleanUpCall, toast]);

  const startCall = useCallback(async (friendId, friendName) => {
    if (!socket || !user || callState.isInCall || callState.isCalling) return;

    try {
      setCallState(prev => ({ ...prev, isCalling: true }));

      const pc = await setupPeerConnection();
      peerRef.current = pc;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const callId = `call_${Date.now()}_${user.id}_${friendId}`;

      setCallState(prev => ({
        ...prev,
        currentCall: { callId, receiverId: friendId, receiverName: friendName }
      }));

      socket.emit("call-user", {
        receiverId: friendId,
        callerName: user.name,
        offer,
        callId
      });
    } catch (error) {
      console.error("Error starting call:", error);
      setCallState(prev => ({ ...prev, isCalling: false }));
    }
  }, [socket, user, callState.isInCall, callState.isCalling, setupPeerConnection]);

  const acceptCall = useCallback(async () => {
    if (!callState.incomingCall || !socket || !user) return;

    try {
      ringtoneRef.current?.pause();
      ringtoneRef.current.currentTime = 0;

      const pc = await setupPeerConnection();
      peerRef.current = pc;

      await pc.setRemoteDescription(new RTCSessionDescription(callState.incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer-call", {
        callId: callState.incomingCall.callId,
        answer
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

      toast?.({ title: "Call Connected", description: "You are now in a call" });
    } catch (error) {
      cleanUpCall(true);
      toast?.({ title: "Call Failed", description: error.message, variant: "destructive" });
    }
  }, [callState.incomingCall, socket, user, setupPeerConnection, cleanUpCall, toast]);

  const rejectCall = useCallback(() => {
    if (!callState.incomingCall || !socket) return;

    socket.emit("reject-call", { callId: callState.incomingCall.callId });

    ringtoneRef.current?.pause();
    ringtoneRef.current.currentTime = 0;

    setCallState(prev => ({ ...prev, incomingCall: null }));
  }, [callState.incomingCall, socket]);

  const endCall = useCallback(() => {
    cleanUpCall(true);
  }, [cleanUpCall]);

  const toggleMute = useCallback(() => {
    const newMuteState = !callState.isMuted;
    localStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = newMuteState;
    });
    setCallState(prev => ({ ...prev, isMuted: newMuteState }));
  }, [callState.isMuted]);

  useEffect(() => {
    if (!socket) return;

    ringtoneRef.current = new Audio("/sounds/custom-ringtone.mp3");
    ringtoneRef.current.loop = true;

    const handleIncomingCall = ({ callId, callerId, callerName, offer }) => {
      ringtoneRef.current?.play().catch(console.error);
      setCallState(prev => ({
        ...prev,
        incomingCall: { callId, callerId, callerName, offer },
        isCalling: false,
        isInCall: false
      }));
    };

    const handleCallMissed = ({ callId }) => {
      ringtoneRef.current?.pause();
      ringtoneRef.current.currentTime = 0;

      if (
        callState.currentCall?.callId === callId ||
        callState.incomingCall?.callId === callId
      ) {
        setCallState(prev => ({
          ...prev,
          incomingCall: null,
          currentCall: null,
          isCalling: false,
          isInCall: false
        }));
        toast?.({ title: "Call Missed", description: "No one answered the call" });
      }
    };

    const handleAnswerCall = async ({ answer }) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallState(prev => ({ ...prev, isInCall: true, isCalling: false }));
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      try {
        if (peerRef.current) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error("ICE candidate error:", error);
      }
    };

    const handleCallEnded = ({ reason }) => {
      ringtoneRef.current?.pause();
      ringtoneRef.current.currentTime = 0;
      cleanUpCall(false);
      toast?.({ title: "Call Ended", description: reason || "Call was ended." });
    };

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-missed", handleCallMissed);
    socket.on("answer-call", handleAnswerCall);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-missed", handleCallMissed);
      socket.off("answer-call", handleAnswerCall);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("call-ended", handleCallEnded);

      ringtoneRef.current?.pause();
      ringtoneRef.current.currentTime = 0;
    };
  }, [socket, callState.currentCall?.callId, callState.incomingCall?.callId, cleanUpCall, toast]);

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
