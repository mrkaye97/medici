import { apiClient } from "@/api/client";
import { useAuth } from "./use-auth";
import { useQueryClient } from "@tanstack/react-query";

export const useFriends = () => {
  const { memberId, createAuthHeader } = useAuth();
  const queryClient = useQueryClient();

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
    { enabled: !!memberId },
  );

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["get", "/api/members/{member_id}/friends"],
    });
  };

  return {
    friends: data || [],
    isFriendsLoading: isLoading,
    invalidate,
  };
};
