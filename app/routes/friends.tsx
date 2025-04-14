import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

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
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);

  return (
    <div className="flex gap-4 p-4">
      {/* Friends Panel */}
      <div className="flex-1 bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4">My Friends</h2>
        <div className="space-y-2">
          {friends.map((friend) => (
            <div
              key={friend.id}
              className="flex items-center gap-2 p-2 hover:bg-gray-50"
            >
              {friend.avatar && (
                <img src={friend.avatar} className="w-8 h-8 rounded-full" />
              )}
              <span>{friend.name}</span>
            </div>
          ))}
          {friends.length === 0 && (
            <p className="text-gray-500">No friends yet</p>
          )}
        </div>
      </div>

      {/* Friend Requests Panel */}
      <div className="flex-1 bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4">Friend Requests</h2>
        <div className="space-y-2">
          {friendRequests.map((request) => (
            <div
              key={request.id}
              className="flex items-center justify-between p-2 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                {request.from.avatar && (
                  <img
                    src={request.from.avatar}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span>{request.from.name}</span>
              </div>
              <div className="space-x-2">
                <button className="px-3 py-1 bg-blue-500 text-white rounded-md">
                  Accept
                </button>
                <button className="px-3 py-1 bg-gray-200 rounded-md">
                  Decline
                </button>
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
