import { useAuth } from "@/hooks/use-auth";
import { cn } from "./lib/utils";
import { ExpenseCategory, ExpenseIcon } from "@/components/add-expense-modal";
import { components } from "schema";
import { usePool } from "@/hooks/use-pool";
import { Button } from "./ui/button";
import { X } from "lucide-react";
import { apiClient } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";

export const formatDate = (date: Date) => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(amount));
};

type Expense = components["schemas"]["RecentExpenseDetails"];

export function Expense({ expense }: { expense: Expense }) {
  const queryClient = useQueryClient();

  const { memberId, createAuthHeader } = useAuth();
  const { members, isMembersLoading, invalidate } = usePool({
    poolId: expense.pool_id,
  });
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
        });
        await queryClient.invalidateQueries({
          queryKey: [
            "get",
            "/api/pools/{pool_id}/members/{member_id}/balances",
          ],
        });

        await invalidate();
      },
    },
  );

  if (!members || isMembersLoading || !memberId) {
    return (
      <div className="flex flex-1 w-full mt-4 px-4 gap-x-4">
        <div className="flex flex-1 flex-col w-full">
          <h2 className="text-2xl font-semibold mb-6">Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border hover:bg-accent/50 transition-colors">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <div className="flex flex-row items-center gap-x-3">
              <div className="p-2.5 border bg-primary/10 text-primary rounded-lg">
                <ExpenseIcon category={expense.category as ExpenseCategory} />
              </div>
              <div className="flex flex-col ">
                <span className="font-medium text-foreground">
                  {expense.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {new Date(expense.inserted_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse items-end gap-x-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
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
                });
              }}
              disabled={isPending}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        {expense.description && (
          <div className="py-4">{expense.description}</div>
        )}
        <div className="flex justify-between items-center mt-1">
          <span className="text-lg font-semibold text-foreground">
            {formatCurrency(expense.amount)}
          </span>
          <div className="flex flex-col justify-end items-end">
            <span className="text-sm text-muted-foreground">
              Paid by{" "}
              <span className="font-medium">
                {
                  members?.find(
                    (m) => m.member.id === expense.paid_by_member_id,
                  )?.member.first_name
                }
              </span>
            </span>
            <div className="flex items-center">
              <span className="text-sm text-muted-foreground">
                {expense.line_amount < 0 ? "You get back" : "You owe"}{" "}
              </span>
              <span
                className={cn(
                  "ml-1 font-medium",
                  expense.line_amount < 0 ? "text-primary" : "text-destructive",
                )}
              >
                {formatCurrency(expense.line_amount)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
