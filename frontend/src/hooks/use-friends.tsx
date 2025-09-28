import { apiClient } from "@/api/client"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { useAuth } from "./use-auth"

export const useFriends = () => {
  const { memberId, createAuthHeader } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading } = apiClient.useQuery(
    "get",
    "/api/friends",
    {
      headers: createAuthHeader(),
    },
    { enabled: !!memberId }
  )

  const { data: friendRequestsRaw, isLoading: isFriendRequestsLoading } =
    apiClient.useQuery(
      "get",
      "/api/friend-requests",
      {
        headers: createAuthHeader(),
      },
      {
        enabled: !!memberId,
      }
    )

  const { mutate: acceptFriendRequestMutation, isPending: isAccepting } =
    apiClient.useMutation(
      "post",
      "/api/friend-requests/{friend_member_id}/accept",
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ["get", "/api/friend-requests"],
          })
          queryClient.invalidateQueries({
            queryKey: ["get", "/api/friends"],
          })
        },
      }
    )

  const { mutate: deleteFriendRequestMutation, isPending: isDeleting } =
    apiClient.useMutation("delete", "/api/friend-requests/{friend_member_id}", {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["get", "/api/friend-requests"],
        })
      },
    })

  const acceptFriendRequest = useCallback(
    async (invitingMemberId: string) => {
      return acceptFriendRequestMutation({
        params: {
          path: {
            friend_member_id: invitingMemberId,
          },
        },
        headers: createAuthHeader(),
      })
    },
    [acceptFriendRequestMutation, createAuthHeader]
  )

  const deleteFriendRequest = useCallback(async () => {
    deleteFriendRequestMutation({
      params: {
        path: {
          friend_member_id: memberId || "",
        },
      },
      headers: createAuthHeader(),
    })
  }, [deleteFriendRequestMutation, memberId, createAuthHeader])

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["get", "/api/friends"],
    })
  }

  return {
    friends: data || [],
    friendRequests: friendRequestsRaw || [],
    isFriendRequestsLoading,
    isFriendsLoading: isLoading,
    invalidate,
    mutations: {
      acceptFriendRequest,
      deleteFriendRequest,
      isAccepting,
      isDeleting,
    },
  }
}
