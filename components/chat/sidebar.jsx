"use client"

import { useState, useEffect, useRef } from "react"
import { useAuthStore } from "@/store/auth-store"
import { useChatStore } from "@/store/chat-store"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, UserPlus, LogOut, User, UserCheck, X, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function Sidebar({ onLogout }) {
  const { user } = useAuthStore()
  const {
    friends,
    friendRequests,
    selectedFriend,
    setFriends,
    setFriendRequests,
    setSelectedFriend,
    setLoadingFriends,
    setLoadingRequests,
    removeFriendRequest,
    addFriend,
  } = useChatStore()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pollingIntervalRef = useRef(null)

  // Load friends and friend requests
  useEffect(() => {
    const loadFriends = async () => {
      setLoadingFriends(true)
      try {
        const response = await fetch("/api/friends")
        if (response.ok) {
          const data = await response.json()
          setFriends(data.friends)
        }
      } catch (error) {
        console.error("Error loading friends:", error)
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
        }
      } catch (error) {
        console.error("Error loading friend requests:", error)
      } finally {
        setLoadingRequests(false)
      }
    }

    // Initial load
    loadFriends()
    loadFriendRequests()

    // Set up polling with a longer interval (2 minutes instead of 30 seconds)
    pollingIntervalRef.current = setInterval(() => {
      loadFriendRequests()
      loadFriends()
    }, 120000) // Poll every 2 minutes

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [setFriends, setFriendRequests, setLoadingFriends, setLoadingRequests])

  // Manual refresh function
  const handleRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      // Load friends
      const friendsResponse = await fetch("/api/friends")
      if (friendsResponse.ok) {
        const data = await friendsResponse.json()
        setFriends(data.friends)
      }

      // Load friend requests
      const requestsResponse = await fetch("/api/friend-requests")
      if (requestsResponse.ok) {
        const data = await requestsResponse.json()
        setFriendRequests(data.requests)
      }

      toast({
        title: "Refreshed",
        description: "Friend list updated",
      })
    } catch (error) {
      console.error("Error refreshing data:", error)
      toast({
        title: "Error",
        description: "Failed to refresh data",
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
      }
    } catch (error) {
      console.error("Error searching users:", error)
      toast({
        title: "Error",
        description: "Failed to search users. Please try again.",
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Friend request sent successfully.",
        })
        // Clear search results
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
      const response = await fetch(`/api/friend-requests/${requestId}/accept`, {
        method: "POST",
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Success",
          description: "Friend request accepted.",
        })

        // Update UI
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
      const response = await fetch(`/api/friend-requests/${requestId}/reject`, {
        method: "POST",
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Friend request rejected.",
        })

        // Update UI
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

  return (
    <div className="w-full sm:w-80 bg-white border-r flex flex-col h-full max-h-screen overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="font-bold text-lg">Chat App</h2>
          <p className="text-sm text-gray-500">{user?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing} title="Refresh">
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onLogout} title="Logout">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="friends" className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-2 mx-4 mt-4">
          <TabsTrigger value="friends">
            Friends
            {friends.length > 0 && <Badge className="ml-2">{friends.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {friendRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {friendRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Friends Tab */}
        <TabsContent value="friends" className="flex-1 flex flex-col">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="p-4 border-b">
            <div className="relative">
              <Input
                placeholder="Search by phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                disabled={isSearching}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="p-4 border-b">
              <h3 className="text-sm font-medium mb-2">Search Results</h3>
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{result.name}</p>
                      <p className="text-sm text-gray-500">{result.phone_number}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSendFriendRequest(result.id)}
                      title="Send Friend Request"
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          <div className="flex-1 overflow-auto p-4">
            <h3 className="text-sm font-medium mb-2">Your Friends</h3>
            {friends.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No friends yet. Search for users to add friends.</p>
            ) : (
              <div className="space-y-2">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className={`flex items-center p-3 rounded cursor-pointer ${
                      selectedFriend?.id === friend.id ? "bg-blue-400 text-primary-foreground" : "hover:bg-gray-100"
                    }`}
                    onClick={() => setSelectedFriend(friend)}
                  >
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                      <User className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium">{friend.name}</p>
                      <p
                        className={`text-sm ${
                          selectedFriend?.id === friend.id ? "text-primary-foreground/80" : "text-gray-500"
                        }`}
                      >
                        {friend.phone_number}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Friend Requests Tab */}
        <TabsContent value="requests" className="flex-1 overflow-auto p-4">
          <h3 className="text-sm font-medium mb-2">Friend Requests</h3>
          {friendRequests.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No pending friend requests.</p>
          ) : (
            <div className="space-y-3">
              {friendRequests.map((request) => (
                <div key={request.id} className="border rounded p-3 bg-gray-50">
                  <div className="flex items-center mb-2">
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                      <User className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium">{request.sender_name}</p>
                      <p className="text-sm text-gray-500">{request.sender_phone}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" className="flex-1" onClick={() => handleAcceptFriendRequest(request.id)}>
                      <UserCheck className="h-4 w-4 mr-1" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
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
