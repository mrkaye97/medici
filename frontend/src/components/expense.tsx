import { apiClient } from "@/api/client"
import {
  ExpenseCategory,
  ExpenseIcon,
  UpdateExpenseModal,
} from "@/components/expense-modals"
import { useAuth } from "@/hooks/use-auth"
import { usePool } from "@/hooks/use-pool"
import { useQueryClient } from "@tanstack/react-query"
import { Edit, X } from "lucide-react"
import { useState } from "react"
import { components } from "schema"
import { cn } from "./lib/utils"
import { Button } from "./ui/button"

export const formatDate = (date: Date) => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(amount))
}

type Expense = components["schemas"]["RecentExpenseDetails"]

export function Expense({ expense }: { expense: Expense }) {
  const queryClient = useQueryClient()
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)

  const { memberId, createAuthHeader } = useAuth()
  const {
    members,
    isMembersLoading,
    invalidate,
    details: pool,
    isDetailsLoading,
  } = usePool({
    poolId: expense.pool_id,
  })
  const { mutateAsync: deleteExpense, isPending } = apiClient.useMutation(
    "delete",
    "/api/members/{member_id}/pools/{pool_id}/expenses/{expense_id}",
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: [
            "get",
            "/api/pools/{pool_id}/members/{member_id}/expenses",
          ],
        })
        await queryClient.invalidateQueries({
          queryKey: [
            "get",
            "/api/pools/{pool_id}/members/{member_id}/balances",
          ],
        })

        await invalidate()
      },
    }
  )

  if (!members || isMembersLoading || !memberId || !pool || isDetailsLoading) {
    return (
      <div className="mt-4 flex w-full flex-1 gap-x-4 px-4">
        <div className="flex w-full flex-1 flex-col">
          <h2 className="mb-6 text-2xl font-semibold">Loading...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="hover:bg-muted/30 rounded-lg border p-4 transition-colors">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <div className="flex flex-row items-center gap-x-3">
              <div className="bg-primary/10 text-primary rounded-lg border p-2.5">
                <ExpenseIcon category={expense.category as ExpenseCategory} />
              </div>
              <div className="flex flex-col">
                <span className="text-foreground font-medium">
                  {expense.name}
                </span>
                <span className="text-muted-foreground text-sm">
                  {new Date(expense.inserted_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-x-1">
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
              onClick={() => setIsUpdateModalOpen(true)}
              aria-label={`Edit expense: ${expense.name}`}
            >
              <Edit className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive h-8 w-8 p-0"
              onClick={async () => {
                await deleteExpense({
                  params: {
                    path: {
                      pool_id: expense.pool_id,
                      member_id: memberId,
                      expense_id: expense.id,
                    },
                  },
                  headers: createAuthHeader(),
                })
              }}
              disabled={isPending}
              aria-label={`Delete expense: ${expense.name}`}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        {expense.description && (
          <div className="py-4">{expense.description}</div>
        )}
        <div className="mt-1 flex items-center justify-between">
          <span className="text-foreground text-lg font-semibold">
            {formatCurrency(expense.amount)}
          </span>
          <div className="flex flex-col items-end justify-end">
            <span className="text-muted-foreground text-sm">
              Paid by{" "}
              <span className="font-medium">
                {
                  members?.find(m => m.member.id === expense.paid_by_member_id)
                    ?.member.first_name
                }
              </span>
            </span>
            <div className="flex items-center">
              <span className="text-muted-foreground text-sm">
                {expense.line_amount < 0 ? "You get back" : "You owe"}{" "}
              </span>
              <span
                className={cn(
                  "ml-1 font-medium",
                  expense.line_amount < 0 ? "text-primary" : "text-destructive"
                )}
              >
                {formatCurrency(expense.line_amount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {isUpdateModalOpen && (
        <UpdateExpenseModal
          pool={pool}
          expenseId={expense.id}
          isOpen={isUpdateModalOpen}
          setIsOpen={setIsUpdateModalOpen}
        />
      )}
    </div>
  )
}
