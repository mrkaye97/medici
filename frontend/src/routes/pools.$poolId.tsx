import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/auth";
import { AddExpenseModal } from "@/components/add-expense-modal";
import { useMemo, useState } from "react";
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
import { apiClient } from "@/api/client";
import { createFileRoute } from "@tanstack/react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Expense } from "@/components/expense";
import { AddMemberModal } from "@/components/add-member-modal";
import { SettleUpModal } from "@/components/settle-up-modal";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/pools/$poolId")({
  component: Pool,
});

function Pool() {
  const { poolId } = Route.useParams();
  const { memberId, createAuthHeader } = useAuth();
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isSettleUpModalOpen, setIsSettleUpModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: pool } = apiClient.useQuery(
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

  const { data, isLoading } = apiClient.useQuery(
    "get",
    "/api/pools/{pool_id}/members/{member_id}/expenses",
    {
      params: {
        path: {
          pool_id: poolId,
          member_id: memberId || "",
        },
        query: {
          limit: 100,
        },
      },
      headers: createAuthHeader(),
    }
  );

  const { data: friendsRaw, isLoading: isFriendsLoading } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/pools/{pool_id}/members",
    {
      params: {
        path: {
          member_id: memberId || "",
          pool_id: poolId,
        },
      },
      headers: createAuthHeader(),
    }
  );

  const { data: balancesRaw, isLoading: isBalanacesLoading } =
    apiClient.useQuery(
      "get",
      "/api/pools/{pool_id}/members/{member_id}/balances",
      {
        params: {
          path: {
            member_id: memberId || "",
            pool_id: poolId,
          },
        },
        headers: createAuthHeader(),
      }
    );

  const { mutateAsync: addFriendToPool, isPending: isAddPending } =
    apiClient.useMutation("post", "/api/pools/{pool_id}/members");

  const { mutateAsync: removeFriendFromPool, isPending: isRemovePending } =
    apiClient.useMutation("delete", "/api/pools/{pool_id}/members/{member_id}");

  const expenses = data || [];
  const friends = (friendsRaw || []).filter((f) => f.member.id !== memberId);
  const poolMembers = (friendsRaw || []).filter((f) => f.is_pool_member);

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + (expense.amount || 0),
    0
  );

  const balances = useMemo(() => {
    return (balancesRaw || [])
      .map((b) => {
        const otherMember = friends.find((m) => m.member.id === b.member_id);

        if (!otherMember) {
          return null;
        }

        const name =
          otherMember.member.first_name + " " + otherMember.member.last_name;

        return {
          name,
          amount: b.amount,
          type: b.direction,
        };
      })
      .filter((b) => b !== null);
  }, [balancesRaw, friends]);

  if (!memberId) {
    return null;
  }

  if (isLoading || isFriendsLoading || !pool || isBalanacesLoading) {
    return (
      <div className="flex flex-col items-center">
        <Spinner className="mt-8" />
      </div>
    );
  }

  return (
    <div className="flex overflow-hidden h-dvh">
      <AddExpenseModal
        isOpen={isAddExpenseModalOpen}
        setIsOpen={setIsAddExpenseModalOpen}
        pool={pool}
      />
      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        setIsOpen={setIsAddMemberModalOpen}
        poolId={poolId}
      />
      <SettleUpModal
        isOpen={isSettleUpModalOpen}
        setIsOpen={(isOpen) => setIsSettleUpModalOpen(isOpen)}
        poolId={poolId}
      />

      <div className="flex-1 overflow-hidden flex flex-col py-6 pl-6">
        <Card className="flex-1 overflow-hidden flex flex-col">
          <CardHeader className="pb-4 flex-shrink-0">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {pool.name}
                </h1>
                <div className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
                  <UsersRound className="h-4 w-4" />
                  <span>{poolMembers.length} members</span>
                  {pool.role === "ADMIN" && (
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
                <Button
                  onClick={() => setIsAddExpenseModalOpen(true)}
                  size="lg"
                >
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

      <div className="w-[500px] bg-muted/5 flex flex-col h-full overflow-hidden py-6 px-2 ">
        <div className="p-6 border-b bg-background">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pool Details
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Balances and member management
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            <div className="space-y-4">
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
                  <p className="text-sm text-muted-foreground">
                    All settled up!
                  </p>
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
                      <div className="text-right">
                        <p
                          className={`font-semibold text-sm ${
                            balance.type === "inbound"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          ${balance.amount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-medium">Pool Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background p-3 rounded-lg border text-center">
                  <p className="text-2xl font-bold">{expenses.length}</p>
                  <p className="text-xs text-muted-foreground">Expenses</p>
                </div>
                <div className="bg-background p-3 rounded-lg border text-center">
                  <p className="text-2xl font-bold">{poolMembers.length}</p>
                  <p className="text-xs text-muted-foreground">Members</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  <UsersRound className="h-4 w-4" />
                  Members
                </h3>
                {pool.role === "ADMIN" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddMemberModalOpen(true)}
                  >
                    <UserRoundPlus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {poolMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No members yet
                  </p>
                ) : (
                  poolMembers.map((member) => (
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
                              <Badge
                                variant="secondary"
                                className="ml-2 text-xs"
                              >
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
                        {pool.role === "ADMIN" &&
                          member.member.id !== memberId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              disabled={isAddPending || isRemovePending}
                              onClick={async () => {
                                await removeFriendFromPool({
                                  params: {
                                    path: {
                                      pool_id: poolId,
                                      member_id: member.member.id,
                                    },
                                  },
                                  headers: createAuthHeader(),
                                });

                                await queryClient.invalidateQueries({
                                  queryKey: [
                                    "get",
                                    "/api/members/{member_id}/pools/{pool_id}/members",
                                  ],
                                });
                              }}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          )}
                        {pool.role === "ADMIN" && (
                          <div className="flex flex-col items-start gap-1">
                            <Label htmlFor="email" className="text-xs">
                              Split %
                            </Label>
                            <Input type="number" className="max-w-16" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {pool.role === "ADMIN" &&
                friends.filter((f) => !f.is_pool_member).length > 0 && (
                  <>
                    <div className="pt-4">
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                        Add Friends to Pool
                      </h4>
                      <div className="space-y-2">
                        {friends
                          .filter((f) => !f.is_pool_member)
                          .slice(0, 3)
                          .map((friend) => (
                            <div
                              key={friend.member.id}
                              className="flex items-center justify-between p-2 rounded bg-muted/50"
                            >
                              <div>
                                <p className="text-sm font-medium">
                                  {friend.member.first_name}{" "}
                                  {friend.member.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {friend.member.email}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                disabled={isAddPending || isRemovePending}
                                onClick={async () => {
                                  await addFriendToPool({
                                    body: {
                                      member_id: friend.member.id,
                                    },
                                    params: {
                                      path: { pool_id: poolId },
                                    },
                                    headers: createAuthHeader(),
                                  });

                                  await queryClient.invalidateQueries({
                                    queryKey: [
                                      "get",
                                      "/api/members/{member_id}/pools/{pool_id}/members",
                                    ],
                                  });
                                }}
                              >
                                <UserRoundPlus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        {friends.filter((f) => !f.is_pool_member).length >
                          3 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => setIsAddMemberModalOpen(true)}
                          >
                            View all (
                            {friends.filter((f) => !f.is_pool_member).length -
                              3}{" "}
                            more)
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
