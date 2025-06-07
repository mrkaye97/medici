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
    <div className="flex flex-col md:flex-row overflow-auto md:overflow-hidden md:h-dvh bg-background">
      <CreatePoolModal
        isOpen={isCreatePoolOpen}
        setIsOpen={setIsCreatePoolOpen}
      />
      <div className="md:flex-1 overflow-auto md:overflow-hidden flex flex-col py-6 px-6">
        <Card className="md:flex-1 overflow-auto md:overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200 bg-card border border-border rounded-lg">
          <CardHeader className="pb-4 flex-shrink-0">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl font-semibold text-foreground">
                Pools
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreatePoolOpen(true)}
                className="flex items-center gap-2 bg-background border-border text-foreground font-medium rounded-lg"
              >
                <PlusCircle className="h-4 w-4" />
                <span>New Pool</span>
              </Button>
            </div>
            <CardDescription className="text-muted-foreground">
              Manage your shared expenses with friends
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden px-4 pb-4">
            {pools.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center h-full">
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
              <div className="flex-1 overflow-auto">
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
              </div>
            )}
          </CardContent>

          <CardFooter className="pt-4 border-t border-border flex-shrink-0">
            <div className="text-sm text-muted-foreground">
              {pools.length}{" "}
              {pools.length === 1 ? "active pool" : "active pools"}
            </div>
          </CardFooter>
        </Card>
      </div>

      <div className="md:w-[500px] bg-card flex flex-col h-full overflow-auto md:overflow-hidden py-6 px-6 border-l border-border">
        <FriendsView />
      </div>
    </div>
  );
}
