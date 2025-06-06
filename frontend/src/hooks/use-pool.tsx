import { apiClient } from "@/api/client";
import { useAuth } from "./use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useFriends } from "./use-friends";
import { useCallback, useMemo } from "react";
import { components } from "schema";
import { ExpenseCategory } from "@/components/add-expense-modal";

export type ExpensesListProps = {
  limit?: number;
  category?: ExpenseCategory;
  isSettled?: boolean;
};

export const usePool = ({
  poolId,
  expenseOptions,
}: {
  poolId: string;
  expenseOptions?: ExpensesListProps;
}) => {
  const { memberId, createAuthHeader } = useAuth();
  const queryClient = useQueryClient();

  const { friends } = useFriends();

  const { data: members, isLoading: isMembersLoading } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/pools/{pool_id}/members",
    {
      params: {
        path: {
          member_id: memberId || "",
          pool_id: poolId,
        },
      },
      headers: createAuthHeader(),
    },
  );

  const { data: details, isLoading: isDetailsLoading } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/pools/{pool_id}",
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
    },
  );

  const {
    data: expenses,
    isLoading: isExpensesLoading,
    isRefetching: isExpensesRefetching,
  } = apiClient.useQuery(
    "get",
    "/api/pools/{pool_id}/members/{member_id}/expenses",
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
        },
      },
      headers: createAuthHeader(),
    },
    {
      placeholderData: (prev) => prev,
    },
  );

  const { data: rawBalances, isLoading: isBalancesLoading } =
    apiClient.useQuery(
      "get",
      "/api/pools/{pool_id}/members/{member_id}/balances",
      {
        params: {
          path: {
            member_id: memberId || "",
            pool_id: poolId,
          },
        },
        headers: createAuthHeader(),
      },
    );

  const balances = useMemo(() => {
    return (rawBalances || [])
      .map((b) => {
        const otherMember = friends.find((m) => m.id === b.member_id);

        if (!otherMember) {
          return null;
        }

        const name = otherMember.first_name + " " + otherMember.last_name;

        return {
          name,
          amount: b.amount,
          type: b.direction,
          venmoHandle: otherMember.venmo_handle,
        };
      })
      .filter((b) => b !== null);
  }, [rawBalances, friends]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["get", "/api/members/{member_id}/pools/{pool_id}/members"],
    });
  }, [queryClient]);

  const { mutateAsync: addFriendToPool, isPending: isAddPending } =
    apiClient.useMutation("post", "/api/pools/{pool_id}/members");

  const { mutateAsync: removeFriendFromPool, isPending: isRemovePending } =
    apiClient.useMutation("delete", "/api/pools/{pool_id}/members/{member_id}");

  const {
    mutateAsync: modifyDefaultSplitMutation,
    isPending: isModifyDefaultSplitPending,
  } = apiClient.useMutation(
    "patch",
    "/api/members/{member_id}/pools/{pool_id}/default-splits",
  );

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
      });

      await invalidate();
    },
    [addFriendToPool, createAuthHeader, poolId, invalidate],
  );

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
      });

      await invalidate();
    },
    [poolId, createAuthHeader, invalidate, removeFriendFromPool],
  );

  const modifyDefaultSplit = useCallback(
    async (percentages: components["schemas"]["MemberIdSplitPercentage"][]) => {
      if (!memberId) {
        return;
      }

      await modifyDefaultSplitMutation({
        params: {
          path: {
            pool_id: poolId,
            member_id: memberId,
          },
        },
        body: {
          default_split_percentages: percentages,
        },
        headers: createAuthHeader(),
      });

      await invalidate();
    },
    [
      createAuthHeader,
      invalidate,
      memberId,
      modifyDefaultSplitMutation,
      poolId,
    ],
  );

  const friendsEligibleToAdd = friends.filter(
    (f) => !members?.find((m) => m.member.id === f.id),
  );

  const totalExpenses =
    expenses?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0;

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
    },
  };
};
