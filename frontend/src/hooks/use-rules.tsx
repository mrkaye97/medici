import { apiClient } from "@/api/client"
import { ExpenseCategory } from "@/components/expense-modals"
import { useAuth } from "@/hooks/use-auth"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

function isValidRegex(pattern: string) {
  try {
    new RegExp(pattern, "i")
    return true
  } catch {
    return false
  }
}

export const useRules = ({
  setIsCreating,
}: {
  setIsCreating?: (isCreating: boolean) => void
} = {}) => {
  const queryClient = useQueryClient()
  const { memberId, createAuthHeader } = useAuth()

  const {
    data: rules = [],
    isLoading,
    isError,
  } = apiClient.useQuery(
    "get",
    "/api/rules",
    {
      headers: createAuthHeader(),
    },
    {
      enabled: !!memberId,
    }
  )

  const { mutateAsync: createRuleMutation, isPending: isCreatingRule } =
    apiClient.useMutation("post", "/api/rules", {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["get", "/api/rules"],
        })

        if (setIsCreating) {
          setIsCreating(false)
        }
      },
    })

  const { mutateAsync: deleteRuleMutation, isPending: isDeletingRule } =
    apiClient.useMutation("delete", "/api/rules", {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["get", "/api/rules"],
        })
      },
    })

  const createRule = useCallback(
    async (rule: string, category: ExpenseCategory) => {
      if (!memberId) {
        return
      }

      if (!isValidRegex(rule)) {
        throw new Error("Invalid regex pattern")
      }

      return createRuleMutation({
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

  const autoCategorizeName = useCallback(
    (expenseName: string): ExpenseCategory | null => {
      if (rules.length === 0 || !expenseName.trim()) {
        return null
      }

      for (const rule of rules) {
        if (!isValidRegex(rule.rule)) {
          continue
        }

        const regex = new RegExp(rule.rule, "i")
        if (regex.test(expenseName)) {
          return rule.category
        }
      }

      return null
    },
    [rules]
  )

  return {
    rules,
    isLoading,
    isError,
    createRule,
    isCreatingRule,
    deleteRule,
    isDeletingRule,
    autoCategorizeName,
  }
}
