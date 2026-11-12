import { apiClient, errorMessage } from "@/api/client"
import { ExpenseCategory, ExpenseIcon } from "@/components/expense-categories"
import { UpdateExpenseModal } from "@/components/expense-modals"
import { formatCurrency, formatDate } from "@/components/lib/format"
import { useAuth } from "@/hooks/use-auth"
import { invalidatePoolData, usePool } from "@/hooks/use-pool"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowRightLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Undo2,
} from "lucide-react"
import { useState } from "react"
import { components } from "schema"
import { toast } from "sonner"
import { cn } from "./lib/utils"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
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

  if (!members || isMembersLoading || !memberId || !pool || isDetailsLoading) {
    return <Skeleton className="h-16 w-full rounded-lg" />
  }

  // The server allows the payer or a pool admin to change an expense.
  const canChange =
    expense.paid_by_member_id === memberId || pool.role === "ADMIN"

  const payer =
    expense.paid_by_member_id === memberId
      ? "you"
      : members.find(m => m.member.id === expense.paid_by_member_id)?.member
          .first_name

  const isPayment = expense.is_payment
  const yourShareLabel = isPayment
    ? expense.line_amount < 0
      ? "you paid"
      : "you received"
    : expense.line_amount < 0
      ? "you get back"
      : "you owe"

  const remove = async () => {
    try {
      await deleteExpense({
        params: {
          path: { pool_id: expense.pool_id, expense_id: expense.id },
        },
        headers: createAuthHeader(),
      })
      toast.success(isPayment ? "Payment undone" : `Deleted “${expense.name}”`)
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          isPayment
            ? "Couldn't undo this payment"
            : "Couldn't delete this expense"
        )
      )
    }
    setIsConfirmingDelete(false)
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border py-2.5 pr-2 pl-3 transition-colors",
        // Payments record money changing hands; keep them quieter than
        // actual spending.
        isPayment ? "bg-muted/30 border-dashed" : "bg-card hover:bg-muted/30"
      )}
    >
      {isPayment ? (
        <div className="text-muted-foreground flex size-9 shrink-0 items-center justify-center">
          <ArrowRightLeft className="size-4" />
        </div>
      ) : (
        <button
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md transition-colors hover:cursor-pointer",
            expense.category === selectedCategory
              ? "bg-primary text-primary-foreground"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          )}
          onClick={() =>
            setSelectedCategory(
              expense.category === selectedCategory
                ? undefined
                : expense.category
            )
          }
          aria-label={
            expense.category === selectedCategory
              ? "Show all categories"
              : "Show only this category"
          }
        >
          <ExpenseIcon category={expense.category} />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm",
            isPayment ? "text-muted-foreground" : "text-foreground font-medium"
          )}
        >
          {expense.name}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {isPayment ? "Payment" : `Paid by ${payer ?? "a former member"}`}
          {" · "}
          {formatDate(new Date(expense.inserted_at))}
          {expense.description ? ` · ${expense.description}` : ""}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            "text-sm tabular-nums",
            isPayment ? "text-muted-foreground" : "font-semibold"
          )}
        >
          {formatCurrency(expense.amount)}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {yourShareLabel}{" "}
          <span
            className={cn(
              "font-medium",
              isPayment
                ? "text-foreground"
                : expense.line_amount < 0
                  ? "text-primary"
                  : "text-destructive"
            )}
          >
            {formatCurrency(expense.line_amount)}
          </span>
        </p>
      </div>

      {/* Same width on every row, so the amounts line up. */}
      <div className="flex w-7 shrink-0 justify-end">
        {canChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground size-7"
                aria-label={`Actions for ${expense.name}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isPayment && (
                <DropdownMenuItem onSelect={() => setIsUpdateModalOpen(true)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => setIsConfirmingDelete(true)}
                className="text-destructive focus:text-destructive"
              >
                {isPayment ? (
                  <Undo2 className="text-destructive size-4" />
                ) : (
                  <Trash2 className="text-destructive size-4" />
                )}
                {isPayment ? "Undo payment" : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Dialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {isPayment ? "Undo this payment?" : `Delete “${expense.name}”?`}
            </DialogTitle>
            <DialogDescription>
              {isPayment
                ? "The balances it settled will be owed again."
                : "Everyone's balances will be updated. This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => setIsConfirmingDelete(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={remove}>
              {isPending ? "Working..." : isPayment ? "Undo payment" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
