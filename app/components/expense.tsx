import { useQuery } from "@tanstack/react-query";
import { useAuth } from "app/hooks/auth";
import { ListPoolRecentExpensesRow } from "backend/src/db/query_sql";
import { useTRPC } from "trpc/react";
import { cn } from "./lib/utils";

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

export function Expense({ expense }: { expense: ListPoolRecentExpensesRow }) {
  const trpc = useTRPC();
  const { id } = useAuth();
  const { data, isLoading } = useQuery(
    trpc.listMembersOfPool.queryOptions(
      {
        poolId: expense.poolId,
        memberId: id || "",
      },
      {
        enabled: !!id,
      },
    ),
  );

  if (!data || isLoading || !id) {
    return (
      <div className="flex flex-1 w-full mt-4 px-4 gap-x-4">
        <div className="flex flex-1 flex-col w-full">
          <h2 className="text-2xl font-semibold mb-6">Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">{expense.name}</span>
            <span className="text-sm text-gray-500">
              {expense.insertedAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <span className="text-sm text-gray-600">
            Paid by{" "}
            <span className="font-medium">
              {data?.find((m) => m.id === expense.paidByMemberId)?.firstName}
            </span>
          </span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-lg font-semibold text-gray-900">
            {formatCurrency(expense.amount)}
          </span>
          <div className="flex items-center">
            <span className="text-sm text-gray-600">
              {expense.amountOwed < 0 ? "You are owed" : "You owe"}{" "}
            </span>
            <span
              className={cn(
                "ml-1 font-medium",
                expense.amountOwed < 0 ? "text-emerald-600" : "text-red-600",
              )}
            >
              {formatCurrency(expense.amountOwed)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
