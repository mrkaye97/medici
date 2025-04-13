import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  ChevronDown,
  ChevronRight,
  Calendar,
  DollarSign,
  ScrollText,
} from "lucide-react";
import { AddExpenseModal } from "./add-expense-modal";
import {
  ListPoolRecentExpensesRow,
  ListPoolsForMemberRow,
} from "../../backend/src/db/query_sql";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../trpc/react";
import { useAuth } from "../hooks/auth";
import { Spinner } from "./ui/spinner";

const formatDate = (date: Date) => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

function Expense({ expense }: { expense: ListPoolRecentExpensesRow }) {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.listMembersOfPool.queryOptions(expense.poolId)
  );

  return (
    <div className="flex flex-col items-start py-2 border-b border-gray-100 last:border-0">
      <div className="flex flex-row justify-between items-center w-full">
        <span>
          {expense.name} on{" "}
          {expense.insertedAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
        <span>
          Paid by{" "}
          {data?.find((m) => m.id === expense.paidByMemberId)?.firstName}
        </span>
      </div>
      <div className="flex flex-row justify-between items-center w-full">
        <span>{formatCurrency(expense.amount)}</span>
        <span>You owe {formatCurrency(expense.amountOwed)}</span>
      </div>
    </div>
  );
}

export function PoolSummary({ pool }: { pool: ListPoolsForMemberRow }) {
  const trpc = useTRPC();
  const { id } = useAuth();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const { data: poolDetails, isLoading: isPoolDetailsLoading } = useQuery(
    trpc.getPoolDetails.queryOptions(
      {
        memberId: id || "",
        poolId: pool.id,
      },
      {
        enabled: !!id && !!pool.id,
      }
    )
  );
  const { data: poolRecentExpenses, isLoading: isPoolRecentExpensesLoading } =
    useQuery(
      trpc.getPoolRecentExpenses.queryOptions(
        {
          memberId: id || "",
          poolId: pool.id,
        },
        {
          enabled: !!id && !!pool.id,
        }
      )
    );

  if (
    isPoolDetailsLoading ||
    !poolDetails ||
    isPoolRecentExpensesLoading ||
    !poolRecentExpenses
  ) {
    return (
      <div className="flex flex-col items-center">
        <Spinner className="mt-8" />
      </div>
    );
  }

  return (
    <>
      <AddExpenseModal
        pool={pool}
        isOpen={isAddExpenseModalOpen}
        setIsOpen={setIsAddExpenseModalOpen}
      />
      <Card key={pool.id} className="overflow-hidden border border-gray-200">
        <CardHeader className="bg-gray-50 pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{pool.name}</CardTitle>
              {pool.description && (
                <CardDescription className="mt-1">
                  {pool.description}
                </CardDescription>
              )}
            </div>
            <Badge
              className={`ml-2 ${poolDetails.totalDebt >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
            >
              <DollarSign className="w-3 h-3 mr-1" />
              {formatCurrency(poolDetails.totalDebt)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            <span>Created {formatDate(pool.insertedAt)}</span>
            <span className="mx-2">•</span>
            <span>Updated {formatDate(pool.updatedAt)}</span>
          </div>

          {poolRecentExpenses.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="flex items-center p-0 h-auto hover:bg-transparent"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 mr-1" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-1" />
              )}
              <span className="flex items-center">
                <ScrollText className="w-4 h-4 mr-1" />
                {poolRecentExpenses?.length} Recent Expenses
              </span>
            </Button>
          )}

          {isExpanded && (
            <div className="mt-3 pl-6 border-l-2 border-gray-200">
              {poolRecentExpenses.map((expense, index) => (
                <Expense key={index} expense={expense} />
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-gray-50 flex justify-end gap-2 py-2">
          <Button variant="outline" size="sm">
            View Details
          </Button>
          <Button size="sm" onClick={() => setIsAddExpenseModalOpen(true)}>
            Add Expense
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
