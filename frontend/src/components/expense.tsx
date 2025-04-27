import { useAuth } from "@/hooks/auth";
import { cn } from "./lib/utils";
import { ExpenseCategory, ExpenseIcon } from "@/components/add-expense-modal";
import { apiClient } from "@/api/client";
import { components } from "schema";

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
  const { id } = useAuth();
  const { data, isLoading } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/pools/{pool_id}/members",
    {
      params: {
        path: {
          member_id: id || "",
          pool_id: expense.pool_id,
        },
      },
    },
    {
      enabled: !!id,
    }
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
    <div className="p-4 hover:bg-gray-50 rounded-lg border">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <div className="flex flex-row items-center gap-x-3">
              <div className="p-2.5 border border-black bg-sky-200 rounded-lg">
                <ExpenseIcon category={expense.category as ExpenseCategory} />
              </div>
              <div className="flex flex-col ">
                <span className="font-medium text-gray-900">
                  {expense.name}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(expense.inserted_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
          <span className="text-sm text-gray-600">
            Paid by{" "}
            <span className="font-medium">
              {
                data?.find((m) => m.member.id === expense.paid_by_member_id)
                  ?.member.first_name
              }
            </span>
          </span>
        </div>
        {expense.description && (
          <div className="py-4">{expense.description}</div>
        )}
        <div className="flex justify-between items-center mt-1">
          <span className="text-lg font-semibold text-gray-900">
            {formatCurrency(expense.amount)}
          </span>
          <div className="flex items-center">
            <span className="text-sm text-gray-600">
              {expense.line_amount < 0 ? "You get back" : "You owe"}{" "}
            </span>
            <span
              className={cn(
                "ml-1 font-medium",
                expense.line_amount < 0 ? "text-emerald-600" : "text-red-600"
              )}
            >
              {formatCurrency(expense.line_amount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
