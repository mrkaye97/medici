import { apiClient, errorMessage } from "@/api/client"
import { round } from "@/components/lib/format"
import { useAuth } from "@/hooks/use-auth"
import { invalidatePoolData } from "@/hooks/use-pool"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"
import {
  buildLineItems,
  ExpenseFormModal,
  ExpenseFormValues,
  Members,
  Pool,
  SplitState,
} from "./expense-form-modal"

type SubmitResult = { success: boolean; error?: string }

export function AddExpenseModal({
  pool,
  isOpen,
  setIsOpen,
}: {
  pool: Pool
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}) {
  const { createAuthHeader } = useAuth()
  const queryClient = useQueryClient()
  const { mutateAsync: addExpense, isPending } = apiClient.useMutation(
    "post",
    "/api/pools/{pool_id}/expenses"
  )

  const onSubmit = useCallback(
    async (
      data: ExpenseFormValues,
      split: SplitState,
      members: Members
    ): Promise<SubmitResult> => {
      const built = buildLineItems(data, split, members)
      if ("error" in built) {
        return { success: false, error: built.error }
      }

      try {
        await addExpense({
          body: {
            paid_by_member_id: data.paidByMemberId,
            pool_id: pool.id,
            name: data.expenseName,
            amount: round(data.amount),
            line_items: built.lineItems,
            description: data.description,
            category: data.category,
            split_method: data.splitMethod,
          },
          params: { path: { pool_id: pool.id } },
          headers: createAuthHeader(),
        })

        await invalidatePoolData(queryClient)
        toast.success(`Added “${data.expenseName}” to ${pool.name}`)

        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: errorMessage(
            error,
            "Failed to add expense. Please try again."
          ),
        }
      }
    },
    [addExpense, pool.id, pool.name, queryClient, createAuthHeader]
  )

  return (
    <ExpenseFormModal
      pool={pool}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      onSubmit={onSubmit}
      isSubmitPending={isPending}
    />
  )
}

export function UpdateExpenseModal({
  pool,
  expenseId,
  isOpen,
  setIsOpen,
}: {
  pool: Pool
  expenseId: string
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}) {
  const { createAuthHeader, memberId } = useAuth()
  const queryClient = useQueryClient()

  const { data: expense, isLoading } = apiClient.useQuery(
    "get",
    "/api/pools/{pool_id}/expenses/{expense_id}",
    {
      params: {
        path: {
          member_id: memberId || "",
          pool_id: pool.id,
          expense_id: expenseId,
        },
      },
      headers: createAuthHeader(),
    },
    {
      enabled: !!memberId && isOpen,
    }
  )
  const { mutateAsync: updateExpense, isPending } = apiClient.useMutation(
    "patch",
    "/api/pools/{pool_id}/expenses/{expense_id}"
  )

  const onSubmit = useCallback(
    async (
      data: ExpenseFormValues,
      split: SplitState,
      members: Members
    ): Promise<SubmitResult> => {
      const built = buildLineItems(data, split, members)
      if ("error" in built) {
        return { success: false, error: built.error }
      }

      try {
        await updateExpense({
          body: {
            name: data.expenseName,
            amount: round(data.amount),
            line_items: built.lineItems,
            description: data.description,
            category: data.category,
            split_method: data.splitMethod,
          },
          params: { path: { pool_id: pool.id, expense_id: expenseId } },
          headers: createAuthHeader(),
        })

        await invalidatePoolData(queryClient)
        toast.success(`Updated “${data.expenseName}”`)

        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: errorMessage(
            error,
            "Failed to update expense. Please try again."
          ),
        }
      }
    },
    [updateExpense, pool.id, queryClient, createAuthHeader, expenseId]
  )

  if (isLoading || !expense) {
    return null
  }

  const defaultSplitAmounts: SplitState = {
    splitMethod: expense.split_method,
    splitAmounts: expense.line_items.map(lineItem => ({
      memberId: lineItem.debtor_member_id,
      amount:
        expense.split_method === "Percentage"
          ? round((lineItem.amount / expense.amount) * 100)
          : lineItem.amount,
    })),
  }

  return (
    <ExpenseFormModal
      pool={pool}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      onSubmit={onSubmit}
      isSubmitPending={isPending}
      defaultValues={{
        amount: expense.amount,
        category: expense.category,
        description: expense.description || "",
        expenseName: expense.name,
        paidByMemberId: expense.paid_by_member_id,
        splitMethod: expense.split_method,
      }}
      defaultSplitAmounts={defaultSplitAmounts}
      title="Edit Expense"
      submitLabel="Save changes"
    />
  )
}
