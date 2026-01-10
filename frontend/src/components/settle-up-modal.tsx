import { apiClient } from "@/api/client"
import { useAuth } from "@/hooks/use-auth"
import { usePool } from "@/hooks/use-pool"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"

export function SettleUpModal({ poolId }: { poolId: string }) {
  const queryClient = useQueryClient()
  const { memberId, createAuthHeader } = useAuth()
  const { mutateAsync: settleUpPool, isPending } = apiClient.useMutation(
    "patch",
    "/api/pools/{pool_id}/settle-up"
  )
  const [isOpen, setIsOpen] = useState(false)
  const { totalExpenses } = usePool({ poolId })

  if (!memberId) {
    return null
  }

  console.log(totalExpenses)

  return (
    <>
      <Button
        disabled={totalExpenses === 0}
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        Settle Up
      </Button>
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
    </>
  )
}
