import { Phone, PhoneOff, Mic, MicOff, User } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { CallErrorBoundary } from "../CallErrorBoundary";

export const CallInterface = ({
  callState,
  selectedFriend,
  rejectCall,
  endCall,
  toggleMute,
}) => {
  if (!callState.incomingCall && !callState.isInCall && !callState.isCalling) {
    return null;
  }

  const callerName =
    callState.currentCall?.receiverName ||
    callState.incomingCall?.callerName ||
    "Caller";

  let mode, title, description, buttons;

  if (
    callState.incomingCall &&
    callState.incomingCall.callerId === selectedFriend?.id
  ) {
    mode = "incoming";
    title = "Incoming Call";
    description = "is calling you";
    buttons = [
      {
        text: "Decline",
        icon: <PhoneOff className="h-5 w-5" />,
        onClick: rejectCall,
        className: "bg-red-500 hover:bg-red-600",
      },
      {
        text: "Accept",
        icon: <Phone className="h-5 w-5" />,
        onClick: () => acceptCall(),
        className: "bg-green-500 hover:bg-green-600",
      },
    ];
  } else if (callState.isInCall) {
    mode = "active";
    title = "On Call";
    description = formatTime(callState.callDuration || 0);
    buttons = [
      {
        text: callState.isMuted ? "Unmute" : "Mute",
        icon: callState.isMuted ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        ),
        onClick: toggleMute,
        className: callState.isMuted
          ? "bg-amber-500/90 hover:bg-amber-600/90"
          : "bg-blue-500/90 hover:bg-blue-600/90",
      },
      {
        text: "End",
        icon: <PhoneOff className="h-5 w-5" />,
        onClick: endCall,
        className: "bg-red-500 hover:bg-red-600",
      },
    ];
  } else if (callState.isCalling) {
    mode = "calling";
    title = "Calling";
    description = "Ringing...";
    buttons = [
      {
        text: "Cancel",
        icon: <PhoneOff className="h-5 w-5" />,
        onClick: endCall,
        className: "bg-red-500 hover:bg-red-600",
      },
    ];
  }

  return (
    <CallErrorBoundary>
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-purple-900 flex flex-col items-center justify-center z-50 p-6 text-center">
        {/* Tab-friendly header */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
          <div className="flex items-center">
            <div
              className={`w-3 h-3 rounded-full mr-2 ${
                mode === "active"
                  ? "bg-green-400 animate-pulse"
                  : "bg-yellow-400"
              }`}
            ></div>
            <span className="text-white/80 text-sm">{title}</span>
          </div>
          <span className="text-white/60 text-sm font-mono">
            {mode === "active" ? formatTime(callState.callDuration || 0) : ""}
          </span>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {/* Animated avatar */}
          <div className="relative mb-8 group">
            <div className="absolute -inset-4 bg-white/10 rounded-full animate-pulse-slow group-hover:animate-none"></div>
            <div className="relative h-32 w-32 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center border-2 border-white/20 transition-all duration-300 group-hover:scale-105 group-hover:border-blue-300">
              <User className="h-16 w-16 text-white" />
              {mode === "active" && (
                <div className="absolute -bottom-2 -right-2 bg-green-400 rounded-full p-1.5 border-2 border-purple-900">
                  <Mic className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Caller info */}
          <h2 className="text-3xl font-bold text-white mb-2">{callerName}</h2>
          <p className="text-xl text-white/80 mb-8">{description}</p>

          {/* Audio visualization */}
          {mode === "active" && (
            <div className="w-full max-w-md mb-8">
              <div className="flex items-center justify-center space-x-1 h-8">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden"
                  >
                    <div
                      className="h-full bg-green-400 transition-all duration-200"
                      style={{
                        height: `${Math.random() * 80 + 20}%`,
                        opacity: callState.isMuted ? 0.3 : 1,
                      }}
                    ></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Call controls */}
        <div className="w-full max-w-md">
          <div
            className={`grid ${
              buttons.length > 1 ? "grid-cols-2" : "grid-cols-1"
            } gap-4`}
          >
            {buttons.map((btn, i) => (
              <Button
                key={i}
                onClick={btn.onClick}
                className={`${btn.className} text-white py-6 rounded-xl shadow-lg transform transition-all hover:scale-105`}
              >
                <span className="flex items-center justify-center">
                  {btn.icon}
                  <span className="ml-2">{btn.text}</span>
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Quality indicator */}
        {mode === "active" && (
          <div className="absolute bottom-4 right-4 text-white/50 text-xs">
            {callState.audioQuality === "high"
              ? "HD"
              : callState.audioQuality === "medium"
              ? "Standard"
              : "Basic"}
          </div>
        )}
      </div>
    </CallErrorBoundary>
  );
};
