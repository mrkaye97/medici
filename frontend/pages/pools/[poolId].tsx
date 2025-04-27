import { Expense } from "@/components/expense";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/auth";
import { AddExpenseModal } from "@/components/add-expense-modal";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserRoundPlus, X } from "lucide-react";
import { apiClient } from "@/api/client";
import { useRouter } from "next/router";

export default function PostComponent({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const router = useRouter();
  const poolId = router.query.poolId as string;
  const { id } = useAuth();
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);

  const { data: pool } = apiClient.useQuery(
    "get",
    "/api/pools/{pool_id}",
    {
      params: {
        path: {
          pool_id: poolId,
        },
        query: {
          member_id: id || "",
        },
      },
    },
    {
      enabled: !!id,
    }
  );

  const { data, isLoading } = apiClient.useQuery(
    "get",
    "/api/pools/{pool_id}/members/{member_id}/expenses",
    {
      params: {
        path: {
          pool_id: poolId,
          member_id: id || "",
        },
        query: {
          limit: 100,
        },
      },
    }
  );

  const { data: friendsRaw, isLoading: isFriendsLoading } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/pools/{pool_id}/members",
    {
      params: {
        path: {
          member_id: id || "",
          pool_id: poolId,
        },
      },
    }
  );

  const { mutate: addFriendToPool, isPending: isAddPending } =
    apiClient.useMutation("post", "/api/pools/{pool_id}/members");

  const { mutate: removeFriendFromPool, isPending: isRemovePending } =
    apiClient.useMutation("delete", "/api/pools/{pool_id}/members/{member_id}");

  const expenses = data || [];
  const friends = (friendsRaw || []).filter((f) => f.member.id !== id);

  if (!id) {
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
          <div className="flex items-center space-x-2 " key={f.member.id}>
            {!f.is_pool_member && (
              <Button
                className="p-4 size-8 bg-green-300 hover:bg-green-400 border-none disabled:hover:cursor-not-allowed"
                variant="outline"
                disabled={isAddPending || isRemovePending || f.is_pool_member}
                onClick={() => {
                  addFriendToPool({
                    body: {
                      member_id: f.member.id,
                    },
                    params: {
                      path: { pool_id: poolId },
                    },
                  });
                }}
              >
                <UserRoundPlus className="size-8" />
              </Button>
            )}
            {f.is_pool_member && (
              <Button
                className="p-4 size-8 bg-red-300 hover:bg-red-400 border-none disabled:hover:cursor-not-allowed"
                variant="outline"
                disabled={isAddPending || isRemovePending || !f.is_pool_member}
                onClick={() => {
                  removeFriendFromPool({
                    params: {
                      path: {
                        pool_id: poolId,
                        member_id: f.member.id,
                      },
                    },
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
                  {f.member.first_name} {f.member.last_name}
                </p>

                <p>{f.member.email}</p>
              </div>
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
