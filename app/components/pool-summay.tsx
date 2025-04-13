import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Calendar,
  DollarSign,
  ScrollText,
} from "lucide-react";
import { ListPoolsForMemberRow } from "~/server/src/db/query_sql";

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

export function PoolSummary({ pool }: { pool: ListPoolsForMemberRow }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
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
            className={`ml-2 ${pool.totalDebt >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            <DollarSign className="w-3 h-3 mr-1" />
            {formatCurrency(pool.totalDebt)}
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
            {pool.recentExpenses?.length} Recent Expenses
          </span>
        </Button>

        {isExpanded && (
          <div className="mt-3 pl-6 border-l-2 border-gray-200">
            {pool.recentExpenses?.map((expense, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
              >
                <span className="font-medium">{formatCurrency(expense)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-gray-50 flex justify-end gap-2 py-2">
        <Button variant="outline" size="sm">
          View Details
        </Button>
        <Button size="sm">Add Expense</Button>
      </CardFooter>
    </Card>
  );
}
