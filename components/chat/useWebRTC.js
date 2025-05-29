import { useState, useRef, useEffect, useCallback } from "react";

export function useWebRTC({ socket, user, selectedFriend, toast }) {
  const [callState, setCallState] = useState({
    isInCall: false,
    isCalling: false,
    incomingCall: null,
    currentCall: null,
    isMuted: false,
    audioQuality: "high", // 'low' | 'medium' | 'high'
  });

  const remoteAudioRef = useRef(null);
  const ringtoneRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const gainNodeRef = useRef(null);
  const compressorRef = useRef(null);
  const filterRef = useRef(null);

  // Audio quality presets
  const audioQualityPresets = {
    low: {
      sampleRate: 16000,
      bufferSize: 1024,
      bitrate: 24000,
      noiseGateThreshold: 0.03,
    },
    medium: {
      sampleRate: 24000,
      bufferSize: 2048,
      bitrate: 32000,
      noiseGateThreshold: 0.02,
    },
    high: {
      sampleRate: 48000,
      bufferSize: 4096,
      bitrate: 51000,
      noiseGateThreshold: 0.01,
    },
  };

  const cleanUpCall = useCallback(
    (emitEndCall = true) => {
      console.log("Cleaning up call...");

      // Disconnect all audio nodes
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      }
      if (sourceRef.current) sourceRef.current.disconnect();
      if (gainNodeRef.current) gainNodeRef.current.disconnect();
      if (compressorRef.current) compressorRef.current.disconnect();
      if (filterRef.current) filterRef.current.disconnect();

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      // Close audio context
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close().catch(console.error);
      }

      // Reset all refs
      processorRef.current = null;
      sourceRef.current = null;
      streamRef.current = null;
      audioContextRef.current = null;
      gainNodeRef.current = null;
      compressorRef.current = null;
      filterRef.current = null;

      // Stop ringtone
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }

      // Notify server if needed
      if (emitEndCall && socket && callState.currentCall?.callId) {
        socket.emit("end-call", {
          callId: callState.currentCall.callId,
          userId: user.id,
        });
      }

      // Reset state
      setCallState({
        isInCall: false,
        isCalling: false,
        incomingCall: null,
        currentCall: null,
        isMuted: false,
        audioQuality: callState.audioQuality, // Preserve quality setting
      });
    },
    [socket, user?.id, callState.currentCall?.callId, callState.audioQuality]
  );

  const startStreaming = useCallback(
    async (peerId) => {
      try {
        console.log("Starting bidirectional audio stream with", peerId);
        const quality = audioQualityPresets[callState.audioQuality];

        // Create or reuse audio context
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext ||
            window.webkitAudioContext)({
            sampleRate: quality.sampleRate,
          });
        }

        // Get user media if not already available
        if (!streamRef.current) {
          streamRef.current = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: false,
              channelCount: 1,
              sampleRate: quality.sampleRate,
              sampleSize: 16,
              latency: 0.01,
            },
          });
        }

        // Setup audio processing chain if not already done
        if (!sourceRef.current) {
          const audioContext = audioContextRef.current;
          const sourceNode = audioContext.createMediaStreamSource(
            streamRef.current
          );

          // Audio processing nodes
          const highPassFilter = audioContext.createBiquadFilter();
          highPassFilter.type = "highpass";
          highPassFilter.frequency.value = 80;

          const compressor = audioContext.createDynamicsCompressor();
          compressor.threshold.value = -50;
          compressor.knee.value = 40;
          compressor.ratio.value = 12;
          compressor.attack.value = 0;
          compressor.release.value = 0.25;

          const gainNode = audioContext.createGain();
          gainNode.gain.value = callState.isMuted ? 0 : 1.0;

          // Connect processing chain
          sourceNode.connect(highPassFilter);
          highPassFilter.connect(compressor);
          compressor.connect(gainNode);
          gainNode.connect(audioContext.destination);

          // Audio processor for sending
          const processor = audioContext.createScriptProcessor(
            quality.bufferSize,
            1,
            1
          );

          gainNode.connect(processor);
          processor.connect(audioContext.destination);

          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            if (inputData.length === 0) return;

            const rms = Math.sqrt(
              inputData.reduce((sum, x) => sum + x * x, 0) / inputData.length
            );

            if (rms > quality.noiseGateThreshold && !callState.isMuted) {
              const max = Math.max(...inputData.map(Math.abs));
              const normalizedData =
                max > 0.5 ? inputData.map((x) => x * (0.5 / max)) : inputData;

              socket.emit("audio-data", {
                receiverId: peerId,
                data: Array.from(normalizedData),
                sampleRate: quality.sampleRate,
              });
            }
          };

          // Store references
          sourceRef.current = sourceNode;
          processorRef.current = processor;
          gainNodeRef.current = gainNode;
          compressorRef.current = compressor;
          filterRef.current = highPassFilter;
        }

        // Notify peer to start their stream
        socket.emit("start-stream", { peerId: user.id });
      } catch (err) {
        console.error("Audio stream setup error:", err);
        toast?.({
          title: "Audio Error",
          description: "Failed to setup audio stream",
          variant: "destructive",
        });
        cleanUpCall();
      }
    },
    [
      socket,
      toast,
      cleanUpCall,
      callState.audioQuality,
      callState.isMuted,
      user.id,
    ]
  );

  const handleIncomingAudioData = useCallback(
    (data) => {
      if (!audioContextRef.current || !data.data || data.data.length === 0) {
        console.warn("No audio context or empty audio data received");
        return;
      }

      try {
        const quality = audioQualityPresets[callState.audioQuality];
        const floatArray = new Float32Array(data.data);

        // Validate the incoming audio data
        if (floatArray.length === 0) {
          console.warn("Received empty audio buffer");
          return;
        }

        // Ensure we have a valid sample rate
        const sampleRate = Math.max(
          8000, // Minimum reasonable sample rate
          Math.min(
            48000, // Maximum reasonable sample rate
            data.sampleRate || audioContextRef.current.sampleRate
          )
        );

        // Ensure we have at least 1 frame
        const frameCount = Math.max(1, floatArray.length);

        const buffer = audioContextRef.current.createBuffer(
          1, // Number of channels
          frameCount,
          sampleRate
        );

        // Apply smoothing to reduce clicks/pops
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < floatArray.length && i < channelData.length; i++) {
          // Simple smoothing filter
          channelData[i] =
            i > 0
              ? floatArray[i] * 0.8 + channelData[i - 1] * 0.2
              : floatArray[i] * 0.8;
        }

        // Create audio source
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;

        // Apply bandpass filter to focus on voice frequencies
        const bandPassFilter = audioContextRef.current.createBiquadFilter();
        bandPassFilter.type = "bandpass";
        bandPassFilter.frequency.value = 1000;
        bandPassFilter.Q.value = 1.0;

        // Connect and play
        source.connect(bandPassFilter);
        bandPassFilter.connect(audioContextRef.current.destination);
        source.start();
      } catch (err) {
        console.error("Error processing incoming audio:", err);
      }
    },
    [callState.audioQuality]
  );

  const startCall = useCallback(
    async (friendId, friendName) => {
      if (!socket || !user || callState.isInCall || callState.isCalling) return;

      const callId = `call_${Date.now()}_${user.id}_${friendId}`;

      setCallState((prev) => ({
        ...prev,
        isCalling: true,
        currentCall: { callId, receiverId: friendId, receiverName: friendName },
      }));

      // Start local streaming immediately
      await startStreaming(friendId);

      socket.emit("call-user", {
        callerId: user.id,
        receiverId: friendId,
        callerName: user.name,
        callId,
        audioQuality: callState.audioQuality,
      });

      console.log("Calling user", friendId, "with callId", callId);
    },
    [
      socket,
      user,
      callState.isInCall,
      callState.isCalling,
      callState.audioQuality,
      startStreaming,
    ]
  );

  const acceptCall = useCallback(async () => {
    const { incomingCall } = callState;
    if (!incomingCall || !socket) return;

    ringtoneRef.current?.pause();
    ringtoneRef.current.currentTime = 0;

    // Start local streaming before accepting
    await startStreaming(incomingCall.callerId);

    socket.emit("accept-call", {
      callId: incomingCall.callId,
      receiverId: user.id,
      audioQuality: callState.audioQuality,
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

    console.log("Accepted call from", incomingCall.callerId);
  }, [
    socket,
    user,
    callState.incomingCall,
    callState.audioQuality,
    startStreaming,
  ]);

  const rejectCall = useCallback(() => {
    const { incomingCall } = callState;
    if (!incomingCall || !socket) return;

    ringtoneRef.current?.pause();
    ringtoneRef.current.currentTime = 0;

    socket.emit("reject-call", { callId: incomingCall.callId });
    setCallState((prev) => ({ ...prev, incomingCall: null }));

    console.log("Rejected call", incomingCall.callId);
  }, [socket, callState.incomingCall]);

  const endCall = useCallback(() => {
    cleanUpCall(true);
  }, [cleanUpCall]);

  const toggleMute = useCallback(() => {
    const newState = !callState.isMuted;
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newState ? 0 : 1.0;
    }
    setCallState((prev) => ({ ...prev, isMuted: newState }));
    console.log("Toggled mute:", newState);
  }, [callState.isMuted]);

  const setAudioQuality = useCallback((quality) => {
    if (["low", "medium", "high"].includes(quality)) {
      setCallState((prev) => ({ ...prev, audioQuality: quality }));
      console.log("Audio quality set to:", quality);
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    ringtoneRef.current = new Audio("/ringtone.mp3");
    ringtoneRef.current.loop = true;

    const handleIncomingCall = ({
      callId,
      callerId,
      callerName,
      audioQuality,
    }) => {
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
        audioQuality: audioQuality || prev.audioQuality, // Use caller's quality if provided
      }));

      toast?.({
        title: "Incoming Call",
        description: `From ${callerName}`,
        duration: 30000,
      });

      console.log("Incoming call from", callerId);
    };

    const handleCallAccepted = ({ callId, receiverId }) => {
      console.log("Call accepted by", receiverId);
      setCallState((prev) => ({
        ...prev,
        isCalling: false,
        isInCall: true,
      }));
    };

    const handleStartStream = async ({ peerId }) => {
      console.log("Received request to start streaming to", peerId);
      if (!callState.isInCall && !callState.isCalling) {
        console.warn("Not in call, ignoring stream request");
        return;
      }
      await startStreaming(peerId);
    };

    const handleCallEnded = ({ callId }) => {
      console.log("Call ended", callId);
      toast?.({ title: "Call Ended", description: "The call has ended." });
      cleanUpCall(false);
    };

    const handleCallStatus = ({ callId, status }) => {
      console.log("Call status:", status);
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
    socket.on("audio-data", handleIncomingAudioData);
    socket.on("call-ended", handleCallEnded);
    socket.on("call-status", handleCallStatus);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-accepted", handleCallAccepted);
      socket.off("start-stream", handleStartStream);
      socket.off("audio-data", handleIncomingAudioData);
      socket.off("call-ended", handleCallEnded);
      socket.off("call-status", handleCallStatus);

      ringtoneRef.current?.pause();
      ringtoneRef.current.currentTime = 0;
    };
  }, [
    socket,
    toast,
    cleanUpCall,
    callState.isCalling,
    callState.isInCall,
    handleIncomingAudioData,
    startStreaming,
  ]);

  return {
    callState,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    setAudioQuality,
    cleanUpCall,
  };
}
