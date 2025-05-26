// components/chat/useMessageHandlers.js
import { useEffect, useRef, useCallback } from "react";

export function useMessageHandlers({ 
  socket, 
  user, 
  selectedFriend, 
  friends, 
  addMessage, 
  setMessages, 
  toast, 
  setSelectedFriend 
}) {
  const messageIdsRef = useRef(new Set());

  useEffect(() => {
    if (!selectedFriend || !user) {
      setMessages([]);
      return;
    }
    messageIdsRef.current.clear();
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages/${selectedFriend.id}`);
        const { messages: fetched } = await res.json();
        fetched.forEach((m) => messageIdsRef.current.add(m.id));
        setMessages(fetched);
      } catch (error) {
        toast({ 
          title: "Error", 
          description: "Failed to load messages", 
          variant: "destructive" 
        });
        setMessages([]);
      }
    };
    fetchMessages();
  }, [selectedFriend, user, setMessages, toast]);

  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (msg) => {
      if (messageIdsRef.current.has(msg.id)) return;
      messageIdsRef.current.add(msg.id);

      const isFromSelected = selectedFriend && 
        [msg.sender_id, msg.receiver_id].includes(selectedFriend.id);
      
      if (isFromSelected && msg.sender_id !== user.id) {
        addMessage(msg);
      } else if (msg.sender_id !== user.id) {
        const sender = friends.find(f => f.id === msg.sender_id);
        toast({
          title: `New message from ${sender?.name || "Unknown"}`,
          description: msg.content.slice(0, 30),
          action: (
            <button onClick={() => sender && setSelectedFriend(sender)}>
              Open Chat
            </button>
          ),
        });
      }
    };

    socket.on("message", handleIncoming);
    socket.on("messageError", ({ message }) =>
      toast({ 
        title: "Message Error", 
        description: message, 
        variant: "destructive" 
      })
    );

    return () => {
      socket.off("message", handleIncoming);
      socket.off("messageError");
    };
  }, [socket, selectedFriend, user, friends, addMessage, toast, setSelectedFriend]);

  const sendMessage = useCallback((content) => {
    if (!selectedFriend || !content.trim() || !socket || !user) return;

    const tempMessage = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: selectedFriend.id,
      content,
      created_at: new Date().toISOString(),
    };
    addMessage(tempMessage);
    messageIdsRef.current.add(tempMessage.id);

    socket.emit("sendMessage", {
      receiverId: selectedFriend.id,
      content,
    });
  }, [selectedFriend, socket, user, addMessage]);

  return { sendMessage };
}