"use client"

import { useState, useEffect, useRef } from "react"
import { useAuthStore } from "@/store/auth-store"
import { useChatStore } from "@/store/chat-store"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, UserPlus, LogOut, User, UserCheck, X, RefreshCw, MessageSquareText, PanelLeftClose, PhoneIncoming } from "lucide-react" // Added PhoneIncoming
import { Badge } from "@/components/ui/badge"

export default function Sidebar({ onLogout, onSelectFriend, onClose, selectedFriendId, incomingCallFromId }) { // Added selectedFriendId and incomingCallFromId props
  const { user } = useAuthStore()
  const {
    friends,
    friendRequests,
    // selectedFriend, // Use selectedFriendId prop for consistency if needed, or store is fine
    setFriends,
    setFriendRequests,
    // setSelectedFriend, // We'll rely on onSelectFriend prop to handle this
    setLoadingFriends,
    setLoadingRequests,
    removeFriendRequest,
    addFriend,
  } = useChatStore() // Still need useChatStore for friends, requests etc.
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pollingIntervalRef = useRef(null)

  // Use selectedFriend from store for highlighting, as it's the source of truth
  const { selectedFriend } = useChatStore();


  // Load friends and friend requests
  useEffect(() => {
    const loadFriends = async () => {
      setLoadingFriends(true)
      try {
        const response = await fetch("/api/friends")
        if (response.ok) {
          const data = await response.json()
          setFriends(data.friends)
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to fetch friends: ${response.status}`);
        }
      } catch (error) {
        console.error("Error loading friends:", error)
        toast({
          title: "Error",
          description: error.message || "Failed to load friends.",
          variant: "destructive",
        })
      } finally {
        setLoadingFriends(false)
      }
    }

    const loadFriendRequests = async () => {
      setLoadingRequests(true)
      try {
        const response = await fetch("/api/friend-requests")
        if (response.ok) {
          const data = await response.json()
          setFriendRequests(data.requests)
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to fetch friend requests: ${response.status}`);
        }
      } catch (error) {
        console.error("Error loading friend requests:", error)
        toast({
          title: "Error",
          description: error.message || "Failed to load friend requests.",
          variant: "destructive",
        })
      } finally {
        setLoadingRequests(false)
      }
    }

    loadFriends()
    loadFriendRequests()

    pollingIntervalRef.current = setInterval(() => {
      loadFriendRequests()
      loadFriends()
    }, 120000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [setFriends, setFriendRequests, setLoadingFriends, setLoadingRequests, toast])

  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      const friendsResponse = await fetch("/api/friends")
      if (friendsResponse.ok) {
        const data = await friendsResponse.json()
        setFriends(data.friends)
      } else {
          const errorData = await friendsResponse.json();
          throw new Error(errorData.message || `Failed to refresh friends: ${friendsResponse.status}`);
      }
      const requestsResponse = await fetch("/api/friend-requests")
      if (requestsResponse.ok) {
        const data = await requestsResponse.json()
        setFriendRequests(data.requests)
      } else {
          const errorData = await requestsResponse.json();
          throw new Error(errorData.message || `Failed to refresh friend requests: ${requestsResponse.status}`);
      }
      toast({
        title: "Refreshed",
        description: "Friend list updated.",
        className: "bg-success text-success-foreground",
      })
    } catch (error) {
      console.error("Error refreshing data:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to refresh data",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const response = await fetch(`/api/users/search?query=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.users)
      } else {
        const data = await response.json();
        throw new Error(data.message || "Failed to search users.");
      }
    } catch (error) {
      console.error("Error searching users:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to search users. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleSendFriendRequest = async (userId) => {
    try {
      const response = await fetch("/api/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      if (response.ok) {
        toast({
          title: "Success",
          description: "Friend request sent successfully.",
          className: "bg-success text-success-foreground",
        })
        setSearchResults([])
        setSearchQuery("")
      } else {
        const data = await response.json()
        throw new Error(data.message || "Failed to send friend request")
      }
    } catch (error) {
      console.error("Error sending friend request:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to send friend request. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleAcceptFriendRequest = async (requestId) => {
    try {
      const response = await fetch(`/api/friend-requests/${requestId}/accept`, { method: "POST" })
      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Success",
          description: "Friend request accepted.",
          className: "bg-success text-success-foreground",
        })
        removeFriendRequest(requestId)
        addFriend(data.friend)
      } else {
        const data = await response.json()
        throw new Error(data.message || "Failed to accept friend request")
      }
    } catch (error) {
      console.error("Error accepting friend request:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to accept friend request. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRejectFriendRequest = async (requestId) => {
    try {
      const response = await fetch(`/api/friend-requests/${requestId}/reject`, { method: "POST" })
      if (response.ok) {
        toast({
          title: "Info",
          description: "Friend request rejected.",
          className: "bg-muted text-muted-foreground",
        })
        removeFriendRequest(requestId)
      } else {
        const data = await response.json()
        throw new Error(data.message || "Failed to reject friend request")
      }
    } catch (error) {
      console.error("Error rejecting friend request:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to reject friend request. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Corrected: Call onSelectFriend prop with the friend object
  const handleFriendClick = (friend) => {
    if (onSelectFriend) {
      onSelectFriend(friend); // Pass the friend object to the callback
    }
    // No direct call to setSelectedFriend here, let ChatLayout handle it via the prop.
  };

  return (
    <div className="w-full bg-white h-full flex flex-col bg-card border-r border-border rounded-r-2xl shadow-xl sm:shadow-none sm:rounded-none">
      <div className="p-4 border-b border-border flex justify-between items-center bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-7 w-7 text-primary" />
          <div>
            <h2 className="font-bold text-xl text-foreground">Chatify</h2>
            <p className="text-sm text-muted-foreground">{user?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh"
            className="hover:bg-accent hover:text-accent-foreground transition-all duration-200"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            title="Logout"
            className="hover:bg-destructive/10 text-destructive hover:text-destructive transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="sm:hidden"
            title="Close Sidebar"
          >
            <PanelLeftClose className="h-5 w-5 text-foreground" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="friends" className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-2 mx-4 mt-4 bg-muted rounded-xl p-1">
          <TabsTrigger
            value="friends"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
          >
            Friends
            {friends.length > 0 && <Badge className="ml-2 bg-primary-foreground text-primary">{friends.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
          >
            Requests
            {friendRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2">{friendRequests.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="flex-1 flex flex-col">
          <form onSubmit={handleSearch} className="p-4 border-b border-border bg-card">
            <div className="relative">
              <Input
                placeholder="Search by phone or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 rounded-lg border-input focus:border-ring focus:ring-ring transition-all duration-200"
              />
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full text-muted-foreground hover:text-primary transition-colors duration-200"
                disabled={isSearching}
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
          </form>

          {searchResults.length > 0 && (
            <div className="p-4 border-b border-border bg-card animate-fade-in">
              <h3 className="text-base font-semibold mb-3 text-foreground">Search Results</h3>
              <div className="space-y-3">
                {searchResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between p-3 bg-accent/20 rounded-lg shadow-sm transition-all duration-200 hover:bg-accent/40">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-chat-avatar-blue-light flex items-center justify-center flex-shrink-0">
                        <User className="h-6 w-6 text-chat-avatar-blue-dark" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{result.name}</p>
                        <p className="text-sm text-muted-foreground">{result.phone_number}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSendFriendRequest(result.id)}
                      title="Send Friend Request"
                      className="text-primary hover:bg-primary/10 transition-all duration-200"
                    >
                      <UserPlus className="h-5 w-5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto p-4 custom-scrollbar">
            <h3 className="text-base font-semibold mb-3 text-foreground">Your Friends</h3>
            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No friends yet. Search for users to add friends!
              </p>
            ) : (
              <div className="space-y-2">
                {friends.map((friend) => {
                  const isSelected = selectedFriend?.id === friend.id;
                  const isReceivingCall = incomingCallFromId === friend.id;
                  return (
                    <div
                      key={friend.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 shadow-sm ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-md"
                          : isReceivingCall
                          ? "bg-green-500/20 animate-pulse-fast" // Highlight for incoming call
                          : "hover:bg-accent bg-card"
                      }`}
                      onClick={() => handleFriendClick(friend)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center mr-0 flex-shrink-0 ${isSelected ? "bg-primary-foreground text-primary" : "bg-muted text-muted-foreground"}`}>
                          <User className="h-7 w-7" />
                        </div>
                        <div>
                          <p className={`font-medium ${isSelected ? "text-primary-foreground" : "text-foreground"}`}>{friend.name}</p>
                          <p
                            className={`text-sm ${
                              isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                            }`}
                          >
                            {friend.phone_number}
                          </p>
                        </div>
                      </div>
                      {isReceivingCall && !isSelected && (
                        <PhoneIncoming className="h-5 w-5 text-green-600 animate-bounce" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="flex-1 overflow-auto p-4 custom-scrollbar">
          <h3 className="text-base font-semibold mb-3 text-foreground">Pending Friend Requests</h3>
          {friendRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pending friend requests.</p>
          ) : (
            <div className="space-y-3">
              {friendRequests.map((request) => (
                <div key={request.id} className="border border-border rounded-xl p-4 bg-card shadow-sm animate-fade-in">
                  <div className="flex items-center mb-3">
                    <div className="h-12 w-12 rounded-full bg-chat-avatar-orange-light flex items-center justify-center mr-3 flex-shrink-0">
                      <User className="h-7 w-7 text-chat-avatar-orange-dark" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{request.sender_name}</p>
                      <p className="text-sm text-muted-foreground">{request.sender_phone}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" className="flex-1 bg-success hover:bg-success/90 transition-colors duration-200 rounded-lg shadow-sm" onClick={() => handleAcceptFriendRequest(request.id)}>
                      <UserCheck className="h-4 w-4 mr-1" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-input hover:bg-accent text-foreground hover:text-accent-foreground transition-colors duration-200 rounded-lg shadow-sm"
                      onClick={() => handleRejectFriendRequest(request.id)}
                    >
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}