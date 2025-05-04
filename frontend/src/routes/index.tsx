import { PoolSummary } from "@/components/pool-summay";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/auth";
import { apiClient } from "@/api/client";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FriendsView } from "@/components/friends-view";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { memberId, createAuthHeader } = useAuth();

  const { data: friendsRaw, isLoading: isFriendsLoading } = apiClient.useQuery(
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
    {
      enabled: !!memberId,
    },
  );

  const { data: friendRequestsRaw, isLoading: isFriendRequestsLoading } =
    apiClient.useQuery(
      "get",
      "/api/members/{member_id}/friend-requests",
      {
        params: {
          path: {
            member_id: memberId || "",
          },
        },
        headers: createAuthHeader(),
      },
      {
        enabled: !!memberId,
      },
    );

  const queryClient = useQueryClient();

  const { mutate: acceptFriendRequest } = apiClient.useMutation(
    "post",
    "/api/members/{member_id}/friend-requests/{friend_member_id}/accept",
  );

  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    data,
    isLoading: isPoolsLoading,
    isFetching,
  } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/pools",
    {
      params: {
        path: {
          member_id: memberId || "",
        },
      },
      headers: createAuthHeader(),
    },
    {
      enabled: !!memberId,
    },
  );

  const pools = data || [];
  const friends = friendsRaw || [];
  const friendRequests = friendRequestsRaw || [];
  const isLoading =
    isFriendsLoading || isFriendRequestsLoading || isPoolsLoading;

  if (isLoading || isFetching) {
    return (
      <div className="flex flex-col items-center">
        <Spinner className="mt-8" />
      </div>
    );
  }
  return (
    <div className="flex flex-row gap-x-4 px-4">
      <div className="flex flex-1 flex-col my-8">
        <div className="flex flex-col gap-y-4">
          {pools.map((p) => (
            <PoolSummary key={p.id} poolId={p.id} />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col my-8">
        <FriendsView />
      </div>
    </div>
  );
}
