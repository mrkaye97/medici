import { useQuery } from "@tanstack/react-query";
import { ListPoolRecentExpensesRow } from "backend/src/db/query_sql";
import { useTRPC } from "trpc/react";

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
  }).format(amount);
};

export function Expense({ expense }: { expense: ListPoolRecentExpensesRow }) {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.listMembersOfPool.queryOptions(expense.poolId),
  );

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
            <span className="text-sm text-gray-600">You owe </span>
            <span className="ml-1 font-medium text-emerald-600">
              {formatCurrency(expense.amountOwed)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
