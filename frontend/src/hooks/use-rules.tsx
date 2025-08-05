import { apiClient } from "@/api/client"
import { ExpenseCategory } from "@/components/expense-modals"
import { useAuth } from "@/hooks/use-auth"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

export const useRules = ({
  setIsCreating,
}: {
  setIsCreating: (isCreating: boolean) => void
}) => {
  const queryClient = useQueryClient()
  const { memberId, createAuthHeader } = useAuth()

  const {
    data: rules = [],
    isLoading,
    isError,
  } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/rules",
    {
      params: {
        path: { member_id: memberId || "" },
      },
      headers: createAuthHeader(),
    },
    {
      enabled: !!memberId,
    }
  )

  const { mutateAsync: createRuleMutation, isPending: isCreatingRule } =
    apiClient.useMutation("post", "/api/members/{member_id}/rules", {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["get", "/api/members/{member_id}/rules"],
        })
        setIsCreating(false)
      },
    })

  const { mutateAsync: deleteRuleMutation, isPending: isDeletingRule } =
    apiClient.useMutation("delete", "/api/members/{member_id}/rules", {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["get", "/api/members/{member_id}/rules"],
        })
      },
    })

  const createRule = useCallback(
    async (rule: string, category: ExpenseCategory) => {
      if (!memberId) {
        return
      }

      return createRuleMutation({
        params: { path: { member_id: memberId } },
        body: {
          rule: rule,
          category: category,
        },
        headers: createAuthHeader(),
      })
    },
    [createRuleMutation, memberId, createAuthHeader]
  )

  const deleteRule = useCallback(
    async (rule: string, category: ExpenseCategory) => {
      if (!memberId) return

      return deleteRuleMutation({
        params: {
          path: { member_id: memberId },
          query: {
            rule: rule,
            category: category,
          },
        },
        headers: createAuthHeader(),
      })
    },
    [deleteRuleMutation, memberId, createAuthHeader]
  )

  return {
    rules,
    isLoading,
    isError,
    createRule,
    isCreatingRule,
    deleteRule,
    isDeletingRule,
  }
}
