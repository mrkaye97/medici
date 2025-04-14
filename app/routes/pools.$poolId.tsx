import { Checkbox } from "@/components/ui/checkbox";
import { Expense } from "@/components/expense";
import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "app/hooks/auth";
import { useTRPC } from "trpc/react";

export const Route = createFileRoute("/pools/$poolId")({
  component: PostComponent,
});

function PostComponent() {
  const { poolId } = Route.useParams();
  const { id } = useAuth();
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.getPoolRecentExpenses.queryOptions(
      {
        memberId: id || "",
        poolId,
        limit: 100,
      },
      {
        enabled: !!id,
      },
    ),
  );

  const { data: friendsRaw, isLoading: isFriendsLoading } = useQuery(
    trpc.listFriends.queryOptions(
      {
        memberId: id || "",
      },
      {
        enabled: !!id,
      },
    ),
  );

  const expenses = data || [];
  const friends = friendsRaw || [];

  if (!id) {
    return <Navigate to="/login" />;
  }

  if (isLoading || isFriendsLoading) {
    return (
      <div className="flex flex-col items-center">
        <Spinner className="mt-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 w-full mt-4 px-4 gap-x-4">
      <div className="flex flex-1 flex-col w-full">
        <h2 className="text-2xl font-semibold mb-6">Recent Expenses</h2>
        {expenses.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No expenses found</p>
          </div>
        ) : (
          <div className="space-y-4 w-full">
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
      <div className="flex flex-1 flex-col">
        <h2 className="text-2xl font-semibold mb-6">Manage pool members</h2>
        {friends.map((f) => (
          <div className="flex items-center space-x-2" key={f.id}>
            <Checkbox id="terms" />
            <label
              htmlFor="terms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {f.firstName} {f.lastName} - {f.email}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
