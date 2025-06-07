import { apiClient } from "@/api/client"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { useAuth } from "./use-auth"

export const useFriends = () => {
  const { memberId, createAuthHeader } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/friends",
    {
      params: {
        path: {
          member_id: memberId || "",
        },
      },
      headers: createAuthHeader(),
    },
    { enabled: !!memberId }
  )

  const { data: friendRequestsRaw, isLoading: isFriendRequestsLoading } =
    apiClient.useQuery(
      "get",
      "/api/members/{member_id}/friend-requests",
      {
        params: {
          path: { member_id: memberId || "" },
        },
        headers: createAuthHeader(),
      },
      {
        enabled: !!memberId,
      }
    )

  const { mutate: acceptFriendRequestMutation, isPending: isAccepting } =
    apiClient.useMutation(
      "post",
      "/api/members/{inviting_member_id}/friend-requests/{invitee_member_id}/accept",
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ["get", "/api/members/{member_id}/friend-requests"],
          })
          queryClient.invalidateQueries({
            queryKey: ["get", "/api/members/{member_id}/friends"],
          })
        },
      }
    )

  const { mutate: deleteFriendRequestMutation, isPending: isDeleting } =
    apiClient.useMutation(
      "delete",
      "/api/members/{inviting_member_id}/friend-requests/{invitee_member_id}",
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: ["get", "/api/members/{member_id}/friend-requests"],
          })
        },
      }
    )

  const acceptFriendRequest = useCallback(
    async (invitingMemberId: string) => {
      return acceptFriendRequestMutation({
        params: {
          path: {
            invitee_member_id: memberId || "",
            inviting_member_id: invitingMemberId,
          },
        },
        headers: createAuthHeader(),
      })
    },
    [acceptFriendRequestMutation, memberId, createAuthHeader]
  )

  const deleteFriendRequest = useCallback(
    async (inviteeMemberId: string) => {
      deleteFriendRequestMutation({
        params: {
          path: {
            inviting_member_id: memberId || "",
            invitee_member_id: inviteeMemberId || "",
          },
        },
        headers: createAuthHeader(),
      })
    },
    [deleteFriendRequestMutation, memberId, createAuthHeader]
  )

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["get", "/api/members/{member_id}/friends"],
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
