import { User } from "lucide-react";
import { format } from "date-fns";
import { useRef, useEffect } from "react";

export const MessageList = ({ messages, user, isCallActiveOrPending }) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const shouldShowFriendAvatar = (currentMessage, prevMessage) => {
    if (currentMessage.sender_id === user.id) return false;
    if (!prevMessage) return true;
    return currentMessage.sender_id !== prevMessage.sender_id;
  };

  return (
    <div
      className={`flex-1 overflow-auto p-6 bg-background custom-scrollbar ${
        isCallActiveOrPending ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <div className="space-y-4">
        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-base">
            Start the conversation! Say hello.
          </p>
        ) : (
          messages.map((message, index) => {
            const isCurrentUser = message.sender_id === user.id;
            const prevMessage = messages[index - 1];
            const showAvatar = shouldShowFriendAvatar(message, prevMessage);

            return (
              <div
                key={message.id || index}
                className={`flex items-end ${
                  isCurrentUser ? "justify-end" : "justify-start"
                } animate-fade-in`}
              >
                {!isCurrentUser && (
                  <div
                    className={`flex-shrink-0 mr-2 ${
                      showAvatar ? "opacity-100" : "opacity-0"
                    } h-8 w-8 rounded-full bg-muted-foreground flex items-center justify-center`}
                  >
                    {showAvatar ? (
                      <User className="h-4 w-4 text-white" />
                    ) : null}
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-xl text-base ${
                    isCurrentUser
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-chat-bubble-friend-bg text-chat-bubble-friend-text rounded-bl-none"
                  } shadow-sm`}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  <p
                    className={`text-xs mt-1 text-right ${
                      isCurrentUser
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground/80"
                    }`}
                  >
                    {message.created_at
                      ? format(new Date(message.created_at), "h:mm a")
                      : "Sending..."}
                  </p>
                </div>
                {isCurrentUser && (
                  <div className="flex-shrink-0 ml-2 h-4 w-4 rounded-full bg-muted-foreground flex items-center justify-center opacity-0"></div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
