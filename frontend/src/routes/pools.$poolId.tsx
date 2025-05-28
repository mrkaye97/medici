import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { AddExpenseModal } from "@/components/add-expense-modal";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Expense } from "@/components/expense";
import { SettleUpModal } from "@/components/settle-up-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { components } from "schema";
import { usePool } from "@/hooks/use-pool";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    <div className="flex flex-col md:flex-row overflow-auto md:overflow-hidden md:h-dvh">
      <ExpensesPane poolId={poolId} />
      <PoolDetailsPane memberId={memberId} poolId={poolId} />
    </div>
  );
}

type PoolPaneProps = {
  memberId: string;
  poolId: string;
};

const PoolDetailsPane = ({ memberId, poolId }: PoolPaneProps) => {
  return (
    <div className="md:w-[500px] bg-muted/5 flex flex-col h-full overflow-auto md:overflow-hidden py-6 px-2 ">
      <div className="p-6 border-b bg-background">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Pool Details
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Balances and member management
        </p>
      </div>

      <div className="p-6 space-y-6">
        <PoolBalancesPane poolId={poolId} />
        <Separator />
        <PoolStatistics poolId={poolId} />
        <Separator />
        <PoolMemberManagementPane poolId={poolId} memberId={memberId} />
      </div>
    </div>
  );
};

const ExpensesPane = ({ poolId }: { poolId: string }) => {
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);

  const {
    members,
    expenses,
    details,
    isBalancesLoading,
    isDetailsLoading,
    isMembersLoading,
    isExpensesLoading,
    totalExpenses,
  } = usePool({
    poolId,
  });

  const isLoading = isMembersLoading || isExpensesLoading || isDetailsLoading;

  if (isLoading || isMembersLoading || !details || isBalancesLoading) {
    return (
      <div className="flex flex-col items-center">
        <Spinner className="mt-8" />
      </div>
    );
  }

  return (
    <div className="md:flex-1 overflow-auto md:overflow-hidden flex flex-col py-6 px-2 md:px-0 md:pl-6">
      <AddExpenseModal
        isOpen={isAddExpenseModalOpen}
        setIsOpen={setIsAddExpenseModalOpen}
        pool={details}
      />
      <Card className="md:flex-1 overflow-auto md:overflow-hidden flex flex-col">
        <CardHeader className="pb-4 flex-shrink-0">
          <div className="flex md:flex-row flex-col justify-between items-center mb-6 gap-y-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {details.name}
              </h1>
              <div className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
                <UsersRound className="h-4 w-4" />
                <span>{members.length} members</span>
                {details.role === "ADMIN" && (
                  <Badge variant="outline" className="ml-2">
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

          <CardTitle className="text-xl font-semibold flex flex-row items-center gap-2">
            <BanknoteIcon className="h-5 w-5 text-muted-foreground" />
            Recent Expenses
            <Badge variant="secondary" className="ml-2">
              ${totalExpenses.toFixed(2)} total
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
          {expenses.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6">
                <BanknoteIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-xl mb-2">No expenses yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Start tracking shared expenses by adding your first expense to
                this pool
              </p>
              <Button onClick={() => setIsAddExpenseModalOpen(true)} size="lg">
                <PlusCircleIcon className="h-5 w-5 mr-2" />
                Add your first expense
              </Button>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <div className="divide-y">
                {" "}
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="p-4 hover:bg-muted/30 transition-colors"
                  >
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
      <h3 className="font-medium">Pool Statistics</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-background p-3 rounded-lg border text-center">
          <p className="text-2xl font-bold">{expenses.length}</p>
          <p className="text-xs text-muted-foreground">Expenses</p>
        </div>
        <div className="bg-background p-3 rounded-lg border text-center">
          <p className="text-2xl font-bold">{members.length}</p>
          <p className="text-xs text-muted-foreground">Members</p>
        </div>
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
          members.map((member) => (
            <div
              key={member.member.id}
              className="flex items-center justify-between p-3 rounded-lg bg-background border"
            >
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
              <div className="flex flex-row items-center justify-end-safe gap-x-2 w-48">
                {details.role === "ADMIN" && member.member.id !== memberId && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
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
                        </Button>
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
                                  m.pool_membership.default_split_percentage,
                              }));

                          return iter.map((f) => {
                            if (f.member_id === member.member.id) {
                              return {
                                member_id: f.member_id,
                                split_percentage: parseFloat(e.target.value),
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
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-2 rounded bg-muted/50"
                >
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
    return (
      <div className="flex flex-col items-center">
        <Spinner className="mt-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SettleUpModal
        isOpen={isSettleUpModalOpen}
        setIsOpen={(isOpen) => setIsSettleUpModalOpen(isOpen)}
        poolId={poolId}
      />
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4" />
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
        <div className="text-center py-6">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">All settled up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {balances.map((balance, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-background border"
            >
              <div>
                <p className="font-medium text-sm">{balance.name}</p>
                <p className="text-xs text-muted-foreground">
                  {balance.type === "inbound" ? "Owes you" : "You owe"}
                </p>
              </div>
              <div className="text-right flex flex-row gap-x-2 items-center">
                <p
                  className={`font-semibold text-sm ${
                    balance.type === "inbound"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  ${balance.amount.toFixed(2)}
                </p>
                {balance.venmoHandle && (
                  <a
                    href={`https://venmo.com/?txn=pay&recipients=${balance.venmoHandle}&amount=${balance.amount}&note=Settling up our pool on Medici`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <img
                      src="https://images.ctfassets.net/gkyt4bl1j2fs/ym6BkLqyGjMBmiCwtM7AW/829bf561ea771c00839b484cb8edeebb/App_Icon.png?w=276&h=276&q=50&fm=webp&bg=transparent"
                      className="size-6"
                    />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
