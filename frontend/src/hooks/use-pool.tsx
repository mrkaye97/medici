import { apiClient } from "@/api/client"
import { ExpenseCategory } from "@/components/expense-modals"
import { QueryClient, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { components } from "schema"
import { useAuth } from "./use-auth"
import { useFriends } from "./use-friends"

export type ExpensesListProps = {
  limit?: number
  category?: ExpenseCategory
  isSettled?: boolean
  paidByMemberId?: string
  since?: Date | undefined
  until?: Date | undefined
}

/**
 * Refresh everything that depends on a pool's expenses, payments or members:
 * the expense lists, balances, the pool's details (the amount badge on the
 * pool card), the pool list and the member list. Call it after any change.
 */
export const invalidatePoolData = (queryClient: QueryClient) =>
  Promise.all(
    [
      "/api/pools/{pool_id}/expenses",
      "/api/pools/{pool_id}/expenses/{expense_id}",
      "/api/pools/{pool_id}/balances",
      "/api/pools/{pool_id}/members",
      "/api/pools/{pool_id}",
      "/api/pools",
    ].map(path => queryClient.invalidateQueries({ queryKey: ["get", path] }))
  )

export const usePool = ({
  poolId,
  expenseOptions,
}: {
  poolId: string
  expenseOptions?: ExpensesListProps
}) => {
  const { memberId, createAuthHeader } = useAuth()
  const queryClient = useQueryClient()

  const { friends } = useFriends()

  const { data: members, isLoading: isMembersLoading } = apiClient.useQuery(
    "get",
    "/api/pools/{pool_id}/members",
    {
      params: {
        path: {
          member_id: memberId || "",
          pool_id: poolId,
        },
      },
      headers: createAuthHeader(),
    }
  )

  const { data: details, isLoading: isDetailsLoading } = apiClient.useQuery(
    "get",
    "/api/pools/{pool_id}",
    {
      params: {
        path: {
          pool_id: poolId,
          member_id: memberId || "",
        },
      },
      headers: createAuthHeader(),
    },
    {
      enabled: !!memberId,
    }
  )

  const {
    data: expenses,
    isLoading: isExpensesLoading,
    isRefetching: isExpensesRefetching,
  } = apiClient.useQuery(
    "get",
    "/api/pools/{pool_id}/expenses",
    {
      params: {
        path: {
          pool_id: poolId,
          member_id: memberId || "",
        },
        query: {
          limit: expenseOptions?.limit ?? 100,
          category: expenseOptions?.category,
          is_settled: expenseOptions?.isSettled ?? false,
          paid_by_member_id: expenseOptions?.paidByMemberId,
          since: expenseOptions?.since
            ? expenseOptions.since.toISOString()
            : undefined,
          until: expenseOptions?.until
            ? expenseOptions.until.toISOString()
            : undefined,
        },
      },
      headers: createAuthHeader(),
    },
    {
      placeholderData: prev => prev,
    }
  )

  const { data: rawBalances, isLoading: isBalancesLoading } =
    apiClient.useQuery("get", "/api/pools/{pool_id}/balances", {
      params: {
        path: {
          member_id: memberId || "",
          pool_id: poolId,
        },
      },
      headers: createAuthHeader(),
    })

  const balances = useMemo(() => {
    return (rawBalances || [])
      .map(b => {
        // Look people up among the pool's members, not your friends: someone
        // another admin added may not be your friend, and their balance
        // used to be silently dropped.
        const otherMember =
          members?.find(m => m.member.id === b.member_id)?.member ??
          friends.find(m => m.id === b.member_id)

        if (!otherMember) {
          return null
        }

        const name = otherMember.first_name + " " + otherMember.last_name

        return {
          memberId: b.member_id,
          name,
          firstName: otherMember.first_name,
          amount: b.amount,
          type: b.direction,
          venmoHandle: otherMember.venmo_handle,
        }
      })
      .filter(b => b !== null)
  }, [rawBalances, members, friends])

  const invalidate = useCallback(
    () => invalidatePoolData(queryClient),
    [queryClient]
  )

  const { mutateAsync: addFriendToPool, isPending: isAddPending } =
    apiClient.useMutation("post", "/api/pools/{pool_id}/members")

  const { mutateAsync: removeFriendFromPool, isPending: isRemovePending } =
    apiClient.useMutation("delete", "/api/pools/{pool_id}/members/{member_id}")

  const { mutateAsync: settleUpMutation, isPending: isSettlePending } =
    apiClient.useMutation("post", "/api/pools/{pool_id}/settle-up")

  /** Record payments that clear your balance with one person, or all of
   * your balances in the pool. Nobody else's balances change. */
  const settleUp = useCallback(
    async (withMemberId?: string) => {
      await settleUpMutation({
        params: { path: { pool_id: poolId } },
        body: { member_id: withMemberId ?? null },
        headers: createAuthHeader(),
      })

      await invalidatePoolData(queryClient)
    },
    [settleUpMutation, createAuthHeader, poolId, queryClient]
  )

  const { mutateAsync: toggleHidden, isPending: isToggleHiddenPending } =
    apiClient.useMutation("post", "/api/pools/{pool_id}/toggle-hidden")

  const {
    mutateAsync: modifyDefaultSplitMutation,
    isPending: isModifyDefaultSplitPending,
  } = apiClient.useMutation("patch", "/api/pools/{pool_id}/default-splits")

  const addFriend = useCallback(
    async (friendMemberId: string) => {
      await addFriendToPool({
        body: {
          member_id: friendMemberId,
        },
        params: {
          path: { pool_id: poolId },
        },
        headers: createAuthHeader(),
      })

      await invalidate()
    },
    [addFriendToPool, createAuthHeader, poolId, invalidate]
  )

  const removeFriend = useCallback(
    async (friendMemberId: string) => {
      await removeFriendFromPool({
        params: {
          path: {
            pool_id: poolId,
            member_id: friendMemberId,
          },
        },
        headers: createAuthHeader(),
      })

      await invalidate()
    },
    [poolId, createAuthHeader, invalidate, removeFriendFromPool]
  )

  const modifyDefaultSplit = useCallback(
    async (percentages: components["schemas"]["MemberIdSplitPercentage"][]) => {
      if (!memberId) {
        return
      }

      await modifyDefaultSplitMutation({
        params: {
          path: {
            pool_id: poolId,
          },
        },
        body: {
          default_split_percentages: percentages,
        },
        headers: createAuthHeader(),
      })

      await invalidate()
    },
    [createAuthHeader, invalidate, memberId, modifyDefaultSplitMutation, poolId]
  )

  const togglePoolHidden = useCallback(
    async (hide: boolean) => {
      await toggleHidden({
        body: {
          is_hidden: hide,
        },
        params: {
          path: {
            pool_id: poolId,
          },
        },
        headers: createAuthHeader(),
      })

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["get", "/api/pools/{pool_id}"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["get", "/api/pools"],
        }),
      ])
    },
    [toggleHidden, queryClient, createAuthHeader, poolId]
  )

  const friendsEligibleToAdd = friends.filter(
    f => !members?.find(m => m.member.id === f.id)
  )

  // Recorded payments move money between people; they aren't spending.
  const totalExpenses =
    expenses?.reduce(
      (sum, expense) => sum + (expense.is_payment ? 0 : expense.amount || 0),
      0
    ) || 0

  return {
    members: members || [],
    details,
    expenses: expenses || [],
    balances: balances || [],
    totalExpenses,
    isBalancesLoading,
    isExpensesLoading,
    isExpensesRefetching,
    isMembersLoading,
    isDetailsLoading,
    invalidate,
    friendsEligibleToAdd,
    mutations: {
      addFriend,
      removeFriend,
      modifyDefaultSplit,
      isAddPending,
      isRemovePending,
      isModifyDefaultSplitPending,
      togglePoolHidden,
      isToggleHiddenPending,
      settleUp,
      isSettlePending,
    },
  }
}
