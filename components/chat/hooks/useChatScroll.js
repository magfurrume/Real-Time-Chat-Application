import { useEffect, useRef } from "react";

export const useChatScroll = (messages) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return { messagesEndRef };
};