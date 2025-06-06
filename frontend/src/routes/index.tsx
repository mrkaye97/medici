import { PoolSummary } from "@/components/pool-summay";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/api/client";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { FriendsView } from "@/components/friends-view";
import { PlusCircle, Wallet } from "lucide-react";
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
    }
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
    <div className="min-h-dvh bg-background p-6">
      <CreatePoolModal
        isOpen={isCreatePoolOpen}
        setIsOpen={setIsCreatePoolOpen}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 bg-card border border-border rounded-lg flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl font-semibold text-foreground">
                Pools
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreatePoolOpen(true)}
                className="flex items-center gap-2 bg-background hover:bg-accent border-border text-foreground font-medium rounded-lg"
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
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-primary/10 rounded-full p-4 mb-4">
                    <Wallet className="h-10 w-10 text-primary" />
                  </div>
                  <p className="text-muted-foreground mb-4 text-lg">
                    No pools created yet
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreatePoolOpen(true)}
                    className="bg-background hover:bg-accent border-border text-foreground font-medium rounded-lg"
                  >
                    Create your first pool
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pools.map((pool) => (
                    <div
                      key={pool.id}
                      className="transition-colors duration-200 hover:bg-accent/50 rounded-lg overflow-hidden"
                    >
                      <PoolSummary poolId={pool.id} />
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>

          <CardFooter className="pt-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
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
