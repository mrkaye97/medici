import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/auth";
import { AddExpenseModal } from "@/components/add-expense-modal";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BanknoteIcon,
  CalendarIcon,
  PlusCircleIcon,
  UserRoundPlus,
  UsersRound,
  UserMinus,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { createFileRoute } from "@tanstack/react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/pools/$poolId")({
  component: Pool,
});

function Pool() {
  const { poolId } = Route.useParams();
  const { memberId, createAuthHeader } = useAuth();
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);

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

  const { mutate: addFriendToPool, isPending: isAddPending } =
    apiClient.useMutation("post", "/api/pools/{pool_id}/members");

  const { mutate: removeFriendFromPool, isPending: isRemovePending } =
    apiClient.useMutation("delete", "/api/pools/{pool_id}/members/{member_id}");

  const expenses = data || [];
  const friends = (friendsRaw || []).filter((f) => f.member.id !== memberId);

  if (!memberId) {
    return null;
  }

  if (isLoading || isFriendsLoading || !pool) {
    return (
      <div className="flex flex-col items-center">
        <Spinner className="mt-8" />
      </div>
    );
  }

  return (
    <div className="flex overflow-hidden">
      <AddExpenseModal
        isOpen={isAddExpenseModalOpen}
        setIsOpen={setIsAddExpenseModalOpen}
        pool={pool}
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{pool.name}</h1>
            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
              <UsersRound className="h-4 w-4" />
              <span>
                {(friendsRaw || []).filter((f) => f.is_pool_member).length}{" "}
                members
              </span>
              {pool.role === "ADMIN" && (
                <Badge variant="outline" className="ml-2">
                  Admin
                </Badge>
              )}
            </p>
          </div>
          <Button
            onClick={() => setIsAddExpenseModalOpen(true)}
            className="flex items-center gap-2"
          >
            <PlusCircleIcon className="h-4 w-4" />
            Add Expense
          </Button>
        </div>

        <Card className="flex-1 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <BanknoteIcon className="h-5 w-5 text-muted-foreground" />
              Recent Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              {expenses.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <BanknoteIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-lg mb-1">No expenses yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your first expense to get started
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddExpenseModalOpen(true)}
                  >
                    Add expense
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex justify-between mb-1">
                        <h3 className="font-medium">{expense.description}</h3>
                        <span className="font-semibold">
                          ${expense.amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span>
                            Paid by{" "}
                            {
                              friends.find(
                                (f) => f.member.id == expense.paid_by_member_id
                              )?.member.first_name
                            }{" "}
                            {
                              friends.find(
                                (f) => f.member.id == expense.paid_by_member_id
                              )?.member.last_name
                            }
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {formatDistanceToNow(new Date(expense.inserted_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {pool.role === "ADMIN" && (
        <div className="w-[320px] border-l bg-muted/10 flex flex-col h-full overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <UsersRound className="h-4 w-4" />
              Pool Members
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage who can access this pool
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Current Members
                </h3>
                {friends.filter((f) => f.is_pool_member).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No other members yet
                  </p>
                ) : (
                  friends
                    .filter((f) => f.is_pool_member)
                    .map((friend) => (
                      <div
                        key={friend.member.id}
                        className="flex items-center justify-between py-2"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm font-medium">
                              {friend.member.first_name}{" "}
                              {friend.member.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {friend.member.email}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive"
                          disabled={isAddPending || isRemovePending}
                          onClick={() => {
                            removeFriendFromPool({
                              params: {
                                path: {
                                  pool_id: poolId,
                                  member_id: friend.member.id,
                                },
                              },
                            });
                          }}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                )}
              </div>

              {friends.filter((f) => !f.is_pool_member).length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Add Friends to Pool
                    </h3>
                    {friends
                      .filter((f) => !f.is_pool_member)
                      .map((friend) => (
                        <div
                          key={friend.member.id}
                          className="flex items-center justify-between py-2"
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="text-sm font-medium">
                                {friend.member.first_name}{" "}
                                {friend.member.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {friend.member.email}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-emerald-700"
                            disabled={isAddPending || isRemovePending}
                            onClick={() => {
                              addFriendToPool({
                                body: {
                                  member_id: friend.member.id,
                                },
                                params: {
                                  path: { pool_id: poolId },
                                },
                              });
                            }}
                          >
                            <UserRoundPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
