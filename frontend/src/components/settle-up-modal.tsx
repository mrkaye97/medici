import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/auth";
import { apiClient } from "@/api/client";

export function SettleUpModal({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { memberId, createAuthHeader } = useAuth();
  const { mutateAsync: createFriendRequest } = apiClient.useMutation(
    "post",
    "/api/members/{member_id}/friend-requests"
  );

  if (!memberId) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(value) => {
        setIsOpen(value);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm you've settled up</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          Clicking here will confirm your pool is all settled up.
          <Button
            onClick={() => {
              setIsOpen(false);
            }}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
