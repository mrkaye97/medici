import { Expense } from "@/components/expense"
import {
  categoryToDisplayName,
  expenseCategories,
  ExpenseCategory,
} from "@/components/expense-categories"
import { AddExpenseModal } from "@/components/expense-modals"
import { formatCurrency } from "@/components/lib/format"
import { cn } from "@/components/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ExpensesListProps, usePool } from "@/hooks/use-pool"
import { Link } from "@tanstack/react-router"
import {
  ArrowLeft,
  BanknoteIcon,
  DollarSign,
  Home,
  PlusCircleIcon,
  Search,
  UsersRound,
} from "lucide-react"
import MiniSearch from "minisearch"
import { useMemo, useState } from "react"

function ExpensesPaneLayout({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-auto px-0 md:flex-1 md:overflow-hidden md:px-6 md:py-6",
        className
      )}
    >
      <Card className="md:border-border flex flex-col overflow-auto border-none rounded-none md:rounded-lg md:border md:shadow-sm md:flex-1 md:overflow-hidden">
        {children}
      </Card>
    </div>
  )
}

export const ExpensesPane = ({
  poolId,
  selectedCategory,
  setSelectedCategory,
  className,
}: {
  className?: string
  poolId: string
  selectedCategory: ExpenseCategory | undefined
  setSelectedCategory: (category: ExpenseCategory | undefined) => void
}) => {
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string>()
  const [searchQuery, setSearchQuery] = useState("")
  const [showSettled, setShowSettled] = useState(false)

  const expenseOptions: ExpensesListProps = useMemo(
    () => ({
      category: selectedCategory,
      isSettled: showSettled,
      paidByMemberId: selectedMemberId,
    }),
    [selectedCategory, showSettled, selectedMemberId]
  )

  const {
    members,
    expenses,
    details,
    isBalancesLoading,
    isDetailsLoading,
    isMembersLoading,
    isExpensesLoading,
    isExpensesRefetching,
    totalExpenses,
  } = usePool({
    poolId,
    expenseOptions,
  })

  const miniSearch = useMemo(() => {
    const m = new MiniSearch({
      fields: ["id", "name", "description", "notes"],
      storeFields: ["id", "name", "description", "notes"],
    })

    m.addAllAsync(
      expenses.map(expense => ({
        id: expense.id,
        name: expense.name,
        description: expense.description || "",
        notes: expense.notes || "",
      }))
    )

    return m
  }, [expenses])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return expenses
    }

    const results = miniSearch.search(searchQuery, {
      fuzzy: 0.2,
      prefix: true,
      boost: { name: 2, description: 1, notes: 1 },
    })

    return results
      .map(result => expenses.find(e => e.id === result.id))
      .filter(e => e !== undefined)
  }, [searchQuery, expenses, miniSearch])

  const isLoading =
    isMembersLoading ||
    (isExpensesLoading && !isExpensesRefetching) ||
    isDetailsLoading

  if (isLoading || isMembersLoading || !details || isBalancesLoading) {
    return (
      <ExpensesPaneLayout className={className}>
        <div className="space-y-4 p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10 w-full" />
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-[104px] w-full rounded-lg" />
          ))}
        </div>
      </ExpensesPaneLayout>
    )
  }

  // Recorded payments aren't expenses, so they don't count here.
  const expenseCount = expenses.filter(e => !e.is_payment).length

  return (
    <ExpensesPaneLayout className={className}>
      {isAddExpenseModalOpen && (
        <AddExpenseModal
          isOpen={isAddExpenseModalOpen}
          setIsOpen={setIsAddExpenseModalOpen}
          pool={details}
        />
      )}
      <CardHeader className="bg-card flex-shrink-0 md:rounded-t-lg pb-4">
        <div className="mb-6 flex w-full flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
          <div className="flex flex-col gap-3 w-full">
            <Link
              to="/"
              className="text-muted-foreground hover:text-primary group flex w-fit items-center gap-2 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <Home className="h-4 w-4" />
              <span className="text-sm font-medium">All pools</span>
            </Link>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight break-words md:text-4xl">
              {details.name}
            </h1>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
              <UsersRound className="text-primary h-5 w-5" />
              <span className="text-sm md:text-base font-medium">
                {members.length} {members.length === 1 ? "member" : "members"}
              </span>
              <DollarSign className="text-primary h-5 w-5 ml-2" />
              <span className="text-sm md:text-base font-medium">
                {expenseCount} {expenseCount === 1 ? "expense" : "expenses"}
              </span>
              {details.role === "ADMIN" && (
                <Badge
                  variant="outline"
                  className="bg-primary/10 border-primary text-primary ml-2"
                >
                  Admin
                </Badge>
              )}
            </div>
          </div>
          <Button
            onClick={() => setIsAddExpenseModalOpen(true)}
            className="flex w-full items-center gap-2 md:w-auto"
            size="lg"
          >
            <PlusCircleIcon className="h-5 w-5" />
            Add Expense
          </Button>
        </div>

        <CardTitle className="text-foreground mb-6 flex flex-row flex-wrap items-center justify-between gap-3 text-xl font-semibold md:text-2xl">
          <div className="flex flex-row flex-wrap items-center gap-2">
            <BanknoteIcon className="text-primary h-6 w-6 flex-shrink-0" />
            <span className="flex items-center">Expenses</span>
            <Badge
              variant="secondary"
              className="bg-secondary text-secondary-foreground px-3 py-1 font-medium"
            >
              {formatCurrency(totalExpenses)} total
            </Badge>
          </div>
          <div className="flex flex-row items-center gap-1 text-sm">
            <Checkbox
              id="show-settled"
              className="border-primary border"
              onCheckedChange={isChecked =>
                setShowSettled(isChecked.valueOf() === true)
              }
            />
            <Label htmlFor="show-settled">Show settled</Label>
          </div>
        </CardTitle>

        <div className="space-y-4">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="text-muted-foreground h-4 w-4" />
              </div>
              <Input
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                }}
                className="bg-background/50 border border-primary/40 focus:border-primary/50 focus:ring-primary/20 h-full pl-10 transition-all duration-200 focus:ring-1"
              />
            </div>

            <Select
              onValueChange={value => {
                if (value === "all") {
                  setSelectedCategory(undefined)
                  return
                }
                setSelectedCategory(value as ExpenseCategory)
              }}
              defaultValue="all"
              value={selectedCategory ?? "all"}
            >
              <SelectTrigger className="md:min-w-[250px] md:max-w-[300px] w-full md:w-auto">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border/50">
                <SelectItem
                  key="all"
                  value="all"
                  className="focus:bg-primary/10"
                >
                  <div className="flex items-center gap-2">
                    {selectedCategory === undefined && (
                      <div className="from-primary to-primary/60 h-2 w-2 rounded-full bg-gradient-to-r"></div>
                    )}
                    <span className="font-medium">All Categories</span>
                  </div>
                </SelectItem>
                {expenseCategories.map(category => (
                  <SelectItem
                    key={category}
                    value={category}
                    className="focus:bg-primary/10 capitalize"
                  >
                    {selectedCategory === category && (
                      <div className="from-primary to-primary/60 h-2 w-2 rounded-full bg-gradient-to-r"></div>
                    )}

                    <span>{categoryToDisplayName({ category })}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              onValueChange={value => {
                if (value === "all") {
                  setSelectedMemberId(undefined)
                  return
                }
                setSelectedMemberId(value)
              }}
              defaultValue="all"
            >
              <SelectTrigger className="md:min-w-[250px] md:max-w-[300px] w-full md:w-auto">
                <SelectValue placeholder="Select payer" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border/50">
                <SelectItem
                  key="all"
                  value="all"
                  className="focus:bg-primary/10"
                >
                  <div className="flex items-center gap-2">
                    {selectedMemberId === undefined && (
                      <div className="from-primary to-primary/60 h-2 w-2 rounded-full bg-gradient-to-r"></div>
                    )}
                    <span className="font-medium">All Payers</span>
                  </div>
                </SelectItem>
                {[...members]
                  .sort((a, b) =>
                    a.member.first_name.localeCompare(b.member.first_name)
                  )
                  .map(member => (
                    <SelectItem
                      key={member.member.id}
                      value={member.member.id}
                      className="focus:bg-primary/10 capitalize"
                    >
                      {selectedMemberId === member.member.id && (
                        <div className="from-primary to-primary/60 h-2 w-2 rounded-full bg-gradient-to-r"></div>
                      )}

                      <span>{member.member.first_name}</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-hidden px-4 pb-4">
        {expenses.length > 0 && searchResults.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            No expenses match “{searchQuery}”
          </p>
        ) : expenses.length === 0 ? (
          <div className="px-4 py-20 text-center">
            <div className="bg-primary/10 mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full">
              <BanknoteIcon className="text-primary h-12 w-12" />
            </div>
            <h3 className="text-muted-foreground mb-4 text-2xl font-semibold">
              No expenses yet!
            </h3>
            <p className="text-muted-foreground mx-auto mb-6 max-w-sm">
              Start tracking your shared expenses by adding your first one.
            </p>
            <Button onClick={() => setIsAddExpenseModalOpen(true)} size="lg">
              <PlusCircleIcon className="mr-2 h-5 w-5" />
              Add First Expense
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="space-y-2">
              {searchResults.map(expense => (
                <div key={expense.id} className="px-2 transition-colors">
                  <Expense
                    expense={expense}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </ExpensesPaneLayout>
  )
}
