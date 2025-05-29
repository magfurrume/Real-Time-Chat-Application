"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import { useToast } from "@/hooks/use-toast";
import { useMessageHandlers } from "./useMessageHandlers";
import Sidebar from "./sidebar";
import ChatWindow from "./chat-window";

export default function ChatLayout() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, logout } = useAuthStore();
  const {
    selectedFriend,
    setSelectedFriend,
    messages,
    setMessages,
    addMessage,
    friends,
  } = useChatStore();
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { sendMessage } = useMessageHandlers({
    socket,
    user,
    selectedFriend,
    friends,
    addMessage,
    setMessages,
    toast,
    setSelectedFriend,
  });

  useEffect(() => {
    if (!user) return;

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "https://tillerbd.com:8030";
    const s = io(socketUrl, {
      auth: { userId: user.id },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    s.on("connect", () => {
      setSocketConnected(true);
      s.emit("register", user.id);
    });

    s.on("connect_error", (err) => {
      setSocketConnected(false);
      toast({
        title: "Connection error",
        description: err.message,
        variant: "destructive",
      });
    });

    s.on("disconnect", (reason) => {
      setSocketConnected(false);
      toast({
        title: "Disconnected",
        description: reason,
        variant: "destructive",
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user, toast]);

  const handleLogout = async () => {
    if (socket) {
      socket.disconnect();
    }
    await fetch("/api/auth/logout", { method: "POST" });
    logout();
    toast({ title: "Logged out", description: "See you again!" });
    router.push("/");
  };

  return (
    <div className="flex h-screen bg-background relative overflow-hidden">
      <div
        className={`
        fixed inset-y-0 left-0 z-50
        w-80 h-full bg-card shadow-xl transition-transform duration-300 ease-in-out
        transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        sm:translate-x-0 sm:relative sm:w-80 sm:block
        rounded-r-2xl sm:rounded-none sm:shadow-none
      `}
      >
        <Sidebar
          onLogout={handleLogout}
          onSelectFriend={(friend) => {
            setSelectedFriend(friend);
            setIsSidebarOpen(false);
          }}
          onClose={() => setIsSidebarOpen(false)}
          selectedFriendId={selectedFriend?.id}
        />
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      <div className="flex-1 min-w-0 flex flex-col z-10">
        <ChatWindow
          socket={socket}
          onSendMessage={sendMessage}
          socketConnected={socketConnected}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />
      </div>
    </div>
  );
}
