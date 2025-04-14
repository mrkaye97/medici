import { AddFriendModal } from "@/components/add-friend-modal";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "app/hooks/auth";
import { useState } from "react";
import { useTRPC } from "trpc/react";

// You might want to define these types based on your actual data structure
type Friend = {
  id: string;
  name: string;
  avatar?: string;
};

type FriendRequest = {
  id: string;
  from: {
    id: string;
    name: string;
    avatar?: string;
  };
  status: "pending";
};

export const Route = createFileRoute("/friends")({
  component: FriendsPage,
});

function FriendsPage() {
  const trpc = useTRPC();
  const { id } = useAuth();
  const { data: friends, isLoading: isFriendsLoading } = useQuery(
    trpc.listFriends.queryOptions(
      {
        memberId: id || "",
      },
      {
        enabled: !!id,
      }
    )
  );
  const { data: friendRequests, isLoading: isFriendRequestsLoading } = useQuery(
    trpc.listInboundFriendRequests.queryOptions(
      {
        memberId: id || "",
      },
      {
        enabled: !!id,
      }
    )
  );

  const queryClient = useQueryClient();

  const { mutate: acceptFriendRequest } = useMutation(
    trpc.acceptFriendRequest.mutationOptions()
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isLoading = isFriendsLoading || isFriendRequestsLoading;

  if (isLoading || !friends || !friendRequests) {
    return <div>Loading...</div>;
  }

  if (!id) {
    return <Navigate to="/" />;
  }

  return (
    <div className="flex gap-4 p-4">
      <div className="flex-1 bg-white rounded-lg shadow p-4">
        <AddFriendModal isOpen={isModalOpen} setIsOpen={setIsModalOpen} />
        <Button onClick={() => setIsModalOpen(true)}>Add friend</Button>
        <h2 className="text-xl font-bold mb-4">My Friends</h2>
        <div className="space-y-2">
          {friends.map((friend) => (
            <div
              key={friend.id}
              className="flex items-center gap-2 p-2 hover:bg-gray-50"
            >
              <span>{friend.firstName}</span>
            </div>
          ))}
          {friends.length === 0 && (
            <p className="text-gray-500">No friends yet</p>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4">Friend Requests</h2>
        <div className="space-y-2">
          {friendRequests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col justify-between p-2 gap-y-4 hover:bg-gray-50"
            >
              <div className="flex flex-col items-start justify-center gap-2">
                <span>{request.firstName}</span>
                <span>{request.email}</span>
              </div>
              <div className="space-x-2">
                <Button
                  onClick={() => {
                    acceptFriendRequest({
                      memberId: id || "",
                      friendMemberId: request.id,
                    });

                    queryClient.invalidateQueries({
                      queryKey: trpc.listInboundFriendRequests.queryKey(),
                    });
                  }}
                >
                  Accept
                </Button>
              </div>
            </div>
          ))}
          {friendRequests.length === 0 && (
            <p className="text-gray-500">No pending friend requests</p>
          )}
        </div>
      </div>
    </div>
  );
}
