import { useAuth } from "@/hooks/use-auth";
import {
  AddExpenseModal,
  categoryToDisplayName,
  expenseCategories,
  ExpenseCategory,
  round,
} from "@/components/add-expense-modal";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BanknoteIcon,
  PlusCircleIcon,
  UserRoundPlus,
  UsersRound,
  UserMinus,
  DollarSign,
  ArrowUpDown,
  CheckCircle,
  Clock,
  Search,
  ArrowLeft,
  Home,
} from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Expense, formatCurrency } from "@/components/expense";
import { SettleUpModal } from "@/components/settle-up-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { components } from "schema";
import { ExpensesListProps, usePool } from "@/hooks/use-pool";
import MiniSearch from "minisearch";
import { DateRangePicker } from "@/components/ui/date-range-picker";

export const Route = createFileRoute("/pools/$poolId")({
  component: Pool,
});

function Pool() {
  const { poolId } = Route.useParams();
  const { memberId } = useAuth();

  if (!memberId) {
    return null;
  }

  return (
    <div className="flex flex-col md:flex-row overflow-auto md:overflow-hidden md:h-dvh bg-background">
      <ExpensesPane poolId={poolId} />
      <PoolDetailsPaneWrapper memberId={memberId} poolId={poolId} />
    </div>
  );
}

type PoolPaneProps = {
  memberId: string;
  poolId: string;
};

const PoolDetailsPaneWrapper = ({ memberId, poolId }: PoolPaneProps) => {
  const { details, isBalancesLoading, isDetailsLoading, isMembersLoading } =
    usePool({
      poolId,
    });

  const isLoading =
    isMembersLoading || isDetailsLoading || isBalancesLoading || !details;

  if (isLoading) {
    return null;
  }

  return <PoolDetailsPane memberId={memberId} poolId={poolId} />;
};

const PoolDetailsPane = ({ memberId, poolId }: PoolPaneProps) => {
  return (
    <div className="md:w-[500px] bg-card flex flex-col h-full overflow-auto md:overflow-hidden py-6 px-6 border-l border-border">
      <div className="mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
          <DollarSign className="h-6 w-6 text-primary" />
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
  );
};

type TimeRange = {
  since: Date;
  until: Date | undefined;
};

const ExpensesPane = ({ poolId }: { poolId: string }) => {
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory>();
  const [selectedMemberId, setSelectedMemberId] = useState<string>();
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>({
    since: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    until: new Date(),
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettled, setShowSettled] = useState(false);

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
    ],
  );

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
  });

  const miniSearch = useMemo(() => {
    const m = new MiniSearch({
      fields: ["id", "name", "description", "notes"],
      storeFields: ["id", "name", "description", "notes"],
    });

    m.addAllAsync(
      expenses.map((expense) => ({
        id: expense.id,
        name: expense.name,
        description: expense.description || "",
        notes: expense.notes || "",
      })),
    );

    return m;
  }, [expenses]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return expenses;
    }

    const results = miniSearch.search(searchQuery, {
      fuzzy: 0.2,
      prefix: true,
      boost: { name: 2, description: 1, notes: 1 },
    });

    return results
      .map((result) => expenses.find((e) => e.id === result.id))
      .filter((e) => e !== undefined);
  }, [searchQuery, expenses, miniSearch]);

  const isLoading =
    isMembersLoading ||
    (isExpensesLoading && !isExpensesRefetching) ||
    isDetailsLoading;

  if (isLoading || isMembersLoading || !details || isBalancesLoading) {
    return null;
  }

  return (
    <div className="md:flex-1 overflow-auto md:overflow-hidden flex flex-col py-6 px-6">
      <AddExpenseModal
        isOpen={isAddExpenseModalOpen}
        setIsOpen={setIsAddExpenseModalOpen}
        pool={details}
      />
      <Card className="md:flex-1 overflow-auto md:overflow-hidden flex flex-col shadow-sm border border-border rounded-lg">
        <CardHeader className="pb-4 flex-shrink-0 bg-card rounded-t-lg">
          <div className="flex md:flex-row flex-col justify-between items-center mb-6 gap-y-4">
            <div className="flex flex-col gap-3">
              <Link
                to="/"
                className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group w-fit"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                <Home className="h-4 w-4" />
                <span className="text-sm font-medium">Back to Home</span>
              </Link>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                {details.name}
              </h1>
              <div className="text-muted-foreground flex items-center gap-2">
                <UsersRound className="h-5 w-5 text-primary" />
                <span className="font-medium">{members.length} members</span>
                {details.role === "ADMIN" && (
                  <Badge
                    variant="outline"
                    className="ml-2 bg-primary/10 border-primary text-primary"
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

          <CardTitle className="text-2xl font-semibold flex flex-row items-center justify-between gap-3 text-foreground mb-6">
            <div className="flex flex-row items-center gap-2">
              <BanknoteIcon className="h-6 w-6 text-primary flex-shrink-0" />
              <span className="flex items-center">Recent Expenses</span>
              <Badge
                variant="secondary"
                className="bg-secondary text-secondary-foreground px-3 py-1 font-medium"
              >
                {formatCurrency(totalExpenses)} total
              </Badge>
            </div>
            <div className="flex flex-row gap-1 text-sm items-center">
              <Checkbox
                id="toggle"
                className="border border-primary"
                onCheckedChange={(isChecked) =>
                  setShowSettled(isChecked.valueOf() === true)
                }
              />
              <Label htmlFor="toggle"> Show settled</Label>
            </div>
          </CardTitle>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  placeholder="Search expenses..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                  className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all duration-200 h-full"
                />
              </div>

              <Select
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedCategory(undefined);
                    return;
                  }
                  setSelectedCategory(value as ExpenseCategory);
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
                        <div className="h-2 w-2 rounded-full bg-gradient-to-r from-primary to-primary/60"></div>
                      )}
                      <span className="font-medium">All Categories</span>
                    </div>
                  </SelectItem>
                  {expenseCategories
                    .sort((a, b) => a.localeCompare(b))
                    .map((category) => (
                      <SelectItem
                        key={category}
                        value={category}
                        className="capitalize focus:bg-primary/10"
                      >
                        {selectedCategory === category && (
                          <div className="h-2 w-2 rounded-full bg-gradient-to-r from-primary to-primary/60"></div>
                        )}

                        <span>{categoryToDisplayName({ category })}</span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedMemberId(undefined);
                    return;
                  }
                  setSelectedMemberId(value);
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
                        <div className="h-2 w-2 rounded-full bg-gradient-to-r from-primary to-primary/60"></div>
                      )}
                      <span className="font-medium">All Payers</span>
                    </div>
                  </SelectItem>
                  {members
                    .sort((a, b) =>
                      a.member.first_name.localeCompare(b.member.first_name),
                    )
                    .map((member) => (
                      <SelectItem
                        key={member.member.id}
                        value={member.member.id}
                        className="capitalize focus:bg-primary/10"
                      >
                        {selectedMemberId === member.member.id && (
                          <div className="h-2 w-2 rounded-full bg-gradient-to-r from-primary to-primary/60"></div>
                        )}

                        <span>{member.member.first_name}</span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <DateRangePicker
                onUpdate={(values) => {
                  const { from, to } = values.range;

                  setSelectedTimeRange({
                    since: from,
                    until: to,
                  });
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
        <CardContent className="px-4 pb-4 flex-1 overflow-hidden flex flex-col">
          {expenses.length === 0 ? (
            <div className="text-center py-20 px-4">
              <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-8">
                <BanknoteIcon className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold text-muted-foreground mb-4">
                No expenses yet!
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Start tracking your shared expenses by adding your first one.
              </p>
              <Button onClick={() => setIsAddExpenseModalOpen(true)} size="lg">
                <PlusCircleIcon className="h-5 w-5 mr-2" />
                Add First Expense
              </Button>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <div className="space-y-2">
                {searchResults.map((expense) => (
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
  );
};

const PoolStatistics = ({ poolId }: { poolId: string }) => {
  const { members, expenses } = usePool({
    poolId,
  });

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2 text-foreground">
        Pool Statistics
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-semibold text-primary">
            {expenses.length}
          </p>
          <p className="text-sm text-muted-foreground">Expenses</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-semibold text-primary">
            {members.length}
          </p>
          <p className="text-sm text-muted-foreground">Members</p>
        </Card>
      </div>
    </div>
  );
};

const PoolMemberManagementPane = ({ poolId, memberId }: PoolPaneProps) => {
  const { members, details, invalidate, mutations, friendsEligibleToAdd } =
    usePool({
      poolId,
    });

  const [
    maybeModifiedDefaultSplitPercentages,
    setMaybeModifiedDefaultSplitPercentages,
  ] = useState<components["schemas"]["MemberIdSplitPercentage"][]>([]);

  useEffect(() => {
    async function maybeUpdate() {
      const isValid =
        maybeModifiedDefaultSplitPercentages.reduce((acc, curr) => {
          return (acc += curr.split_percentage);
        }, 0) === 100;

      if (isValid && memberId) {
        await mutations.modifyDefaultSplit(
          maybeModifiedDefaultSplitPercentages,
        );

        setMaybeModifiedDefaultSplitPercentages([]);
      }
    }

    maybeUpdate();
  }, [
    maybeModifiedDefaultSplitPercentages,
    memberId,
    poolId,
    mutations,
    invalidate,
  ]);

  if (!details) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <UsersRound className="h-4 w-4" />
          Members
        </h3>
      </div>

      <div className="space-y-2">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No members yet
          </p>
        ) : (
          members
            .sort((a, b) =>
              a.member.first_name.localeCompare(b.member.first_name),
            )
            .map((member) => (
              <Card key={member.member.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium">
                        {member.member.first_name[0]}
                        {member.member.last_name[0]}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {member.member.first_name} {member.member.last_name}
                        {member.member.id === memberId && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {member.member.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-row items-center justify-end gap-x-2 w-48">
                    {details.role === "ADMIN" &&
                      member.member.id !== memberId && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:cursor-pointer"
                              disabled={
                                mutations.isAddPending ||
                                mutations.isRemovePending ||
                                details.total_debt !== 0
                              }
                              onClick={async () => {
                                await mutations.removeFriend(member.member.id);
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
                              (m) => m.member_id === member.member.id,
                            )?.split_percentage ||
                            member.pool_membership.default_split_percentage
                          }
                          onChange={async (e) => {
                            setMaybeModifiedDefaultSplitPercentages((prev) => {
                              const iter = prev.length
                                ? prev
                                : members.map((m) => ({
                                    member_id: m.member.id,
                                    split_percentage:
                                      m.pool_membership
                                        .default_split_percentage,
                                  }));

                              return iter.map((f) => {
                                if (f.member_id === member.member.id) {
                                  return {
                                    member_id: f.member_id,
                                    split_percentage: parseFloat(
                                      e.target.value,
                                    ),
                                  };
                                } else {
                                  return {
                                    member_id: f.member_id,
                                    split_percentage: f.split_percentage,
                                  };
                                }
                              });
                            });
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
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Add Friends to Pool
            </h4>
            <div className="space-y-2">
              {friendsEligibleToAdd.map((friend) => (
                <Card key={friend.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {friend.first_name} {friend.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
                        await mutations.addFriend(friend.id);
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
  );
};

const PoolBalancesPane = ({ poolId }: { poolId: string }) => {
  const [isSettleUpModalOpen, setIsSettleUpModalOpen] = useState(false);

  const {
    details,
    balances,
    isBalancesLoading,
    isDetailsLoading,
    isMembersLoading,
    isExpensesLoading,
  } = usePool({
    poolId,
  });

  const isLoading =
    isMembersLoading ||
    isExpensesLoading ||
    isDetailsLoading ||
    isBalancesLoading;

  if (isLoading || !details) {
    return null;
  }

  return (
    <div className="space-y-4">
      <SettleUpModal
        isOpen={isSettleUpModalOpen}
        setIsOpen={(isOpen) => setIsSettleUpModalOpen(isOpen)}
        poolId={poolId}
      />
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-foreground">
          <ArrowUpDown className="h-5 w-5 text-primary" />
          Balances
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsSettleUpModalOpen(true)}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Settle Up
        </Button>
      </div>

      {balances.length === 0 ? (
        <div className="text-center py-8">
          <div className="bg-primary/10 rounded-full p-4 w-16 h-16 mx-auto mb-4">
            <Clock className="h-8 w-8 text-primary mx-auto" />
          </div>
          <p className="text-lg font-medium text-muted-foreground">
            All settled up!
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Everyone&apos;s even - great teamwork!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {balances.map((balance, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-base">{balance.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {balance.type === "inbound" ? "Owes you" : "You owe"}
                  </p>
                </div>
                <div className="text-right flex flex-row gap-x-3 items-center">
                  <p
                    className={`font-semibold text-lg ${
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
                      className="hover:opacity-80 transition-opacity duration-200"
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
  );
};
