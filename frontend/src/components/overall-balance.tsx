import { apiClient } from "@/api/client"
import { formatCurrency } from "@/components/lib/format"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { useQueries } from "@tanstack/react-query"

/**
 * Your position across every pool (hidden ones too: the money is still
 * real). Uses the same queries as the pool cards, so it costs no extra
 * requests.
 */
export function OverallBalance({ poolIds }: { poolIds: string[] }) {
  const { memberId, createAuthHeader } = useAuth()

  const results = useQueries({
    queries: poolIds.map(poolId =>
      apiClient.queryOptions(
        "get",
        "/api/pools/{pool_id}",
        {
          params: { path: { pool_id: poolId, member_id: memberId || "" } },
          headers: createAuthHeader(),
        },
        { enabled: !!memberId }
      )
    ),
  })

  if (poolIds.length === 0) {
    return null
  }

  if (results.some(r => r.isLoading)) {
    return <Skeleton className="h-5 w-64" />
  }

  let owedToYou = 0
  let youOwe = 0
  for (const { data } of results) {
    if (!data) continue
    if (data.total_debt < 0) owedToYou += -data.total_debt
    else youOwe += data.total_debt
  }

  if (owedToYou < 0.005 && youOwe < 0.005) {
    return (
      <p className="text-muted-foreground text-sm">
        You&apos;re all settled up everywhere.
      </p>
    )
  }

  return (
    <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {owedToYou >= 0.005 && (
        <span>
          You&apos;re owed{" "}
          <span className="text-primary font-semibold tabular-nums">
            {formatCurrency(owedToYou)}
          </span>
        </span>
      )}
      {youOwe >= 0.005 && (
        <span>
          You owe{" "}
          <span className="text-destructive font-semibold tabular-nums">
            {formatCurrency(youOwe)}
          </span>
        </span>
      )}
    </p>
  )
}
