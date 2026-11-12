import { formatCurrency, round } from "@/components/lib/format"
import { SettleUpModal } from "@/components/settle-up-modal"
import { Card } from "@/components/ui/card"
import { usePool } from "@/hooks/use-pool"
import { ArrowUpDown, CheckCircle2 } from "lucide-react"

export const BalancesPane = ({ poolId }: { poolId: string }) => {
  const {
    details,
    balances,
    isBalancesLoading,
    isDetailsLoading,
    isMembersLoading,
    isExpensesLoading,
  } = usePool({
    poolId,
  })

  const isLoading =
    isMembersLoading ||
    isExpensesLoading ||
    isDetailsLoading ||
    isBalancesLoading

  if (isLoading || !details) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground flex items-center gap-2 font-semibold">
          <ArrowUpDown className="text-primary h-5 w-5" />
          Balances
        </h3>
        <SettleUpModal poolId={poolId} />
      </div>

      {balances.length === 0 ? (
        <div className="py-8 text-center">
          <div className="bg-primary/10 mx-auto mb-4 h-16 w-16 rounded-full p-4">
            <CheckCircle2 className="text-primary mx-auto h-8 w-8" />
          </div>
          <p className="text-muted-foreground text-lg font-medium">
            You&apos;re all settled up
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            You don&apos;t owe anyone here, and nobody owes you.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {balances.map(balance => (
            <Card key={balance.memberId} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-medium">
                    {balance.name}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {balance.type === "inbound" ? "Owes you" : "You owe"}
                  </p>
                </div>
                <div className="ml-auto flex flex-row items-center gap-x-3 text-right">
                  <p
                    className={`text-lg font-semibold ${
                      balance.type === "inbound"
                        ? "text-primary"
                        : "text-destructive"
                    }`}
                  >
                    {formatCurrency(balance.amount)}
                  </p>
                  <SettleUpModal
                    poolId={poolId}
                    withMemberId={balance.memberId}
                    size="xs"
                  />
                  {balance.venmoHandle && (
                    <a
                      href={`https://venmo.com/?${new URLSearchParams({
                        txn: balance.type === "inbound" ? "request" : "pay",
                        recipients: balance.venmoHandle,
                        amount: String(round(balance.amount)),
                        note: "Settling up our pool on Medici",
                      })}`}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="transition-opacity duration-200 hover:opacity-80"
                    >
                      <img
                        src="https://images.ctfassets.net/gkyt4bl1j2fs/ym6BkLqyGjMBmiCwtM7AW/829bf561ea771c00839b484cb8edeebb/App_Icon.png?w=276&h=276&q=50&fm=webp&bg=transparent"
                        className="size-8 rounded-lg"
                        alt={`${balance.type === "inbound" ? "Request payment from" : "Pay"} ${balance.name} using Venmo`}
                      />
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
