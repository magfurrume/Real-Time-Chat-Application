import { useState, useRef } from "react";
import { Paperclip, Smile, Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmojiPickerWrapper } from "./EmojiPickerWrapper";

export const MessageInput = ({
  onSendMessage,
  socketConnected,
  isCallActiveOrPending,
}) => {
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    onSendMessage(newMessage.trim());
    setNewMessage("");
    setShowEmojiPicker(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`p-4 border-t border-border bg-card shadow-lg sticky bottom-0 relative ${
        isCallActiveOrPending ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {showEmojiPicker && (
        <EmojiPickerWrapper
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          setShowEmojiPicker={setShowEmojiPicker}
          textareaRef={textareaRef}
        />
      )}
      <div className="flex items-end gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Attach File</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              type="button"
            >
              <Smile className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Emoji</p>
          </TooltipContent>
        </Tooltip>
        <Textarea
          ref={textareaRef}
          placeholder={
            socketConnected
              ? "Type your message here..."
              : "Waiting for connection to send message..."
          }
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 min-h-[50px] max-h-[180px] rounded-2xl border border-input focus:border-ring focus:ring-ring transition-all duration-200 p-3 text-base resize-none custom-scrollbar"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          disabled={!socketConnected}
        />
        {!newMessage.trim() ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Mic className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Voice Message</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 transition-all duration-200 shadow-md"
            disabled={!socketConnected || !newMessage.trim()}
          >
            <Send className="h-5 w-5 text-primary-foreground" />
          </Button>
        )}
      </div>
    </form>
  );
};
