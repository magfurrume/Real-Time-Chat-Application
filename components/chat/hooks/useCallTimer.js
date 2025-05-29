import { useState, useEffect, useRef } from "react";

export const useCallTimer = (isInCall) => {
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (isInCall) {
      originalTitleRef.current = document.title;
      const updateTitle = () => {
        document.title = `📞 ${formatTime(callDuration)} - Call`;
      };
      updateTitle();
      const titleInterval = setInterval(updateTitle, 1000);
      return () => {
        clearInterval(titleInterval);
        document.title = originalTitleRef.current;
      };
    }
  }, [isInCall, callDuration]);

  useEffect(() => {
    if (isInCall) {
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
  }, [isInCall]);

  return { callDuration, formatTime };
};
