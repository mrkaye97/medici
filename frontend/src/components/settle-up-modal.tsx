import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/auth";
import { apiClient } from "@/api/client";

export function SettleUpModal({
  poolId,
  isOpen,
  setIsOpen,
}: {
  poolId: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { memberId, createAuthHeader } = useAuth();
  const { mutateAsync: settleUpPool } = apiClient.useMutation(
    "patch",
    "/api/members/{member_id}/pools/{pool_id}/settle-up",
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
          <DialogTitle>Confirm you&apos;ve settled up</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          Clicking here will confirm your pool is all settled up.
          <Button
            onClick={async () => {
              await settleUpPool({
                params: {
                  path: {
                    member_id: memberId,
                    pool_id: poolId,
                  },
                },
                headers: createAuthHeader(),
              });

              await queryClient.invalidateQueries({
                queryKey: [
                  "get",
                  "/api/pools/{pool_id}/members/{member_id}/expenses",
                ],
              });
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
