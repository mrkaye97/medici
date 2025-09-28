import { apiClient } from "@/api/client"
import { useAuth } from "@/hooks/use-auth"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"

export function SettleUpModal({
  poolId,
  isOpen,
  setIsOpen,
}: {
  poolId: string
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { memberId, createAuthHeader } = useAuth()
  const { mutateAsync: settleUpPool, isPending } = apiClient.useMutation(
    "patch",
    "/api/pools/{pool_id}/settle-up"
  )

  if (!memberId) {
    return null
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={value => {
        setIsOpen(value)
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
              try {
                await settleUpPool({
                  params: {
                    path: {
                      pool_id: poolId,
                    },
                  },
                  headers: createAuthHeader(),
                })

                await queryClient.invalidateQueries({
                  queryKey: ["get", "/api/pools/{pool_id}/expenses"],
                })
                setIsOpen(false)
              } catch (error) {
                console.error("Failed to settle up pool:", error)
                alert("Failed to settle up pool. Please try again.")
              }
            }}
            disabled={isPending}
          >
            {isPending ? "Confirming..." : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
