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
import { ChevronDown, ChevronRight, Calendar, ScrollText } from "lucide-react";
import { AddExpenseModal } from "./add-expense-modal";
import { useAuth } from "@/hooks/auth";
import { Spinner } from "./ui/spinner";
import { Expense, formatCurrency, formatDate } from "./expense";
import { Separator } from "./ui/separator";
import { apiClient } from "@/api/client";
import { Link } from "@tanstack/react-router";

export function PoolSummary({ poolId }: { poolId: string }) {
  const { memberId, createAuthHeader } = useAuth();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);

  const { data: poolDetails, isLoading: isPoolDetailsLoading } =
    apiClient.useQuery(
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
      }
    );

  const { data: poolRecentExpenses, isLoading: isPoolRecentExpensesLoading } =
    apiClient.useQuery(
      "get",
      "/api/pools/{pool_id}/members/{member_id}/expenses",
      {
        params: {
          query: {
            limit: 5,
          },
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
        pool={poolDetails}
        isOpen={isAddExpenseModalOpen}
        setIsOpen={setIsAddExpenseModalOpen}
      />
      <Card key={poolId} className="overflow-hidden border border-gray-200">
        <CardHeader className="bg-gray-50 pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{poolDetails.name}</CardTitle>
              {poolDetails.description && (
                <CardDescription className="mt-1">
                  {poolDetails.description}
                </CardDescription>
              )}
            </div>
            {poolDetails.total_debt === 0 ? (
              <Badge className={`ml-2 py-2 bg-white text-black hover:bg-white`}>
                <p className="text-base font-light">All settled up!</p>
              </Badge>
            ) : (
              <Badge
                className={`ml-2 py-2 ${poolDetails.total_debt <= 0 ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"}`}
              >
                <p className="text-base font-light">
                  {formatCurrency(poolDetails.total_debt)}
                </p>
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            <span>Created {formatDate(new Date(poolDetails.inserted_at))}</span>
            <span className="mx-2">•</span>
            <span>Updated {formatDate(new Date(poolDetails.updated_at))}</span>
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
                Recent Expenses
              </span>
            </Button>
          )}

          {isExpanded && (
            <div className="mt-3 px-4 rounded-md gap-y-2 flex flex-col">
              {poolRecentExpenses.map((expense, index) => {
                return (
                  <>
                    <Expense key={index} expense={expense} />
                  </>
                );
              })}
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-gray-50 flex justify-end gap-2 py-2">
          <Link to="/pools/$poolId" params={{ poolId }}>
            {" "}
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </Link>
          <Button size="sm" onClick={() => setIsAddExpenseModalOpen(true)}>
            Add Expense
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
