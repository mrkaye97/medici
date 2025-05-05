import { PoolSummary } from "@/components/pool-summay";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/auth";
import { apiClient } from "@/api/client";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FriendsView } from "@/components/friends-view";
import { HandCoinsIcon, PlusCircle, Wallet } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreatePoolModal } from "@/components/create-pool-modal";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { memberId, createAuthHeader, isAuthenticated } = useAuth();
  const [isCreatePoolOpen, setIsCreatePoolOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    data,
    isLoading: isPoolsLoading,
    isFetching,
  } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/pools",
    {
      params: {
        path: {
          member_id: memberId || "",
        },
      },
      headers: createAuthHeader(),
    },
    {
      enabled: !!memberId,
    },
  );

  const pools = data || [];
  const isLoading = isPoolsLoading;

  if (isLoading || isFetching) {
    return (
      <div className="flex flex-col items-center">
        <Spinner className="mt-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <CreatePoolModal
        isOpen={isCreatePoolOpen}
        setIsOpen={setIsCreatePoolOpen}
      />{" "}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 max-h-[calc(100vh-10rem)]">
        <Card className="shadow-sm bg-white border rounded-lg flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-semibold">Pools</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreatePoolOpen(true)}
                className="flex items-center gap-1"
              >
                <PlusCircle className="h-4 w-4" />
                <span>New Pool</span>
              </Button>
            </div>
            <CardDescription className="text-muted-foreground">
              Manage your shared expenses with friends
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-[calc(100vh-18rem)]">
              {pools.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="bg-muted rounded-full p-3 mb-3">
                    <Wallet className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-3">
                    No pools created yet
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreatePoolOpen(true)}
                  >
                    Create your first pool
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {pools.map((pool) => (
                    <div
                      key={pool.id}
                      className="transition-all hover:bg-muted/50 rounded-lg overflow-hidden"
                    >
                      <PoolSummary poolId={pool.id} />
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>

          <CardFooter className="pt-1 pb-3 px-6">
            <div className="text-xs text-muted-foreground">
              {pools.length}{" "}
              {pools.length === 1 ? "active pool" : "active pools"}
            </div>
          </CardFooter>
        </Card>

        <div className="flex flex-col h-full">
          <FriendsView />
        </div>
      </div>
    </div>
  );
}
