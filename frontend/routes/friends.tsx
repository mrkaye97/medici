import { AddFriendModal } from "@/components/add-friend-modal";
import { MemberProfile } from "@/components/member-profile";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/auth";
import { useState } from "react";
import { $api } from "src/api";

export const Route = createFileRoute("/friends")({
  component: FriendsPage,
});

function FriendsPage() {
  const { id } = useAuth();

  const { data: friends, isLoading: isFriendsLoading } = $api.useQuery(
    "get",
    "/api/members/{member_id}/friends",
    {
      params: {
        path: {
          member_id: id || "",
        },
      },
    },
    {
      enabled: !!id,
    }
  );

  const { data: friendRequests, isLoading: isFriendRequestsLoading } =
    $api.useQuery(
      "get",
      "/api/members/{member_id}/friend-requests",
      {
        params: {
          path: {
            member_id: id || "",
          },
        },
      },
      {
        enabled: !!id,
      }
    );

  const queryClient = useQueryClient();

  const { mutate: acceptFriendRequest } = $api.useMutation(
    "post",
    "/api/members/{member_id}/friend-requests/{friend_member_id}/accept"
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
    <div className="flex gap-4">
      <div className="flex-1 bg-white">
        <AddFriendModal isOpen={isModalOpen} setIsOpen={setIsModalOpen} />
        <div className="flex flex-col justify-between h-full p-8">
          <div className="flex flex-col gap-y-2">
            <h2 className="text-xl font-bold">My Friends</h2>
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-2 py-2 w-full"
              >
                <MemberProfile id={friend.id} />
              </div>
            ))}
            {friends.length === 0 && (
              <p className="text-gray-500">No friends yet</p>
            )}
          </div>
          <div className="flex flex-row justify-center">
            <Button size="lg" onClick={() => setIsModalOpen(true)}>
              Add friend
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-gray-200 h-screen p-8">
        <h2 className="text-xl font-bold mb-4">Friend Requests</h2>
        <div className="space-y-2">
          {friendRequests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col justify-between p-2 gap-y-4 hover:bg-gray-50"
            >
              <div className="flex flex-col items-start justify-center gap-2">
                <span>{request.first_name}</span>
                <span>{request.email}</span>
              </div>
              <div className="space-x-2">
                <Button
                  onClick={() => {
                    acceptFriendRequest({
                      params: {
                        path: {
                          member_id: id || "",
                          friend_member_id: request.id,
                        },
                      },
                    });

                    queryClient.invalidateQueries({
                      queryKey: [
                        "get",
                        "/api/members/{member_id}/friend-requests",
                      ],
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
