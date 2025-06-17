import { usePool } from "@/hooks/use-pool"
import { Link } from "@tanstack/react-router"
import { Calendar, ChevronDown, ChevronRight, ScrollText } from "lucide-react"
import { useState } from "react"
import { Expense, formatCurrency, formatDate } from "./expense"
import { AddExpenseModal } from "./expense-modals"
import { SettleUpModal } from "./settle-up-modal"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card"

export function PoolSummary({ poolId }: { poolId: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false)
  const [isSettleUpModalOpen, setIsSettleUpModalOpen] = useState(false)

  const { details, isDetailsLoading } = usePool({
    poolId,
  })

  const { expenses, isExpensesLoading } = usePool({
    poolId,
    expenseOptions: { limit: 5 },
  })
  if (isDetailsLoading || !details || isExpensesLoading) {
    return null
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
      <Card key={poolId} className="overflow-hidden border">
        <Link to="/pools/$poolId" params={{ poolId }}>
          <CardHeader className="bg-muted/30 hover:bg-muted/50 pb-2 transition-colors">
            <div className="flex items-start justify-between">
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
                  className={`bg-muted text-muted-foreground hover:bg-muted/80 ml-2 py-2`}
                >
                  <p className="text-base font-light">All settled up!</p>
                </Badge>
              ) : (
                <Badge
                  className={`ml-2 py-2 ${details.total_debt <= 0 ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}
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
          <div className="text-muted-foreground mb-2 flex items-center text-sm">
            <Calendar className="mr-1 h-4 w-4" />
            <span>Created {formatDate(new Date(details.inserted_at))}</span>
            <span className="mx-2">•</span>
            <span>Updated {formatDate(new Date(details.updated_at))}</span>
          </div>

          {expenses.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(prev => !prev)}
              className="flex h-auto items-center p-2 hover:bg-transparent"
            >
              {isExpanded ? (
                <ChevronDown className="mr-1 h-4 w-4" />
              ) : (
                <ChevronRight className="mr-1 h-4 w-4" />
              )}
              <span className="flex items-center">
                <ScrollText className="mr-1 h-4 w-4" />
                Recent Expenses
              </span>
            </Button>
          )}

          {isExpanded && (
            <div className="mt-3 flex max-h-96 flex-col gap-y-2 overflow-y-auto rounded-md px-4">
              {expenses.map((expense, index) => {
                return <Expense key={index} expense={expense} />
              })}
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-muted/30 flex justify-end gap-2 py-2">
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
  )
}
