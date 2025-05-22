import { create } from "zustand"

export const useChatStore = create((set) => ({
  // Friends state
  friends: [],
  friendRequests: [],
  selectedFriend: null,
  messages: [],
  isLoadingFriends: false,
  isLoadingRequests: false,

  // Set friends
  setFriends: (friends) => set({ friends }),

  // Set friend requests
  setFriendRequests: (friendRequests) => set({ friendRequests }),

  // Set selected friend
  setSelectedFriend: (friend) => set({ selectedFriend: friend }),

  // Set messages
  setMessages: (messages) => set({ messages }),

  // Add a new message
  addMessage: (message) =>
    set((state) => ({
      // Prevent adding duplicate messages if already present (e.g. optimistic vs server confirmation)
      messages: state.messages.find(m => m.id === message.id) ? state.messages : [...state.messages, message],
    })),

  // Update a message (e.g., for status like 'sent', 'delivered', or if temporary ID needs to be replaced)
  updateMessage: (updatedMessage) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === updatedMessage.id || (message.tempId && message.tempId === updatedMessage.tempId)
          ? { ...message, ...updatedMessage, tempId: undefined } // Remove tempId after update
          : message
      ),
    })),


  // Set loading states
  setLoadingFriends: (isLoading) => set({ isLoadingFriends: isLoading }),
  setLoadingRequests: (isLoading) => set({ isLoadingRequests: isLoading }),

  // Remove friend request
  removeFriendRequest: (requestId) =>
    set((state) => ({
      friendRequests: state.friendRequests.filter((request) => request.id !== requestId),
    })),

  // Add friend
  addFriend: (friend) =>
    set((state) => ({
      friends: [...state.friends, friend],
    })),
}))