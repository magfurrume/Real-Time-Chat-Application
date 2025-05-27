// useWebRTC.jsx
import { useState, useRef, useEffect, useCallback } from "react";

export function useWebRTC({ socket, user, selectedFriend, toast }) {
  const [callState, setCallState] = useState({
    isInCall: false,
    isCalling: false,
    incomingCall: null,
    currentCall: null,
    isMuted: false,
  });

  const remoteAudioRef = useRef(null);
  const ringtoneRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);

  const cleanUpCall = useCallback(
    (emitEndCall = true) => {
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close().catch(console.error);

      processorRef.current = null;
      sourceRef.current = null;
      streamRef.current = null;
      audioContextRef.current = null;

      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }

      if (emitEndCall && socket && callState.currentCall?.callId) {
        socket.emit("end-call", {
          callId: callState.currentCall.callId,
          userId: user.id,
        });
      }

      setCallState({
        isInCall: false,
        isCalling: false,
        incomingCall: null,
        currentCall: null,
        isMuted: false,
      });
    },
    [socket, user?.id, callState.currentCall?.callId]
  );

  const startStreaming = useCallback(
    async (peerId) => {
      try {
        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        sourceRef.current = audioContextRef.current.createMediaStreamSource(
          streamRef.current
        );
        processorRef.current = audioContextRef.current.createScriptProcessor(
          2048,
          1,
          1
        );
        sourceRef.current.connect(processorRef.current);
        processorRef.current.connect(audioContextRef.current.destination);

        processorRef.current.onaudioprocess = (e) => {
          if (!callState.isMuted && socket?.connected) {
            socket.emit("audio-data", {
              receiverId: peerId,
              data: Array.from(e.inputBuffer.getChannelData(0)),
            });
          }
        };
      } catch (err) {
        console.error("Microphone access error:", err);
        toast?.({
          title: "Mic Error",
          description: "Cannot access microphone.",
          variant: "destructive",
        });
        cleanUpCall();
      }
    },
    [socket, toast, cleanUpCall, callState.isMuted]
  );

  const startCall = useCallback(
    (friendId, friendName) => {
      if (!socket || !user || callState.isInCall || callState.isCalling) return;

      const callId = `call_${Date.now()}_${user.id}_${friendId}`;

      setCallState((prev) => ({
        ...prev,
        isCalling: true,
        currentCall: { callId, receiverId: friendId, receiverName: friendName },
      }));

      socket.emit("call-user", {
        callerId: user.id,
        receiverId: friendId,
        callerName: user.name,
        callId,
      });
    },
    [socket, user, callState]
  );

  const acceptCall = useCallback(() => {
    const { incomingCall } = callState;
    if (!incomingCall || !socket) return;

    ringtoneRef.current?.pause();
    ringtoneRef.current.currentTime = 0;

    socket.emit("accept-call", {
      callId: incomingCall.callId,
      receiverId: user.id,
    });

    setCallState((prev) => ({
      ...prev,
      isInCall: true,
      isCalling: false,
      incomingCall: null,
      currentCall: {
        callId: incomingCall.callId,
        receiverId: incomingCall.callerId,
        receiverName: incomingCall.callerName,
      },
    }));
  }, [socket, user, callState.incomingCall]);

  const rejectCall = useCallback(() => {
    const { incomingCall } = callState;
    if (!incomingCall || !socket) return;

    ringtoneRef.current?.pause();
    ringtoneRef.current.currentTime = 0;

    socket.emit("reject-call", { callId: incomingCall.callId });
    setCallState((prev) => ({ ...prev, incomingCall: null }));
  }, [socket, callState.incomingCall]);

  const endCall = useCallback(() => {
    cleanUpCall(true);
  }, [cleanUpCall]);

  const toggleMute = useCallback(() => {
    const newState = !callState.isMuted;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !newState;
    });
    setCallState((prev) => ({ ...prev, isMuted: newState }));
  }, [callState.isMuted]);

  useEffect(() => {
    if (!socket) return;

    ringtoneRef.current = new Audio("/ringtone.mp3");
    ringtoneRef.current.loop = true;

    const handleIncomingCall = ({ callId, callerId, callerName }) => {
      if (callState.isInCall || callState.isCalling) {
        socket.emit("reject-call", { callId, reason: "busy" });
        return;
      }

      ringtoneRef.current.play().catch(() => {
        document.addEventListener(
          "click",
          function resumeAudio() {
            ringtoneRef.current.play().catch(console.error);
            document.removeEventListener("click", resumeAudio);
          },
          { once: true }
        );
      });

      setCallState((prev) => ({
        ...prev,
        incomingCall: { callId, callerId, callerName },
      }));

      toast?.({
        title: "Incoming Call",
        description: `From ${callerName}`,
        duration: 30000,
      });
    };

    const handleCallAccepted = ({ callId, receiverId }) => {
      setCallState((prev) => ({
        ...prev,
        isCalling: false,
        isInCall: true,
      }));
    };

    const handleStartStream = async ({ peerId }) => {
      await startStreaming(peerId);
    };

    const handleAudioData = (data) => {
      if (!audioContextRef.current) return;
      const floatArray = new Float32Array(data);
      const buffer = audioContextRef.current.createBuffer(
        1,
        floatArray.length,
        audioContextRef.current.sampleRate
      );
      buffer.copyToChannel(floatArray, 0);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start();
    };

    const handleCallEnded = ({ callId }) => {
      toast?.({ title: "Call Ended", description: "The call has ended." });
      cleanUpCall(false);
    };

    const handleCallStatus = ({ callId, status }) => {
      if (
        status === "missed" ||
        status === "rejected" ||
        status === "offline"
      ) {
        toast?.({
          title: `Call ${status}`,
          description: "The call could not be completed.",
        });
        cleanUpCall(false);
      }
    };

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-accepted", handleCallAccepted);
    socket.on("start-stream", handleStartStream);
    socket.on("audio-data", handleAudioData);
    socket.on("call-ended", handleCallEnded);
    socket.on("call-status", handleCallStatus);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-accepted", handleCallAccepted);
      socket.off("start-stream", handleStartStream);
      socket.off("audio-data", handleAudioData);
      socket.off("call-ended", handleCallEnded);
      socket.off("call-status", handleCallStatus);
      ringtoneRef.current?.pause();
      ringtoneRef.current.currentTime = 0;
    };
  }, [socket, toast, cleanUpCall, callState.isCalling, callState.isInCall]);

  return {
    callState,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    cleanUpCall,
  };
}
