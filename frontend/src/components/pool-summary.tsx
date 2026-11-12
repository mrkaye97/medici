import { errorMessage } from "@/api/client"
import { formatCurrency, initials } from "@/components/lib/format"
import { cn } from "@/components/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { usePool } from "@/hooks/use-pool"
import { Link } from "@tanstack/react-router"
import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AddExpenseModal } from "./expense-modals"
import { SettleUpModal } from "./settle-up-modal"
import { Button } from "./ui/button"
import { Skeleton } from "./ui/skeleton"

/** Your position in a pool: what you're owed, what you owe, or nothing. */
export function BalanceBadge({
  totalDebt,
  expenseCount,
}: {
  totalDebt: number
  expenseCount: number
}) {
  if (expenseCount === 0) {
    return (
      <span className="text-muted-foreground text-sm">No expenses yet</span>
    )
  }

  if (Math.abs(totalDebt) < 0.005) {
    return <span className="text-muted-foreground text-sm">Settled up</span>
  }

  const owed = totalDebt < 0
  return (
    <div className="text-right">
      <p className="text-muted-foreground text-xs">
        {owed ? "You're owed" : "You owe"}
      </p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          owed ? "text-primary" : "text-owe"
        )}
      >
        {formatCurrency(totalDebt)}
      </p>
    </div>
  )
}

type Member = { id: string; first_name: string; last_name: string }

const MAX_AVATARS = 4

function MemberAvatars({
  members,
  memberId,
}: {
  members: Member[]
  memberId: string | null
}) {
  // You first, then everyone else alphabetically.
  const sorted = [...members].sort((a, b) =>
    a.id === memberId
      ? -1
      : b.id === memberId
        ? 1
        : a.first_name.localeCompare(b.first_name)
  )
  const others = sorted.filter(m => m.id !== memberId)
  const names =
    others.length === 0
      ? "Just you"
      : others.length <= 2
        ? `You, ${others.map(m => m.first_name).join(" & ")}`
        : `You, ${others[0].first_name} & ${others.length - 1} others`

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex -space-x-1">
        {sorted.slice(0, MAX_AVATARS).map(m => (
          <span
            key={m.id}
            title={`${m.first_name} ${m.last_name}`}
            className="bg-secondary text-secondary-foreground ring-card flex size-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2"
          >
            {initials(m.first_name, m.last_name)}
          </span>
        ))}
        {sorted.length > MAX_AVATARS && (
          <span className="bg-muted text-muted-foreground ring-card flex size-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2">
            +{sorted.length - MAX_AVATARS}
          </span>
        )}
      </div>
      <span className="text-muted-foreground truncate text-sm">{names}</span>
    </div>
  )
}

export function PoolSummary({ poolId }: { poolId: string }) {
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false)
  const { memberId } = useAuth()

  const {
    details,
    members,
    balances,
    isDetailsLoading,
    mutations: { togglePoolHidden, isToggleHiddenPending },
  } = usePool({
    poolId,
  })

  if (isDetailsLoading || !details) {
    return <Skeleton className="h-[132px] w-full rounded-lg" />
  }

  const toggleHidden = async () => {
    const hide = !details.is_hidden
    try {
      await togglePoolHidden(hide)
      toast.success(
        hide ? `Hid ${details.name}` : `${details.name} is visible again`,
        hide
          ? {
              action: {
                label: "Undo",
                onClick: () => togglePoolHidden(false),
              },
            }
          : undefined
      )
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't update this pool"))
    }
  }

  return (
    <>
      {isAddExpenseModalOpen && (
        <AddExpenseModal
          pool={details}
          isOpen={isAddExpenseModalOpen}
          setIsOpen={setIsAddExpenseModalOpen}
        />
      )}
      <div className="bg-card hover:border-primary/30 overflow-hidden rounded-lg border transition-colors">
        <Link
          to="/pools/$poolId"
          params={{ poolId }}
          className="hover:bg-muted/40 block px-4 pt-4 pb-3 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold">
                {details.name}
              </h3>
              {details.description && (
                <p className="text-muted-foreground truncate text-sm">
                  {details.description}
                </p>
              )}
            </div>
            <BalanceBadge
              totalDebt={details.total_debt}
              expenseCount={details.expense_count}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <MemberAvatars
              members={members.map(m => m.member)}
              memberId={memberId}
            />
            <span className="text-muted-foreground shrink-0 text-xs">
              {details.expense_count}{" "}
              {details.expense_count === 1 ? "expense" : "expenses"}
            </span>
          </div>
        </Link>

        <div className="bg-muted/30 flex items-center justify-between gap-2 border-t px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            disabled={isToggleHiddenPending}
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={toggleHidden}
          >
            {details.is_hidden ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
            {details.is_hidden ? "Unhide" : "Hide"}
          </Button>
          <div className="flex flex-row gap-2">
            {balances.length > 0 && <SettleUpModal poolId={poolId} />}
            <Button size="sm" onClick={() => setIsAddExpenseModalOpen(true)}>
              Add Expense
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
