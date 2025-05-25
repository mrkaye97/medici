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
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "./ui/spinner";
import { Expense, formatCurrency, formatDate } from "./expense";
import { apiClient } from "@/api/client";
import { Link } from "@tanstack/react-router";
import { SettleUpModal } from "./settle-up-modal";
import { usePool } from "@/hooks/use-pool";

export function PoolSummary({ poolId }: { poolId: string }) {
  const { memberId, createAuthHeader } = useAuth();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isSettleUpModalOpen, setIsSettleUpModalOpen] = useState(false);

  const { details, isDetailsLoading } = usePool({
    poolId,
  });

  const { expenses, isExpensesLoading } = usePool({ poolId });
  if (isDetailsLoading || !details || isExpensesLoading) {
    return (
      <div className="flex flex-col items-center">
        <Spinner className="mt-8" />
      </div>
    );
  }

  return (
    <>
      <AddExpenseModal
        pool={details}
        isOpen={isAddExpenseModalOpen}
        setIsOpen={setIsAddExpenseModalOpen}
      />
      <SettleUpModal
        poolId={poolId}
        isOpen={isSettleUpModalOpen}
        setIsOpen={setIsSettleUpModalOpen}
      />
      <Card key={poolId} className="overflow-hidden border border-gray-200">
        <Link to="/pools/$poolId" params={{ poolId }}>
          <CardHeader className="bg-gray-50 pb-2 hover:bg-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{details.name}</CardTitle>
                {details.description && (
                  <CardDescription className="mt-1">
                    {details.description}
                  </CardDescription>
                )}
              </div>
              {details.total_debt === 0 ? (
                <Badge
                  className={`ml-2 py-2 bg-white text-black hover:bg-white`}
                >
                  <p className="text-base font-light">All settled up!</p>
                </Badge>
              ) : (
                <Badge
                  className={`ml-2 py-2 ${details.total_debt <= 0 ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"}`}
                >
                  <p className="text-base font-light">
                    {formatCurrency(details.total_debt)}
                  </p>
                </Badge>
              )}
            </div>
          </CardHeader>
        </Link>

        <CardContent className="pt-4">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            <span>Created {formatDate(new Date(details.inserted_at))}</span>
            <span className="mx-2">•</span>
            <span>Updated {formatDate(new Date(details.updated_at))}</span>
          </div>

          {expenses.length > 0 && (
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
              {expenses.map((expense, index) => {
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSettleUpModalOpen(true)}
          >
            Settle Up
          </Button>
          <Button size="sm" onClick={() => setIsAddExpenseModalOpen(true)}>
            Add Expense
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
