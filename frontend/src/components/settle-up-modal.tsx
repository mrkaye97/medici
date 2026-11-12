import { errorMessage } from "@/api/client"
import { formatCurrency } from "@/components/lib/format"
import { useAuth } from "@/hooks/use-auth"
import { usePool } from "@/hooks/use-pool"
import { useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "./ui/alert"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"

/**
 * Settle up by recording payments. With `withMemberId`, only your balance
 * with that one person is cleared; without it, all of your balances in the
 * pool are. Other members' balances never change.
 */
export function SettleUpModal({
  poolId,
  withMemberId,
  size = "sm",
}: {
  poolId: string
  withMemberId?: string
  size?: "sm" | "xs"
}) {
  const { memberId } = useAuth()
  const {
    balances,
    mutations: { settleUp, isSettlePending },
  } = usePool({ poolId })
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!memberId) {
    return null
  }

  const toSettle = withMemberId
    ? balances.filter(b => b.memberId === withMemberId)
    : balances

  const describe = (b: (typeof balances)[number]) =>
    b.type === "outbound"
      ? `You paid ${b.firstName} ${formatCurrency(b.amount)}`
      : `${b.firstName} paid you ${formatCurrency(b.amount)}`

  return (
    <>
      <Button
        disabled={toSettle.length === 0}
        variant="outline"
        size="sm"
        className={size === "xs" ? "h-7 px-2 text-xs" : undefined}
        onClick={() => {
          setError(null)
          setIsOpen(true)
        }}
      >
        Settle Up
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {toSettle.length === 1
                ? `Settle up with ${toSettle[0].firstName}`
                : "Settle up your balances"}
            </DialogTitle>
            <DialogDescription>
              Confirm this once the money has actually changed hands. It&apos;s
              recorded as a payment, and nobody else&apos;s balances change.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <ul className="space-y-2">
              {toSettle.map(b => (
                <li
                  key={b.memberId}
                  className="bg-muted/50 rounded-lg border px-3 py-2 text-sm"
                >
                  {describe(b)}
                </li>
              ))}
            </ul>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={async () => {
                setError(null)
                try {
                  await settleUp(withMemberId)
                  toast.success(
                    toSettle.length === 1
                      ? `Settled up with ${toSettle[0].firstName}`
                      : `Recorded ${toSettle.length} payments`
                  )
                  setIsOpen(false)
                } catch (e) {
                  setError(
                    errorMessage(e, "Couldn't settle up. Please try again.")
                  )
                }
              }}
              disabled={isSettlePending || toSettle.length === 0}
            >
              {isSettlePending
                ? "Recording..."
                : toSettle.length === 1
                  ? "Record payment"
                  : `Record ${toSettle.length} payments`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
