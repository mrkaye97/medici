import {
  AddExpenseModal,
  categoryToDisplayName,
  expenseCategories,
  ExpenseCategory,
  round,
} from "@/components/add-expense-modal"
import { Expense, formatCurrency } from "@/components/expense"
import { SettleUpModal } from "@/components/settle-up-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuth } from "@/hooks/use-auth"
import { ExpensesListProps, usePool } from "@/hooks/use-pool"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowLeft,
  ArrowUpDown,
  BanknoteIcon,
  CheckCircle,
  Clock,
  DollarSign,
  Home,
  PlusCircleIcon,
  Search,
  UserMinus,
  UserRoundPlus,
  UsersRound,
} from "lucide-react"
import MiniSearch from "minisearch"
import { useEffect, useMemo, useState } from "react"
import { components } from "schema"

export const Route = createFileRoute("/pools/$poolId")({
  component: Pool,
})

function Pool() {
  const { poolId } = Route.useParams()
  const { memberId } = useAuth()

  if (!memberId) {
    return null
  }

  return (
    <div className="bg-background flex flex-col overflow-auto md:h-dvh md:flex-row md:overflow-hidden">
      <ExpensesPane poolId={poolId} />
      <PoolDetailsPaneWrapper memberId={memberId} poolId={poolId} />
    </div>
  )
}

type PoolPaneProps = {
  memberId: string
  poolId: string
}

const PoolDetailsPaneWrapper = ({ memberId, poolId }: PoolPaneProps) => {
  const {
    details,
    isBalancesLoading,
    isDetailsLoading,
    isMembersLoading,
    isExpensesLoading,
  } = usePool({
    poolId,
  })

  const isLoading =
    isMembersLoading ||
    isDetailsLoading ||
    isBalancesLoading ||
    isExpensesLoading ||
    !details

  if (isLoading) {
    return null
  }

  return <PoolDetailsPane memberId={memberId} poolId={poolId} />
}

const PoolDetailsPane = ({ memberId, poolId }: PoolPaneProps) => {
  return (
    <div className="bg-card border-border flex h-full flex-col overflow-auto border-l px-6 py-6 md:w-[400px] 2xl:w-[500px] md:overflow-hidden">
      <div className="mb-6">
        <h2 className="text-foreground flex items-center gap-2 text-xl font-semibold">
          <DollarSign className="text-primary h-6 w-6" />
          Pool Details
        </h2>
        <p className="text-muted-foreground mt-1">
          Balances and member management
        </p>
      </div>

      <div className="space-y-6">
        <PoolBalancesPane poolId={poolId} />
        <Separator />
        <PoolStatistics poolId={poolId} />
        <Separator />
        <PoolMemberManagementPane poolId={poolId} memberId={memberId} />
      </div>
    </div>
  )
}

type TimeRange = {
  since: Date
  until: Date | undefined
}

const ExpensesPane = ({ poolId }: { poolId: string }) => {
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory>()
  const [selectedMemberId, setSelectedMemberId] = useState<string>()
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>({
    since: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    until: new Date(),
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [showSettled, setShowSettled] = useState(false)

  const expenseOptions: ExpensesListProps = useMemo(
    () => ({
      category: selectedCategory,
      isSettled: showSettled,
      paidByMemberId: selectedMemberId,
      since: selectedTimeRange.since,
      until: selectedTimeRange.until,
    }),
    [
      selectedCategory,
      showSettled,
      selectedMemberId,
      selectedTimeRange.since,
      selectedTimeRange.until,
    ]
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
      <div className="flex flex-col overflow-auto px-6 py-6 md:flex-1 md:overflow-hidden">
        <Card className="border-border flex flex-col overflow-auto rounded-lg border shadow-sm md:flex-1 md:overflow-hidden"></Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-auto px-6 py-6 md:flex-1 md:overflow-hidden">
      <AddExpenseModal
        isOpen={isAddExpenseModalOpen}
        setIsOpen={setIsAddExpenseModalOpen}
        pool={details}
      />
      <Card className="border-border flex flex-col overflow-auto rounded-lg border shadow-sm md:flex-1 md:overflow-hidden">
        <CardHeader className="bg-card flex-shrink-0 rounded-t-lg pb-4">
          <div className="mb-6 flex flex-col items-center justify-between gap-y-4 md:flex-row">
            <div className="flex flex-col gap-3">
              <Link
                to="/"
                className="text-muted-foreground hover:text-primary group flex w-fit items-center gap-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                <Home className="h-4 w-4" />
                <span className="text-sm font-medium">Back to Home</span>
              </Link>
              <h1 className="text-foreground text-4xl font-semibold tracking-tight">
                {details.name}
              </h1>
              <div className="text-muted-foreground flex items-center gap-2">
                <UsersRound className="text-primary h-5 w-5" />
                <span className="font-medium">{members.length} members</span>
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
              className="flex items-center gap-2"
              size="lg"
            >
              <PlusCircleIcon className="h-5 w-5" />
              Add Expense
            </Button>
          </div>

          <CardTitle className="text-foreground mb-6 flex flex-row items-center justify-between gap-3 text-2xl font-semibold">
            <div className="flex flex-row items-center gap-2">
              <BanknoteIcon className="text-primary h-6 w-6 flex-shrink-0" />
              <span className="flex items-center">Recent Expenses</span>
              <Badge
                variant="secondary"
                className="bg-secondary text-secondary-foreground px-3 py-1 font-medium"
              >
                {formatCurrency(totalExpenses)} total
              </Badge>
            </div>
            <div className="flex flex-row items-center gap-1 text-sm">
              <Checkbox
                id="toggle"
                className="border-primary border"
                onCheckedChange={isChecked =>
                  setShowSettled(isChecked.valueOf() === true)
                }
              />
              <Label htmlFor="toggle"> Show settled</Label>
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
                  className="bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 h-full pl-10 transition-all duration-200 focus:ring-1"
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
              >
                <SelectTrigger>
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
                  {expenseCategories
                    .sort((a, b) => a.localeCompare(b))
                    .map(category => (
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
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
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
                  {members
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

              <DateRangePicker
                onUpdate={values => {
                  const { from, to } = values.range

                  setSelectedTimeRange({
                    since: from,
                    until: to,
                  })
                }}
                initialDateFrom={selectedTimeRange.since}
                initialDateTo={selectedTimeRange.until}
                align="start"
                locale="en-US"
                showCompare={false}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col overflow-hidden px-4 pb-4">
          {expenses.length === 0 ? (
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
                    <Expense expense={expense} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const PoolStatistics = ({ poolId }: { poolId: string }) => {
  const { members, expenses } = usePool({
    poolId,
  })

  return (
    <div className="space-y-4">
      <h3 className="text-foreground flex items-center gap-2 font-semibold">
        Pool Statistics
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 text-center">
          <p className="text-primary text-3xl font-semibold">
            {expenses.length}
          </p>
          <p className="text-muted-foreground text-sm">Expenses</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-primary text-3xl font-semibold">
            {members.length}
          </p>
          <p className="text-muted-foreground text-sm">Members</p>
        </Card>
      </div>
    </div>
  )
}

const PoolMemberManagementPane = ({ poolId, memberId }: PoolPaneProps) => {
  const { members, details, invalidate, mutations, friendsEligibleToAdd } =
    usePool({
      poolId,
    })

  const [
    maybeModifiedDefaultSplitPercentages,
    setMaybeModifiedDefaultSplitPercentages,
  ] = useState<components["schemas"]["MemberIdSplitPercentage"][]>([])

  useEffect(() => {
    async function maybeUpdate() {
      const isValid =
        maybeModifiedDefaultSplitPercentages.reduce((acc, curr) => {
          return (acc += curr.split_percentage)
        }, 0) === 100

      if (isValid && memberId) {
        await mutations.modifyDefaultSplit(maybeModifiedDefaultSplitPercentages)

        setMaybeModifiedDefaultSplitPercentages([])
      }
    }

    maybeUpdate()
  }, [
    maybeModifiedDefaultSplitPercentages,
    memberId,
    poolId,
    mutations,
    invalidate,
  ])

  if (!details) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-medium">
          <UsersRound className="h-4 w-4" />
          Members
        </h3>
      </div>

      <div className="space-y-2">
        {members.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No members yet
          </p>
        ) : (
          members
            .sort((a, b) =>
              a.member.first_name.localeCompare(b.member.first_name)
            )
            .map(member => (
              <Card key={member.member.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full">
                      <span className="text-xs font-medium">
                        {member.member.first_name[0]}
                        {member.member.last_name[0]}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {member.member.first_name} {member.member.last_name}
                        {member.member.id === memberId && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {member.member.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-48 flex-row items-center justify-end gap-x-2">
                    {details.role === "ADMIN" &&
                      member.member.id !== memberId && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              className="text-destructive hover:text-destructive h-8 w-8 p-0 hover:cursor-pointer"
                              disabled={
                                mutations.isAddPending ||
                                mutations.isRemovePending ||
                                details.total_debt !== 0
                              }
                              onClick={async () => {
                                await mutations.removeFriend(member.member.id)
                              }}
                            >
                              <UserMinus className="h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                {details.total_debt !== 0
                                  ? "You must settle up before removing a member"
                                  : `Remove ${member.member.first_name} from pool`}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    {details.role === "ADMIN" && (
                      <div className="flex flex-col items-start gap-1">
                        <Label htmlFor="email" className="text-xs">
                          Split %
                        </Label>
                        <Input
                          type="number"
                          className="max-w-20"
                          value={
                            maybeModifiedDefaultSplitPercentages.find(
                              m => m.member_id === member.member.id
                            )?.split_percentage ||
                            member.pool_membership.default_split_percentage
                          }
                          onChange={async e => {
                            setMaybeModifiedDefaultSplitPercentages(prev => {
                              const iter = prev.length
                                ? prev
                                : members.map(m => ({
                                    member_id: m.member.id,
                                    split_percentage:
                                      m.pool_membership
                                        .default_split_percentage,
                                  }))

                              return iter.map(f => {
                                if (f.member_id === member.member.id) {
                                  return {
                                    member_id: f.member_id,
                                    split_percentage: parseFloat(
                                      e.target.value
                                    ),
                                  }
                                } else {
                                  return {
                                    member_id: f.member_id,
                                    split_percentage: f.split_percentage,
                                  }
                                }
                              })
                            })
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
        )}
      </div>

      {details.role === "ADMIN" && friendsEligibleToAdd.length > 0 && (
        <>
          <div className="pt-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium">
              Add Friends to Pool
            </h4>
            <div className="space-y-2">
              {friendsEligibleToAdd.map(friend => (
                <Card key={friend.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {friend.first_name} {friend.last_name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {friend.email}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                      disabled={
                        mutations.isAddPending || mutations.isRemovePending
                      }
                      onClick={async () => {
                        await mutations.addFriend(friend.id)
                      }}
                    >
                      <UserRoundPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const PoolBalancesPane = ({ poolId }: { poolId: string }) => {
  const [isSettleUpModalOpen, setIsSettleUpModalOpen] = useState(false)

  const {
    details,
    balances,
    isBalancesLoading,
    isDetailsLoading,
    isMembersLoading,
    isExpensesLoading,
  } = usePool({
    poolId,
  })

  const isLoading =
    isMembersLoading ||
    isExpensesLoading ||
    isDetailsLoading ||
    isBalancesLoading

  if (isLoading || !details) {
    return null
  }

  return (
    <div className="space-y-4">
      <SettleUpModal
        isOpen={isSettleUpModalOpen}
        setIsOpen={isOpen => setIsSettleUpModalOpen(isOpen)}
        poolId={poolId}
      />
      <div className="flex items-center justify-between">
        <h3 className="text-foreground flex items-center gap-2 font-semibold">
          <ArrowUpDown className="text-primary h-5 w-5" />
          Balances
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsSettleUpModalOpen(true)}
        >
          <CheckCircle className="mr-1 h-4 w-4" />
          Settle Up
        </Button>
      </div>

      {balances.length === 0 ? (
        <div className="py-8 text-center">
          <div className="bg-primary/10 mx-auto mb-4 h-16 w-16 rounded-full p-4">
            <Clock className="text-primary mx-auto h-8 w-8" />
          </div>
          <p className="text-muted-foreground text-lg font-medium">
            All settled up!
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Everyone&apos;s even - great teamwork!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {balances.map((balance, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-medium">{balance.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {balance.type === "inbound" ? "Owes you" : "You owe"}
                  </p>
                </div>
                <div className="flex flex-row items-center gap-x-3 text-right">
                  <p
                    className={`text-lg font-semibold ${
                      balance.type === "inbound"
                        ? "text-primary"
                        : "text-destructive"
                    }`}
                  >
                    {formatCurrency(balance.amount)}
                  </p>
                  {balance.venmoHandle && (
                    <a
                      href={`https://venmo.com/?txn=${balance.type === "inbound" ? "request" : "pay"}&recipients=${balance.venmoHandle}&amount=${round(balance.amount)}&note=Settling up our pool on Medici`}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="transition-opacity duration-200 hover:opacity-80"
                    >
                      <img
                        src="https://images.ctfassets.net/gkyt4bl1j2fs/ym6BkLqyGjMBmiCwtM7AW/829bf561ea771c00839b484cb8edeebb/App_Icon.png?w=276&h=276&q=50&fm=webp&bg=transparent"
                        className="size-8 rounded-lg"
                        alt={`${balance.type === "inbound" ? "Request payment from" : "Pay"} ${balance.name} using Venmo`}
                      />
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
