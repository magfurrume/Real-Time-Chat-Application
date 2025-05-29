import { Menu, Phone, MoreVertical, CircleDot } from "lucide-react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const ChatHeader = ({
  selectedFriend,
  onOpenSidebar,
  socketConnected,
  isCallActiveOrPending,
  handleStartCall,
}) => {
  return (
    <div className="p-4 border-b border-border bg-card flex items-center justify-between shadow-sm">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSidebar}
          className="mr-3 sm:hidden z-10"
          title="Open Sidebar"
        >
          <Menu className="h-6 w-6 text-foreground" />
        </Button>
        <div className="relative h-12 w-12 rounded-full bg-chat-avatar-blue-light flex items-center justify-center mr-3 flex-shrink-0">
          <User className="h-7 w-7 text-chat-avatar-blue-dark" />
          <span
            className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[var(--online-indicator)] border-2 border-card"
            title="Online"
          ></span>
        </div>
        <div>
          <h2 className="font-semibold text-xl text-foreground">
            {selectedFriend.name}
          </h2>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <CircleDot className="h-3 w-3 text-[var(--online-indicator)]" />{" "}
            Active now
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary hover:bg-primary/10"
              onClick={handleStartCall}
              disabled={!socketConnected || isCallActiveOrPending}
            >
              <Phone className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Voice Call</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary hover:bg-primary/10"
              disabled
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>More Options</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
