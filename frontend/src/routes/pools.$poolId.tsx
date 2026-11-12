import { ExpenseCategory } from "@/components/expense-categories"
import { useDocumentTitle } from "@/components/lib/use-document-title"
import { cn } from "@/components/lib/utils"
import { BalancesPane } from "@/components/pool/balances-pane"
import { ExpensesPane } from "@/components/pool/expenses-pane"
import { MembersPane } from "@/components/pool/members-pane"
import { SpendChart } from "@/components/pool/spend-chart"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { usePool } from "@/hooks/use-pool"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

export const Route = createFileRoute("/pools/$poolId")({
  component: Pool,
})

type MobileView = "expenses" | "details"

function Pool() {
  const { poolId } = Route.useParams()
  const { memberId } = useAuth()
  const { details, balances } = usePool({ poolId })
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory>()
  // Phones show one pane at a time; from `md` up both are side by side.
  const [mobileView, setMobileView] = useState<MobileView>("expenses")

  useDocumentTitle(details?.name)

  if (!memberId) {
    return null
  }

  return (
    <div className="bg-background flex flex-col overflow-auto md:h-dvh md:flex-row md:overflow-hidden">
      <div className="bg-card sticky top-0 z-10 border-b p-3 md:hidden">
        <Tabs
          value={mobileView}
          onValueChange={value => setMobileView(value as MobileView)}
        >
          <TabsList className="grid h-10 w-full grid-cols-2">
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="details">
              Balances
              {balances.length > 0 && (
                <span className="bg-primary text-primary-foreground ml-1.5 rounded-full px-1.5 text-xs">
                  {balances.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ExpensesPane
        className={cn(mobileView !== "expenses" && "hidden md:flex")}
        poolId={poolId}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
      />
      <PoolDetailsPane
        className={cn(mobileView !== "details" && "hidden md:flex")}
        memberId={memberId}
        poolId={poolId}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
      />
    </div>
  )
}

const PoolDetailsPane = ({
  className,
  memberId,
  poolId,
  selectedCategory,
  setSelectedCategory,
}: {
  className?: string
  memberId: string
  poolId: string
  selectedCategory: ExpenseCategory | undefined
  setSelectedCategory: (category: ExpenseCategory | undefined) => void
}) => {
  const {
    details,
    isBalancesLoading,
    isDetailsLoading,
    isMembersLoading,
    isExpensesLoading,
  } = usePool({ poolId })

  const isLoading =
    isMembersLoading ||
    isDetailsLoading ||
    isBalancesLoading ||
    isExpensesLoading ||
    !details

  return (
    <div
      className={cn(
        "bg-card md:border-border flex w-full flex-col overflow-auto p-4 md:h-dvh md:overflow-hidden md:border-l md:p-6 lg:w-[400px] xl:w-[550px] 2xl:w-[620px]",
        className
      )}
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="mt-6 h-48 w-full rounded-lg" />
        </div>
      ) : (
        <div className="scrollbar-none h-full space-y-6 overflow-auto">
          <BalancesPane poolId={poolId} />
          <Separator />
          <SpendChart
            poolId={poolId}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
          />
          <Separator />
          <MembersPane poolId={poolId} memberId={memberId} />
        </div>
      )}
    </div>
  )
}
