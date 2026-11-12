import { apiClient, errorMessage } from "@/api/client"
import { ExpenseCategory, ExpenseIcon } from "@/components/expense-categories"
import { UpdateExpenseModal } from "@/components/expense-modals"
import { formatCurrency, formatDate } from "@/components/lib/format"
import { useAuth } from "@/hooks/use-auth"
import { invalidatePoolData, usePool } from "@/hooks/use-pool"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowRightLeft, Edit, X } from "lucide-react"
import { useState } from "react"
import { components } from "schema"
import { toast } from "sonner"
import { cn } from "./lib/utils"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Skeleton } from "./ui/skeleton"

type Expense = components["schemas"]["RecentExpenseDetails"]

export function Expense({
  expense,
  selectedCategory,
  setSelectedCategory,
}: {
  expense: Expense
  selectedCategory: ExpenseCategory | undefined
  setSelectedCategory: (category: ExpenseCategory | undefined) => void
}) {
  const queryClient = useQueryClient()
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)

  const { memberId, createAuthHeader } = useAuth()
  const {
    members,
    isMembersLoading,
    details: pool,
    isDetailsLoading,
  } = usePool({
    poolId: expense.pool_id,
  })
  const { mutateAsync: deleteExpense, isPending } = apiClient.useMutation(
    "delete",
    "/api/pools/{pool_id}/expenses/{expense_id}",
    {
      onSuccess: () => invalidatePoolData(queryClient),
    }
  )
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (!members || isMembersLoading || !memberId || !pool || isDetailsLoading) {
    return <Skeleton className="h-[104px] w-full rounded-lg" />
  }

  // The server allows the payer or a pool admin to change an expense.
  const canChange =
    expense.paid_by_member_id === memberId || pool.role === "ADMIN"

  return (
    <div className="hover:bg-muted/30 rounded-lg border p-4 transition-colors">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <div className="flex flex-row items-center gap-x-3">
              <Button
                variant="ghost"
                className="bg-primary/10 text-primary rounded-lg border p-2.5 hover:cursor-pointer border-primary hover:bg-primary/20 hover:text-primary"
                onClick={() => {
                  if (expense.category === selectedCategory) {
                    setSelectedCategory(undefined)
                  } else {
                    setSelectedCategory(expense.category)
                  }
                }}
              >
                {expense.is_payment ? (
                  <ArrowRightLeft className="size-4" />
                ) : (
                  <ExpenseIcon category={expense.category as ExpenseCategory} />
                )}
              </Button>

              <div className="flex flex-col">
                <span className="text-foreground flex items-center gap-2 font-medium">
                  {expense.name}
                  {expense.is_payment && (
                    <Badge variant="secondary" className="text-xs">
                      Payment
                    </Badge>
                  )}
                </span>
                <span className="text-muted-foreground text-sm">
                  {formatDate(new Date(expense.inserted_at))}
                </span>
              </div>
            </div>
          </div>
          {canChange && (
            <div className="flex items-center gap-x-1">
              {!expense.is_payment && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                  onClick={() => setIsUpdateModalOpen(true)}
                  aria-label={`Edit expense: ${expense.name}`}
                >
                  <Edit className="size-4" />
                </Button>
              )}
              {isConfirmingDelete ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 px-2 text-xs"
                    disabled={isPending}
                    onClick={async () => {
                      setDeleteError(null)
                      try {
                        await deleteExpense({
                          params: {
                            path: {
                              pool_id: expense.pool_id,
                              expense_id: expense.id,
                            },
                          },
                          headers: createAuthHeader(),
                        })
                        toast.success(
                          expense.is_payment
                            ? "Payment undone"
                            : `Deleted “${expense.name}”`
                        )
                      } catch (error) {
                        setDeleteError(
                          errorMessage(
                            error,
                            expense.is_payment
                              ? "Couldn't undo this payment"
                              : "Couldn't delete this expense"
                          )
                        )
                        setIsConfirmingDelete(false)
                      }
                    }}
                  >
                    {isPending
                      ? "Deleting..."
                      : expense.is_payment
                        ? "Undo payment"
                        : "Delete"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    disabled={isPending}
                    onClick={() => setIsConfirmingDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive h-8 w-8 p-0"
                  onClick={() => {
                    setDeleteError(null)
                    setIsConfirmingDelete(true)
                  }}
                  aria-label={
                    expense.is_payment
                      ? `Undo payment: ${expense.name}`
                      : `Delete expense: ${expense.name}`
                  }
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          )}
        </div>
        {deleteError && (
          <p className="text-destructive text-sm">{deleteError}</p>
        )}
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
                {expense.is_payment
                  ? expense.line_amount < 0
                    ? "You paid"
                    : "You received"
                  : expense.line_amount < 0
                    ? "You get back"
                    : "You owe"}{" "}
              </span>
              <span
                className={cn(
                  "ml-1 font-medium",
                  // A payment is a record of money changing hands, not a
                  // debt, so it isn't colored as one.
                  expense.is_payment
                    ? "text-foreground"
                    : expense.line_amount < 0
                      ? "text-primary"
                      : "text-destructive"
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
