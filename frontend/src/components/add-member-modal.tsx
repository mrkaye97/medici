import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { apiClient } from "@/api/client";
import { useAuth } from "@/hooks/auth";
import { Spinner } from "@/components/ui/spinner";
import { useQueryClient } from "@tanstack/react-query";

type AddMemberModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  poolId: string;
};

export function AddMemberModal({
  isOpen,
  setIsOpen,
  poolId,
}: AddMemberModalProps) {
  const { memberId, createAuthHeader } = useAuth();
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data: friends, isLoading } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/pools/{pool_id}/members",
    {
      params: {
        path: {
          member_id: memberId || "",
          pool_id: poolId,
        },
      },
      headers: createAuthHeader(),
    },
  );

  const availableFriends = (friends || [])?.filter((f) => !f.is_pool_member);

  const { mutate: addFriendToPool } = apiClient.useMutation(
    "post",
    "/api/pools/{pool_id}/members",
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["get", "/api/members/{member_id}/pools/{pool_id}/members"],
        });
        setIsOpen(false);
        setSelectedFriends([]);
      },
    },
  );

  const handleAddMembers = async () => {
    setIsSubmitting(true);

    try {
      for (const friendId of selectedFriends) {
        await addFriendToPool({
          body: {
            member_id: friendId,
          },
          params: {
            path: { pool_id: poolId },
          },
          headers: createAuthHeader(),
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedFriends([]);
  };

  const toggleFriend = (friendId: string) => {
    setSelectedFriends((current) => {
      if (current.includes(friendId)) {
        return current.filter((id) => id !== friendId);
      } else {
        return [...current, friendId];
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Members to Pool</DialogTitle>
          <DialogDescription>
            Select friends to add to this expense pool.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-8 w-8" />
          </div>
        ) : availableFriends.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-muted-foreground">
              You don&apos;t have any friends to add to this pool.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[300px] pr-4">
            <div className="space-y-2">
              {availableFriends.map((friend) => (
                <div
                  key={friend.member.id}
                  className="flex items-center space-x-3 py-2 px-1"
                >
                  <Checkbox
                    id={`friend-${friend.member.id}`}
                    checked={selectedFriends.includes(friend.member.id)}
                    onCheckedChange={() => toggleFriend(friend.member.id)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={`friend-${friend.member.id}`}
                      className="text-sm font-medium cursor-pointer flex flex-col"
                    >
                      <span>
                        {friend.member.first_name} {friend.member.last_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {friend.member.email}
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex sm:justify-between">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleAddMembers}
            disabled={selectedFriends.length === 0 || isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <Spinner className="h-4 w-4" />
            ) : (
              "Add Selected Members"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
