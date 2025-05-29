import { User, Wifi, WifiOff, PhoneIncoming } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const EmptyChatState = ({
  socketConnected,
  onOpenSidebar,
  callState,
  acceptCall,
  rejectCall,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-card p-8 text-center rounded-2xl m-4 shadow-xl relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenSidebar}
        className="absolute top-4 left-4 sm:hidden z-10"
        title="Open Sidebar"
      >
        <Menu className="h-6 w-6 text-foreground" />
      </Button>
      <div className="h-28 w-28 rounded-full bg-chat-avatar-blue-light flex items-center justify-center mb-6 animate-pulse-slow">
        <User className="h-14 w-14 text-chat-avatar-blue-dark" />
      </div>
      <h2 className="text-3xl font-bold mb-4 text-foreground">
        Welcome to Chat
      </h2>
      <p className="text-lg text-muted-foreground max-w-md">
        Select a friend from the sidebar to start chatting or search for new
        friends to connect with.
      </p>
      <div className="mt-8">
        <Badge
          variant={socketConnected ? "success" : "destructive"}
          className="flex items-center gap-2 px-5 py-2.5 text-base rounded-full shadow-md transition-all duration-200"
        >
          {socketConnected ? (
            <Wifi className="h-5 w-5" />
          ) : (
            <WifiOff className="h-5 w-5" />
          )}
          {socketConnected ? "Connected to Server" : "Disconnected"}
        </Badge>
      </div>

      {callState.incomingCall && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-background border border-primary shadow-xl p-4 rounded-lg z-50 w-11/12 max-w-sm">
          <div className="flex items-center mb-3">
            <PhoneIncoming className="h-6 w-6 text-primary mr-3 animate-bounce" />
            <h3 className="text-lg font-semibold">Incoming Call</h3>
          </div>
          <p className="text-muted-foreground mb-4">
            From:{" "}
            <span className="font-medium text-foreground">
              {callState.incomingCall.callerName || "Unknown User"}
            </span>
          </p>
          <div className="flex justify-end gap-3">
            <Button
              onClick={acceptCall}
              className="bg-green-500 hover:bg-green-600"
            >
              Accept
            </Button>
            <Button onClick={rejectCall} variant="destructive">
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
