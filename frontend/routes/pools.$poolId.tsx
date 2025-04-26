import { Expense } from "frontend/components/expense";
import { Spinner } from "frontend/components/ui/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "frontend/hooks/auth";
import { useTRPC } from "trpc/react";
import { AddExpenseModal } from "frontend/components/add-expense-modal";
import { useState } from "react";
import { Button } from "frontend/components/ui/button";
import { Label } from "frontend/components/ui/label";
import { UserRoundPlus, X } from "lucide-react";

export const Route = createFileRoute("/pools/$poolId")({
  component: PostComponent,
});

function PostComponent() {
  const { poolId } = Route.useParams();
  const { id } = useAuth();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);

  const { data: pool } = useQuery(
    trpc.getPoolDetails.queryOptions(
      {
        memberId: id || "",
        poolId,
      },
      {
        enabled: !!id,
      }
    )
  );

  const { data, isLoading } = useQuery(
    trpc.getPoolRecentExpenses.queryOptions(
      {
        memberId: id || "",
        poolId,
        limit: 100,
      },
      {
        enabled: !!id,
      }
    )
  );

  const { data: friendsRaw, isLoading: isFriendsLoading } = useQuery(
    trpc.listMembersOfPool.queryOptions(
      {
        memberId: id || "",
        poolId: poolId,
      },
      {
        enabled: !!id,
      }
    )
  );

  const { mutate: addFriendToPool, isPending: isAddPending } = useMutation(
    trpc.addFriendToPool.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.listMembersOfPool.queryKey(),
        });
      },
    })
  );
  const { mutate: removeFriendFromPool, isPending: isRemovePending } =
    useMutation(
      trpc.removeFriendFromPool.mutationOptions({
        onSettled: async () => {
          await queryClient.invalidateQueries({
            queryKey: trpc.listMembersOfPool.queryKey(),
          });
        },
      })
    );

  const expenses = data || [];
  const friends = (friendsRaw || []).filter((f) => f.id !== id);

  if (!id) {
    return <Navigate to="/login" />;
  }

  if (isLoading || isFriendsLoading || !pool) {
    return (
      <div className="flex flex-col items-center">
        <Spinner className="mt-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 w-full px-4 gap-x-4 h-screen overflow-hidden">
      <AddExpenseModal
        isOpen={isAddExpenseModalOpen}
        setIsOpen={setIsAddExpenseModalOpen}
        pool={pool}
      />
      <div className="flex flex-1 flex-col w-full p-12 overflow-hidden">
        <h2 className="text-2xl font-semibold mb-6">Recent Expenses</h2>
        <Button
          className="my-2"
          onClick={() => {
            setIsAddExpenseModalOpen(true);
          }}
        >
          Add expense
        </Button>
        {expenses.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No expenses found</p>
          </div>
        ) : (
          <div className="space-y-4 w-full overflow-y-auto flex-1">
            {expenses.map((e) => (
              <div
                key={e.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <Expense expense={e} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col bg-gray-100 p-12 h-screen overflow-y-auto">
        <h2 className="text-2xl font-semibold mb-6">Manage pool members</h2>
        {friends.map((f) => (
          <div className="flex items-center space-x-2 " key={f.id}>
            {!f.isPoolMember && (
              <Button
                className="p-4 size-8 bg-green-300 hover:bg-green-400 border-none disabled:hover:cursor-not-allowed"
                variant="outline"
                disabled={isAddPending || isRemovePending || f.isPoolMember}
                onClick={() => {
                  addFriendToPool({
                    poolId: poolId,
                    memberId: f.id,
                  });
                }}
              >
                <UserRoundPlus className="size-8" />
              </Button>
            )}
            {f.isPoolMember && (
              <Button
                className="p-4 size-8 bg-red-300 hover:bg-red-400 border-none disabled:hover:cursor-not-allowed"
                variant="outline"
                disabled={isAddPending || isRemovePending || !f.isPoolMember}
                onClick={() => {
                  removeFriendFromPool({
                    poolId: poolId,
                    memberId: f.id,
                  });
                }}
              >
                <X className="size-8" />
              </Button>
            )}
            <Label
              htmlFor="terms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              <div className="flex flex-col items-start gap-y-1">
                <p>
                  {f.firstName} {f.lastName}
                </p>

                <p>{f.email}</p>
              </div>
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
